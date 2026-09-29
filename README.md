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

Vercel 빌드는 전체 단위검사 후 `node scripts/verify-suneung-2028.mjs --course=suneung-2028-english`로 실제 영어 수업 시작, 문맥 질문, 알려진 정답의 채점과 2번 문제 출제를 확인합니다. 시작 요청은 한국어로 인식된 “안녕하세요. 영어 수업 시작해 주세요.”를 음성 입력 경로에 전달하며, 실제 녹음·음성 인식 서비스 검사는 아닙니다. 실제 학생 정보를 사용하거나 학습 기록을 저장하지 않습니다. 3번의 수업 요청에 기본 7번의 유료 AI 호출이 발생하며, 재시도를 포함해 최대 14번·전체 90초로 제한합니다. 실제 문제·채점의 독립 검토는 그대로 수행하고 실패하면 배포를 중단합니다.

반복 배포 때 전체 과목의 유료 검사를 자동 실행하지 않도록 분리했습니다. 전체 감사가 필요하면 `node scripts/verify-suneung-2028.mjs --all`로 13개 교실·39번의 수업 요청을 검사합니다(기본 91번, 최대 170번의 유료 AI 호출·300초 제한). 기존 `node scripts/verify-suneung-tutor.mjs` 및 `node scripts/verify-suneung-general.mjs`도 수동 검증용으로 유지합니다. 이 검증들은 API 비용이 발생하므로 필요한 범위를 선택해 실행합니다. `node scripts/verify-suneung-2028.mjs --fixtures-only --course=suneung-2028-english`는 API 호출 없이 대상과 호출 상한만 확인합니다.

## 고졸 검정고시 시범반

`ged-high-korean`, `ged-high-math`, `ged-high-english`는 기존 `class.html` → `learn.html`과 학생 인증·Sheets 출결·자료실 기록을 사용합니다. 자체 제작 기초 4지선다 10문제로, 공식 기출이나 전 범위 모의고사는 아닙니다. 국어/영어는 각각 12문항에서 10개를 선택하고 수학은 10개 유형의 수치를 변형합니다. 수업 회차별 문제·보기 순서는 재현 가능하며, 재접속 시 저장된 회차와 전체 대화로 진도를 복원합니다. 문제 은행은 `lib/ged-bank.js`입니다.

정해진 답안으로 채점하며 힌트·질문에는 도전 횟수를 쓰지 않습니다. 세 번 오답이면 정답과 해설 후 다음 문제로 진행합니다. 첫 시도 점수와 재도전 포함 정답 수를 구분하며 시험 합격 점수로 표시하지 않습니다. 자유 질문은 기존 자료실 AI 설명 엔진을 사용합니다. 자료실의 과목 카탈로그도 함께 등록합니다.

빌드 마지막의 `scripts/verify-ged.mjs`는 세 과목의 실제 AI 풀이 도움(총 3번의 호출)과 그 뒤 정답 채점을 확인합니다. 학생 등록, Sheets 기록, 자료실 저장은 실행하지 않습니다. `tests/ged-lesson.test.mjs`는 세 과목 10문제 전체 진행 및 기존 저장 요청 형식을 외부 서비스 대체 응답으로 검사합니다.
