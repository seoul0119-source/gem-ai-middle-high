# Grade 2 repair: questions, feedback, fresh sessions, provider status

Scope: isolated preview/global-mission-group-20260924. Production main and other classrooms remain untouched. Existing VRM, voice consent, recognition and diagnostic paths are retained.

The old prepared-answer dispatcher and fixed 12-step session caused generic or misleading answers. A timed group scheduler could progress after an incorrect response, and its fallback description was spoken as lesson text. This update provides exact local arithmetic and context-sensitive explanations, a freshly constructed shared-language lesson, and a bounded server-side OpenAI question endpoint.

- Questions are accepted in any lesson phase. Numbers inside a question are not automatically graded as an answer.
- Incorrect answers reveal the correct answer and explanation, hold progress for a teacher acknowledgement, and cannot auto-skip after the old 10-second interval. Unanswered questions also wait. Normal narration/activity timing is otherwise preserved.
- New lesson chooses new numbers/order/story examples within the existing addition-to-20 scope. Recent first questions are avoided on the same device. Refresh/resume and language changes preserve the existing session, rather than silently generating another one.
- Diagrams and explanations derive from the same exact numbers. Existing video clips are reused only for their original matching numbers; other questions use on-device diagrams/animation instead of incorrect static video.
- Standard arithmetic and explanations remain local. Additional questions use /api/mission-chat, server-only OPENAI_API_KEY and OPENAI_MISSION_MODEL (default gpt-4.1-mini). The response is bounded, schema-validated, checked for numeric equalities and checked against the current verified answer. This reduces but does not eliminate AI explanation errors. A human teacher reviews content.
- Provider failures are silent status text. They preserve the question, do not enter the speech queue, never mark an answer successful, and never advance a question. No automatic paid retries or arbitrary lesson generation calls.
- Requests are bounded and per-instance rate limited; preview remains operator-protected. This is not a public multi-tenant abuse prevention system. Store:false does not make a claim of zero provider retention. No student records, names, credentials or audio recordings are added.

The build first runs all previous regression suites, then checks the final repaired runtime. Unit checks use 120 sessions / 1200 questions. Speech/API failure timing uses mocked interfaces; the existing VRM is actually rendered. Two small real OpenAI questions run if the preview key is configured, and results/usage are recorded without secrets. NOT_CONFIGURED is explicitly reported if no key is present. Never merge the isolated root build configuration into main.
