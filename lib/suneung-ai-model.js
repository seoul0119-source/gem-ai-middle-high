// CSAT tutoring has a separate model setting: the economical K–12 default
// must not silently override the operator's choice of a stronger CSAT teacher.
export const DEFAULT_SUNEUNG_MODEL = "gpt-6-astra";
export const SUNEUNG_FALLBACK_MODEL = "gpt-5.6-sol";

export function suneungModel() {
  return process.env.OPENAI_SUNEUNG_MODEL || DEFAULT_SUNEUNG_MODEL;
}

export async function requestSuneungResponse(body, { apiKey, signal } = {}) {
  const preferred = suneungModel();
  const models = preferred === DEFAULT_SUNEUNG_MODEL
    ? [preferred, SUNEUNG_FALLBACK_MODEL] : [preferred];
  for (const model of models) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ ...body, model, store: false, reasoning: { effort: "low" } })
    });
    const data = await response.json();
    if (response.ok) return { ok: true, status: response.status, data, model };
    // Only a model availability error permits a fallback, never rate limits,
    // expired credentials, malformed input, or an arbitrary provider failure.
    const unavailable = [403, 404].includes(response.status)
      && ["model_not_found", "model_not_available", "model_access_denied"].includes(data?.error?.code);
    if (unavailable && model !== models.at(-1)) {
      console.warn("CSAT preferred model unavailable; using supported fallback", { model, fallback: models.at(-1) });
      continue;
    }
    return { ok: false, status: response.status, data, model };
  }
}
