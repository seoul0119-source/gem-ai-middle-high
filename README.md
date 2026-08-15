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

비밀 키는 코드나 브라우저에 넣지 않고 Vercel 환경변수로만 관리합니다.
