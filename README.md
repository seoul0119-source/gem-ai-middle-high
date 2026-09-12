# GEM AI Middle & High

GEM AI CLASS 중·고등 공통 학습관입니다.

## 공통 수업 엔진

- `class.html`: 기존 과목 선택 화면
- `learn.html`: 학생이 사용하는 공통 대화 수업 화면
- `api/chat.js`: OpenAI Responses API 연결
- `api/courses.js`: 학년·과목별 지침 저장고

현재 첫 시험 수업은 `m1-english-word`(중1 영어 단어 Lv.7)입니다.

## Vercel 환경변수

- `OPENAI_API_KEY`: 필수
- `OPENAI_MODEL`: 선택, 기본값 `gpt-5.6-luna`
- `OPENAI_SUNEUNG_MODEL`: 수능 전용, 기본값 `gpt-6-astra` (추론 `low`). 일반 교실의 `OPENAI_MODEL`과 별도로 적용합니다. 기본 모델의 접근 불가 오류에만 `gpt-5.6-sol`로 전환하며 서버 로그에 실제 전환을 남깁니다. 사용자 지정 모델에는 자동 전환을 적용하지 않습니다.

비밀 키는 코드나 브라우저에 넣지 않고 Vercel 환경변수로만 관리합니다.

Preview deployments use Vercel environment variables and do not change production until reviewed.

## 수능 AI 설명

수능 통합과학의 답안 채점·문제 순서·세 번의 도전은 검토된 문제 엔진이 관리합니다. 질문·힌트·후속 대화는 현재 문제와 최근 대화 40개를 함께 전달하여 실제 AI 모델이 설명합니다. 용어 목록에 없는 질문도 대화 경로로 전달합니다.

설명은 내용 범위·정확성·정답 사전 공개 검토를 통과한 뒤에만 표시합니다. 서버가 학생·과목·수업 회차와 연결해 서명한 설명만 음성으로 읽거나 도전 횟수 복원에 사용할 수 있습니다. 연결 또는 검토 실패 시 미검토 문장을 보여 주지 않고 재요청을 안내하며 진도를 유지합니다. 모델 기반 검토는 완전한 정확성 보장이 아니므로 교사의 내용 확인이 필요합니다.

Vercel 빌드에서는 `scripts/verify-suneung-tutor.mjs`가 실제 API로 질량 설명과 후속 대화를 확인합니다. 실제 학생 정보를 사용하지 않으며, 해당 배포 환경의 모델 접근·응답·서명 검증 실패 시 배포를 중단합니다. 이 검사에는 소량의 API 사용료가 발생합니다.
