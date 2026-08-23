# 데이터베이스 스키마 계획

Supabase PostgreSQL을 사용하며 모든 활동 테이블은 `class_id`로 격리한다.

- `profiles`, `classes`, `teacher_class_memberships`, `students`
- `daily_attendance`, `daily_moods`
- `friend_assignment_days`, `friend_assignments`, `friend_responses`
- `voluntary_cycles`, `voluntary_cycle_members`, `nature_cards`
- `teacher_notes`

교사는 membership이 있는 학급만 접근하도록 RLS를 적용한다. Storage는 private bucket과 권한 확인 접근을 사용한다. 상세 SQL은 Phase 8에서 확정한다.
## 학생 QR access token

운영 DB에서는 학생 코드/PIN과 QR access token을 분리한다. QR에는 학생 개인정보를 넣지 않고 `student_access_credentials.qr_token`만 입장 URL에 사용한다.

- 애플리케이션은 CSPRNG로 256-bit opaque token을 생성한다.
- insert/update가 PostgreSQL unique violation(`23505`)을 반환하면 새 token을 생성해 제한된 횟수만큼 재시도한다.
- QR 재발급은 transaction 안에서 새 unique token을 저장하고 version을 증가시킨다. 이전 token은 즉시 조회 불가 상태로 폐기한다.
- 학생 이름, 학급명, 학교명, PIN, 교사 ID는 QR payload에 포함하지 않는다.

## 학생-학급-교사 및 활동 FK

```sql
create table teachers (
  id uuid primary key default gen_random_uuid(),
  teacher_code text not null unique
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table teacher_class_memberships (
  teacher_id uuid not null references teachers(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  primary key (teacher_id, class_id)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete restrict,
  name text not null,
  avatar text not null,
  active boolean not null default true
);

create table student_access_credentials (
  student_id uuid primary key references students(id) on delete cascade,
  student_code text not null,
  pin_hash text not null,
  qr_token text not null,
  token_version integer not null default 1,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint student_access_credentials_student_code_key unique (student_code),
  constraint student_access_credentials_qr_token_key unique (qr_token)
);
```

모든 학생 활동 테이블은 `student_id references students(id)`를 필수로 갖고, 필요한 집계 격리를 위해 `class_id references classes(id)`도 저장한다. `teacher_feedback`은 `teacher_id`, `class_id`, `student_id` FK를 모두 갖는다. 서버는 URL의 student id를 신뢰하지 않고 인증 session의 `student_id`와 요청 row의 FK 일치를 확인한다. PIN은 운영 DB에서 평문으로 저장하거나 반복 다운로드하지 않고 hash 검증과 교사 reset 방식으로 처리한다.

## 경쟁 없는 갤러리 공감

```sql
create table gallery_reactions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  gallery_item_id uuid not null,
  student_id uuid not null references students(id) on delete cascade,
  reaction_type text not null check (reaction_type = 'heart'),
  created_at timestamptz not null default now(),
  unique (student_id, gallery_item_id, reaction_type)
);
```

서버는 학생 session의 `student_id`와 `class_id`를 사용하고, 같은 학급에서 `class_share`와 교사 승인을 모두 충족한 현재 공개 작품에만 공감을 생성한다. 작품이 비공개되면 reaction은 집계나 학생 UI에서 제외한다. 전자칠판 반응은 저장하지 않는다. 공감 데이터는 관계지도, 감정 분석, 정렬 및 순위 입력으로 사용하지 않는다.
월별 공감나눔 집계는 reaction의 `created_at` 월과 작품 작성자의 `student_id`를 기준으로, 보낸 학생마다 서로 다른 작품 작성자 수를 계산한다. 같은 친구의 여러 작품에 보낸 공감은 월간 기준에서 한 친구로 센다. 공감꽃은 작품마다 고유 학생 반응 수가 학급 설정 기준 이상인지 독립적으로 판단하며 여러 작품이 동시에 기준을 충족할 수 있다. 보낸 행동과 받은 반응은 합산 점수로 만들지 않는다.