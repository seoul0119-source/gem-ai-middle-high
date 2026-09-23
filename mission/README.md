# GEM Grade 2 Global Mission operator pilot

English/French prepared addition lesson with the existing original VRM. Static preview only: no Anam, no paid AI or speech API, no student records, no free-form generative AI connection. The limited question interpreter handles additions up to twenty and explicitly scoped prepared questions. Browser recognition is opt-in for adult testing; recognized text is reviewed before submission. Device voices are preferred; online browser voices require an explicit checkbox.

Eight-minute accelerated plan or forty-minute group activity plan. Unanswered questions wait for the classroom teacher; the plan is not a hard deadline. Progress is local per device and language switching preserves it. User must load the model before Start is enabled.

## Safety and isolation

This preview branch intentionally replaces the root Vercel configuration with a static-only build. DO NOT merge the preview root configuration into production. Only mission-dist is served; existing server endpoints are not included and costly production verification scripts are not executed. Production main and homepage remain untouched.

The model bytes match the existing repository asset exactly. Its metadata includes usage limitations; permission review is required before distribution to external students. This operator test does not certify that permission.

## Checks

Node tests verify exact arithmetic, bilingual structure and parsing. Build-time Playwright renders the actual original model with WebGL, checks real geometry and animations, five layouts, language/progress persistence and prepared offline reload. This does not validate hardware speech/microphone, physical mobile devices, real school network reliability or a full forty-minute classroom session.
