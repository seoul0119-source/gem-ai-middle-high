# GEM shared-screen classroom preview

Built on the existing 2026-09-23 operator pilot at 2f32409. The original VRM and reviewed audio-v2 and diagnostic-v3 paths are preserved. Only the isolated preview is changed; never merge the preview root Vercel configuration into production.

## Teacher flow

A class of 20–30 learners shares one screen. The avatar automatically explains, asks, allows timed discussion, presents an activity and summarizes. The teacher can pause/continue or move forward/back. Start/End share one button. Final microphone recognition automatically submits one representative response; typed answers use Send. Interim-only recognition is retained for manual sending. There are no individual scores, attempt counters, quiz hints or materials-library controls. The legacy quiz auto checkbox stays disabled; the group phase scheduler owns progression. It waits for speech and microphone completion, freezes during pause, hidden tabs and dialogs, and does not discard a typed draft. A voice failure pauses progress and shows an always-visible recovery action. A new preview origin without online-voice consent exposes Enable voice; accepting replays the current phase from the user gesture. Errors and muted volume cannot remain hidden in collapsed settings. Discussion/activity dwell scales with the planned duration; this is not a verified exact-duration lesson. Settings and diagnostic controls are collapsed.

Country/curriculum, teaching language, GEM level 1–12 and general subject are independent fields. Changing language retains country, grade, subject, progress and time. Changing the lesson selection asks before resetting active progress. Settings persist only on the device. Class size defaults to 25. Lesson time defaults to 40 minutes and accepts 5–180 minutes; this is a GEM pilot choice, not a national standard or an automatic cutoff.

## Content availability and education policy

The only available reviewed prepared lesson is GEM common pilot / Grade 2 / Mathematics / addition to 20. Country selections and other grades/subjects can be saved, but cannot start an unrelated Grade 2 lesson. National curriculum mapping, local grade equivalences and future lesson content require source review before being marked ready. The country list is an extensible initial selection, not a claim of complete national curriculum coverage. No advanced courses are offered.

GEM's Reformed Christian education constraints remain in place, including exclusion of evolution, natural selection, common ancestry, Darwin and human evolution. The prepared pilot redirects matching questions to its current classroom activity. This is a narrow scope gate, not a claim that keyword filtering alone validates future AI output. There is no open-ended generative AI service in this preview. New curriculum modules must be reviewed against the content policy before being enabled.

## Build and verification

`npm run vercel-build` executes the existing baseline build and its original 3D, speech simulation and diagnostic tests first. It then copies the maintained group modules and adds the group integration to the generated app. Build transformations are intentionally confined to the build workspace; do not commit generated baseline files or mission-dist.

Group tests cover independent selection, unavailable lesson gating, persistence, custom duration, explanation-first sequencing, automatic transitions, pause protection, final microphone auto-send, representative class responses, excluded-topic redirection and four viewport sizes. Browser speech is simulated. Physical voice playback was confirmed by the operator on the previous pilot; this does not verify the updated preview on real mobile/TV devices or a full 40-minute class.

## Incremental media package, first problem

`gem-g2-math-join-4-3` adds a shared original diagram, an eight-second silent MP4 demonstration (embedded in a small JS asset), and a key-fact card. Each explanation scene has EN/FR narration. The same question persists through all three resources; automatic progression waits for narration and video completion. Pausing pauses video; failed playback falls back to the diagram. Summary opens a 30-second prepared-question window using the existing Send/microphone controls. This is prepared arithmetic support, not free generative AI. Further Grade 2 mathematics problems are next, followed by Grade 2 science; neither whole curriculum is complete. The existing 40-minute setting includes discussion/activity timing and remains an unvalidated approximate pilot duration, not a universal national curriculum.

The original diagram/video are generated from seven colored counters; no external third-party media is used. `spokenMath` spells small numbers and arithmetic in utterances to avoid ambiguous symbolic/measurement readings; device pronunciation still needs operator confirmation.
