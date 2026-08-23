# 개인정보와 접근 범위

Demo Mode의 개인 표현 기록은 `class_id`, `owner_id`, `privacy_level`을 분리해 저장한다. `privacy_level`은 표시용 문구가 아니라 접근 판단의 핵심 값이다.

- `class_share`: 본인과 담당 교사가 열람할 수 있으며, 해당 활동에서 허용된 같은 학급 사용자에게 공유할 수 있다. 공용 학급 화면은 별도의 `teacherApproved`가 필요하다.
- `teacher_private`: 본인과 같은 학급 담당 교사만 실제 콘텐츠를 열람·인쇄할 수 있다.
- `self_only`: 본인만 실제 콘텐츠를 열람할 수 있다. 교사는 작성 사실·날짜·횟수만 보고 Emoji, 사진, 그림, 음성, 내용에는 접근하지 않는다.

교사·친구 접근에는 콘텐츠와 viewer의 `class_id` 일치를 함께 요구한다. 보호자는 `teacher_private`와 `self_only`에 접근하지 않는다. Supabase 전환 시 이 규칙을 RLS와 private Storage 정책으로 강제한다.

감정 Emoji 통계는 `class_share`와 `teacher_private`만 사용한다. `self_only`는 횟수만 집계하고 실제 Emoji를 분석 입력에 포함하지 않는다. 자동 감정·관계 진단은 하지 않는다.
