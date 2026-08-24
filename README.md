# 마음씨앗 우체국

만 3~5세 유아의 마음 표현, 친구 연결, 생태 관찰을 잇는 학급용 웹앱입니다. 현재 실제 개인정보 없이 UX를 확인하는 Demo Mode를 제공합니다.

## 실행
```bash
npm install
npm run dev
```
`http://localhost:3000`에서 **교사 Demo 로그인**을 누릅니다. Production 검증은 `npm run build`로 수행합니다.

## 환경변수와 Supabase
`.env.example`을 `.env.local`로 복사하고 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 설정합니다. Demo에는 필요하지 않습니다. Auth, PostgreSQL, private Storage, RLS는 후속 Phase에서 연결합니다.

## Demo Mode와 운영 흐름
햇님반 15명, 별님반 22명, 새싹반 25명의 가상 학급을 제공합니다. 교사 로그인 → 학급 선택 → 대시보드 → 유아모드 → 오늘 마음 → 마음친구 → 자연 마음 → 관계지도를 확인할 수 있습니다. 실제 인증·학급 관리·서버 저장은 후속 Phase 범위입니다.

## 저장소와 배포
GitHub는 `scallet16/maeum`, Production branch는 `main`입니다. Vercel Git Integration에서 공개 환경변수를 설정합니다.

## 개인정보 주의
개발·Demo에 실제 유아 이름, 사진, 음성을 사용하지 않습니다. 운영 미디어는 public bucket이나 공개 URL에 두지 않습니다. 얼굴 인식, AI 감정·관계 분석, SNS 공유는 구현하지 않습니다.
## Supabase cross-device 설정

1. Supabase SQL Editor에서 `supabase/migrations/202608240001_cross_device_core.sql`을 실행합니다.
2. 로컬은 `.env.example`을 참고해 `.env.local`을 만들고 값을 입력합니다. `.env.local`은 Git에 포함하지 않습니다.
3. Vercel에는 `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STUDENT_SESSION_SECRET`을 등록합니다.
4. `SUPABASE_SERVICE_ROLE_KEY`와 `STUDENT_SESSION_SECRET`은 서버 전용이며 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. `STUDENT_SESSION_SECRET`은 32자 이상의 암호학적 난수로 설정합니다.

환경변수가 없으면 기존 localStorage Demo Mode가 유지됩니다. 환경변수가 있으면 새로 만든 학급의 학생·자격·오늘 마음 핵심 흐름이 Supabase와 동기화됩니다.