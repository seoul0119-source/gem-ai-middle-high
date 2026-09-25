# GEM common PC programme first expansion

User scope: one shared programme in mathematics, science and English at learning levels 1–12, with world history from level 7. Teaching languages are English, French, Nepali, Urdu and Swahili. Country-specific history/society/languages and art/music remain optional future modules. Urdu and Swahili interpret the user's country-language shorthand; they are not exclusive national-language claims. English remains the learning target in English subject lessons. No national accreditation/alignment or advanced track is claimed.

Based on c872a921dc586204f0c6a0d5d0529f538165fdc8, including the complete f1a3e1c sample lineage, all-question media and the later PC microphone/voice diagnostics. Build extends build-pc-audio-v2.mjs and retains all its gates. It never modifies the original mobile sample output, service worker, question generator, avatar or fullscreen controller. Final hashes check this preservation. Main and existing deployments are unchanged; use the new preview branch only.

Implemented: 42 grade/subject courses with four shared unit themes each (168 themes), translated unit labels, separate PC programme classroom, teacher review before starting, one six-stage lesson prepared on demand in all five languages using the existing server key, reuse of the existing GEM VRM and audio diagnostics, pause/continue, previous/next, explicit ending, wrong-answer explanation with a hold, contextual microphone/text questions, 20-second follow-up without auto-resuming a teacher-paused class, configurable 10–90-minute clock, same-browser lesson cache/session restore, and explicit new-lesson generation. No API requests are made when switching a saved lesson's language. Switching cancels speech/requests and pauses the same step. Numeric replies match option content before any option-letter matching; a number is never treated as an option ordinal. New generation replaces an existing pack only after validated success. Generation failures preserve the prior pack and progress.

The PC entry opens the common programme for all supported grade/subject combinations. pc.html?sample=1 opens the preserved PC Grade 2 addition pilot. index.html retains the original English/French mobile sample. Storage is isolated from those samples. No cross-device or cross-host synchronization is claimed. Cached lesson content can be reused on the same browser; full offline page availability and offline AI dialogue are not claimed.

Scope limits: the 168 items are unit themes, not 168 prewritten or professionally reviewed lessons, and not a complete annual syllabus. AI lessons contain explanation, three check questions, a group activity and recap. Each generated pack is a first lesson within its topic. Teacher review and fluent review of translations are required. Structured validation checks completeness/shape/answer indices, not universal factual or translation accuracy. Existing detailed arithmetic animations stay in the Grade 2 sample; new general lessons use localized text boards. External maps/videos/images in the attached information-center document are not imported or treated as licensed assets.

Audio still uses voices actually exposed by the PC/browser, with the existing explicit online-voice checkbox. This expansion does not install absent Nepali/Urdu/Swahili voices, add another paid speech provider, or certify physical microphones/speakers. AI preparation and additional questions use the existing OpenAI server configuration and therefore existing API usage; local 3D rendering is not a claim that every operation is free. Request limits are process-local and do not constitute distributed abuse protection; this remains an operator preview.

Fonts: bundled WOFF subsets of Noto Sans Devanagari and Noto Sans Arabic, retrieved from google/fonts with their OFL licenses. Sources: ofl/notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf and ofl/notosansarabic/NotoSansArabic[wdth,wght].ttf. No external font request is required at runtime. Pure numeric boards use first-strong direction to retain mathematical order in RTL layouts.

Verification: local deterministic provider and speech fixtures cover all five scripts, catalogue boundaries, invalid packs, number/option ambiguity, language/state preservation, answer hiding/reveal, dialogue without advancement, refresh/resume, fullscreen exit, failure retention and regeneration. Local avatar was a stub; the full build suite repeats the programme tests with the real existing avatar. Generated fixtures are test code only, never returned as live lesson fallbacks. Live AI and physical-device verification must be reported separately.

Selected syllabus policy (2026-09-25): per the operator's request, omit biological evolution, natural selection, common ancestry, Darwinism and human evolution. Shared instructions cover all five language packs and dialogue. A multilingual term check rejects the entire generated lesson if excluded content is detected anywhere in its stages; it also invalidates saved sessions/cached packs before display. Excluded-topic questions and detected replies receive a localized return-to-lesson message, without restating the excluded topic. This is a curriculum preference, not a statement that scientific theories are false. Other unspecified theological exclusions have not been invented; factual descriptions of historical beliefs are distinguished from endorsement. Term checks cannot certify every paraphrase or theological interpretation; teacher review remains required.

Live verification found one draft whose answer index conflicted with its explanation. Version v2 now runs a separate AI review over all five languages without showing draft indices. It independently returns zero-based answers and rejects factual/translation ambiguity or excluded-topic paraphrases. Only validated review indices are applied. This additional check is probabilistic, not certification; the teacher preview remains required. v2 storage keys prevent reuse of previously unreviewed v1 drafts.

Live drafts were held at the additional review step. Review answers now use fixed q1/q2/q3 fields (only the three questions), with explicit issue categories. The review accepts ordinary translation wording differences while requiring the same facts, tasks and correct option position. A rejected draft receives one automatic correction attempt using specific reviewer feedback; all calls share the existing 155-second deadline. A rejected correction still stays out of the classroom. Only issue categories and numeric answer metadata are logged, not lesson text or feedback.


## Optional speech and conversation text (2026-09-25)

The programme page keeps the latest 60 class/teacher messages in its current
lesson session in this browser. Language/stage changes preserve this history;
a new lesson or Clear conversation removes it. Speech-recognition results stay
visible in the input/receipt while the class's submitted text and the teacher's
answer remain in Conversation text. This is not a recording archive.

Audio settings offers a separate, initially OFF AI speech checkbox. The notice
in all five languages states that reading text and microphone audio go to
OpenAI and require internet and billable API usage. It resets OFF on reload.
The original browser voices remain preferred for reading, including working
English/French voices. When enabled, missing/failed browser voices fall back to
gpt-4o-mini-tts (coral). Nepali/Urdu/Swahili use MediaRecorder and whisper-1;
recordings are limited to 30 seconds/2 MB, and transcription is a draft requiring
review and Send. No new API key or provider account is needed. The server key
stays on the server. This app does not save or log raw recordings. Existing
provider data policies still apply. Generated voices are explicitly disclosed
as AI. Language switching, hiding the page and disabling AI cancel recordings
and release the microphone; stale results are ignored. Playback has native
controls if the browser blocks autoplay. An in-memory bounded audio cache avoids
repeat charges for recent identical narration in the same page session.

The build performs a synthetic TTS-to-STT round trip in Nepali, Urdu and Swahili
when the server key is available. This checks provider access and response
language, not classroom microphone quality or native pronunciation. Physical
speaker/microphone and native-speaker quality review remain necessary. Browser
voice counts continue to describe browser voices only; AI has separate status.
The original mobile sample and shared pc/audio-tools.mjs remain unchanged.
