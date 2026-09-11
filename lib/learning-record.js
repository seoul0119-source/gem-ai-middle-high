const RECORD_PATTERN = /\[GEM_RECORD\]\s*(\{[\s\S]*?\})\s*\[\/GEM_RECORD\]/gi;

function cleanLabel(value, maximumLength = 80) {
  return String(value || "")
    .replace(/[\[\]{}<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

export function extractLearningRecord(value, constraints = {}) {
  const source = String(value || "");
  const matches = [...source.matchAll(RECORD_PATTERN)];
  const text = source
    .replace(/\[GEM_RECORD\][\s\S]*?\[\/GEM_RECORD\]/gi, "")
    .replace(/\[GEM_RECORD\][\s\S]*$/gi, "")
    .replace(/\[\/GEM_RECORD\]/gi, "")
    .trim();

  for (const match of matches.reverse()) {
    try {
      const raw = JSON.parse(match[1]);
      const question = Number(raw.question);
      const attempts = Number(raw.attempts);
      const outcome = raw.outcome === "correct" || raw.outcome === "incorrect" ? raw.outcome : "";
      const rawStage = cleanLabel(raw.stage, 24);
      const topic = cleanLabel(raw.topic);
      const weakType = cleanLabel(raw.weakType);
      const rawScope = ["common", "elective", "direct"].includes(raw.scope) ? raw.scope : "";
      if (!Number.isInteger(question) || question < 1 || question > 10) continue;
      if (Number.isInteger(constraints.expectedQuestion) && question !== constraints.expectedQuestion) continue;
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) continue;
      if (!outcome || !rawStage || !topic || !rawScope) continue;
      if (outcome === "incorrect" && attempts !== 3) continue;
      if ((outcome === "incorrect" || attempts > 1) && !weakType) continue;
      const stage = cleanLabel(constraints.expectedStage, 24) || rawStage;
      const scope = ["common", "elective", "direct"].includes(constraints.expectedScope)
        ? constraints.expectedScope
        : rawScope;
      return { text, record: { question, stage, topic, scope, outcome, attempts, weakType } };
    } catch (_) {
      // Try an earlier complete block; every block is removed from display.
    }
  }
  return { text, record: null };
}
