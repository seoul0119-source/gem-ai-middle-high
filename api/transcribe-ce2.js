import { requireStudentSession } from "../lib/student-session.js";

const MAX_BASE64_LENGTH = 5_500_000;

function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Seules les requêtes POST sont acceptées." });
  }
  if (!requireStudentSession(req, res)) return;
  const apiKey = process.env.OPENAI_API_KEY;
  const base64 = String(req.body?.audio || "");
  if (!apiKey || !base64 || base64.length > MAX_BASE64_LENGTH) {
    return sendJson(res, 400, { error: "Donne une réponse courte une nouvelle fois." });
  }

  try {
    const mimeType = String(req.body?.mimeType || "audio/webm").split(";")[0];
    const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
    const context = String(req.body?.context || "").replace(/\s+/g, " ").slice(-420);
    const audioBuffer = Buffer.from(base64, "base64");
    const keywords = [...new Set((context.match(/[A-Za-zÀ-ÿœŒæÆ]{2,}|\d+/g) || []).slice(-20))];

    function formFor(model) {
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type: mimeType }), `eleve.${extension}`);
      form.append("model", model);
      form.append("response_format", "json");
      form.append("prompt", "Un élève de CE2 répond en français à une courte question de multiplication. Transcris uniquement sa réponse parlée, sans rien ajouter.");
      if (model === "gpt-transcribe") {
        form.append("languages[]", "fr");
        keywords.forEach((k) => form.append("keywords[]", k));
      } else {
        form.append("language", "fr");
      }
      return form;
    }

    async function request(model) {
      const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formFor(model)
      });
      return { result, data: await result.json() };
    }

    let { result, data } = await request("gpt-transcribe");
    if (!result.ok && [400,403,404].includes(result.status)) ({ result, data } = await request("gpt-4o-transcribe"));
    if (!result.ok || !data.text?.trim()) return sendJson(res, 502, { error: "Je n'ai pas compris ta réponse. Dis-la une nouvelle fois." });

    const text = data.text.trim();
    if (text.length > 220 || /Transcris uniquement|élève de CE2 répond/i.test(text)) {
      return sendJson(res, 422, { error: "Je n'ai pas bien entendu. Donne seulement une réponse courte." });
    }
    return sendJson(res, 200, { text });
  } catch (error) {
    console.error("CE2 transcription error", error);
    return sendJson(res, 500, { error: "Un problème de reconnaissance vocale est survenu." });
  }
}
