import { requireStudentSession } from "../lib/student-session.js";

const MAX_TEXT_LENGTH = 1800;
const NUMBERS = {1:"un",2:"deux",3:"trois",4:"quatre",5:"cinq",6:"six",7:"sept",8:"huit",9:"neuf",10:"dix"};

function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cleanText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```\w*|```/g, ""))
    .replace(/\*\*|__|`|#+\s?/g, "")
    .replace(/^\s*Activit[eé]\s*(\d{1,2})\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gim, (_, n) => `Question ${NUMBERS[Number(n)] || n}.`)
    .replace(/^\s*R[eé]ponse\s*:\s*\([ _]{3,}\)\s*$/gim, "")
    .replace(/_{4,}/g, " ")
    .replace(/×|\*/g, " fois ")
    .replace(/÷/g, " divisé par ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Seules les requêtes POST sont acceptées." });
  }
  if (!requireStudentSession(req, res)) return;
  const apiKey = process.env.OPENAI_API_KEY;
  const input = cleanText(req.body?.text);
  if (!apiKey || !input) return sendJson(res, 400, { error: "Il n'y a aucun texte à lire." });

  try {
    const result = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input,
        instructions: "Parle uniquement en français standard, naturellement, chaleureusement et un peu lentement, comme un professeur de mathématiques de CE2. Prononce le signe de multiplication comme « fois ». Ne lis jamais le Markdown, les blancs visuels, les champs de réponse ni les compteurs de leçon.",
        response_format: "mp3"
      })
    });
    if (!result.ok) return sendJson(res, 502, { error: "La voix du professeur n'a pas pu être créée." });
    const audio = Buffer.from(await result.arrayBuffer()).toString("base64");
    return sendJson(res, 200, { audio, mimeType: "audio/mpeg" });
  } catch (error) {
    console.error("CE2 speech error", error);
    return sendJson(res, 500, { error: "Un problème de connexion vocale est survenu." });
  }
}
