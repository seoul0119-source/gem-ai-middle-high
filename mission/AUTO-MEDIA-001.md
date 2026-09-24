# Automatic board materials 001 — JOIN only

## Scope
This increment applies only to the existing generated `join` question (Join two groups / Réunir deux groupes). It does not fix a numerical problem such as 5+5 into every new lesson. Existing generator, New lesson/Continue distinction, language choice, other question types, 3D model, voice permissions, microphone input, confirmed End and display-v3 remain in place. Production main is not modified.

## What is displayed
1. Before the class answers: one automatically displayed image of the actual green/gold counter groups, with the total hidden and one brief fact. The avatar describes those same groups in the selected language.
2. After an answer or explicit request for an explanation: the same board automatically becomes an animated solution. The existing counters move together; none is created or removed. Movement begins at the corresponding narration cue and the joined group is shown when the teacher announces the total. There is no new image/video button to operate. This is an on-device SVG animation, not a streamed video file.

Pre-answer scenes do not reveal the answer. Incorrect responses still reveal the correct result and retain the existing teacher-review hold. Common pre-answer conceptual questions use a non-spoiling local explanation. Additional AI questions receive the current card description and the visible-answer state in their existing context request; the API endpoint itself is unchanged.

## Continue and New lesson
The material's progress is stored separately under a key containing the existing session ID and exact problem numbers. Pause, questions, language switching and reload preserve the frame; switching language changes only the text/narration, not the objects. Reload is paused. New lesson makes its existing new problem set; its different session ID prevents reusing an old solution frame. Storage remains same-origin/same-browser and can be unavailable if denied or cleared. This is not cross-device synchronization.

## Resource use
The added module is under 24 KB of source and performs no fetch, media download, external embed or added AI request. It reuses the local 3D/voice pipeline. Respect reduced-motion preference; use a still final solution instead of moving counters. No external student resource website or third-party media license is newly introduced by this increment.

## Tests
Pure tests check 100 valid number pairs and 2,100 intermediate frames for object-count conservation, bounds, local explanation correctness, non-spoiling initial content and lack of lesson mutation. Final browser tests load the real VRM, simulate only the speech service, exercise automatic material selection and speech cues, correction holds, Pause/question interruption, language/reload persistence, New lesson, one playback button and phone fullscreen. Full previous baseline/input/display suites are still run first. Actual hardware speaker/microphone quality and a full 40-minute classroom session require operator testing.

The provided Information for students document separates video resources (page 2) from pictures (page 3). This increment implements the user's requested on-board workflow with original numerical diagrams instead; it does not download or certify the external websites listed in that document.
