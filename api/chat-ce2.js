import { readStudentSession, requireStudentSession } from "../lib/student-session.js";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
const MAX_MESSAGES = 40;

const CE2_PROMPT = `Tu es le professeur avatar de mathématiques, chaleureux, calme et encourageant, pour la classe pilote CE2 de GEM AI Learning Mission Class International.

[Langue]
- Enseigne uniquement en français standard, avec des phrases courtes adaptées à des élèves de CE2.
- N'utilise pas de coréen ni d'anglais, sauf si l'élève demande explicitement une traduction.
- Ne demande jamais le nom, l'école, l'adresse, le téléphone, l'e-mail, une photo ou toute autre donnée personnelle.

[Programme pilote]
- Travaille les bases de la multiplication : groupes égaux, additions répétées, rangées et colonnes, tables simples, facteur manquant, suites numériques et problèmes concrets.
- Utilise des nombres entiers et des situations familières : pommes, livres, crayons, boîtes, animaux et objets de classe.
- Pour les activités 1 à 3, privilégie les facteurs de 1 à 5 et des résultats ne dépassant pas 25.
- Ensuite, utilise progressivement les tables jusqu'à 10 si l'élève réussit.
- Ne propose ni fractions, ni nombres décimaux, ni nombres négatifs, ni algèbre.
- Vérifie mentalement chaque réponse avant de présenter l'activité.

[Variété obligatoire]
- Une leçon contient 10 activités, une seule à la fois.
- Alterne au moins six familles parmi : groupes égaux, addition répétée, rangées/colonnes, facteur manquant, calcul direct, suite numérique, vrai/faux, description d'image vers une opération, petit problème concret.
- N'utilise jamais la même famille deux fois de suite.
- Si une nouvelle activité ne change que les nombres ou les objets par rapport à une activité précédente, jette-la et crée une structure différente.
- Commence chaque activité exactement par « Activité n/10 — [famille] ».

[Démarrage]
- Si l'élève dit ou écrit « Start », « Démarrer », « Commencer », « 시작 » ou « 시작하기 », réponds : « Bonjour ! Je suis ton professeur avatar GEM AI. Nous allons apprendre les multiplications pas à pas. »
- Dans la même réponse, présente immédiatement Activité 1/10.
- La réponse de démarrage doit contenir uniquement cette salutation et une seule activité. Elle se termine par « Réponse : (________) » puis tu attends.
- Ne donne jamais de félicitations, de correction, d'explication, de résultat ou d'Activité 2 dans la réponse de démarrage.

[Une activité à la fois]
- Pose une seule question et attends la vraie réponse de l'élève.
- Préfère une consigne unique et une question de moins de 25 mots.
- La réponse attendue doit être un nombre, vrai/faux, une lettre de choix ou une très courte expression.
- Ne demande pas une justification abstraite.
- Pour un QCM, affiche exactement trois choix complets : A), B), C), avec une seule bonne réponse.
- Ne place jamais la réponse correcte, une équation déjà complétée avec les mêmes nombres, ni un indice révélateur dans l'énoncé.
- Termine toute activité qui attend une réponse par exactement « Réponse : (________) ».

[Protection de la réponse]
- Avant la réponse de l'élève, ne dis ni n'écris jamais le résultat final, la bonne lettre, une équation complétée, une phrase comme « la réponse est… », ni un exemple qui contient directement la réponse.
- Si la reconnaissance vocale est floue, ne devine pas. Dis seulement : « Je n'ai pas bien compris. Donne une réponse courte une nouvelle fois. » et reste sur la même activité.

[Correction et indices]
- Bonne réponse : une courte félicitation, une phrase d'explication, puis l'activité suivante.
- Première erreur : un indice concret sans aucun résultat final.
- Deuxième erreur : un indice plus guidé sans donner le résultat final.
- Troisième erreur : explique la solution puis propose une nouvelle petite question de vérification.
- Si l'élève demande « indice », « aide », « je ne sais pas », « répète » ou « encore », reste sur l'activité actuelle.
- Un indice demandé contient une seule piste concrète et ne contient jamais le résultat, la bonne lettre, une équation complète, la note, l'activité suivante ou une nouvelle ligne de réponse.

[Fin]
- Après l'activité 10, donne un bref résumé d'un point réussi et d'un point à revoir.
- Ne prétends pas délivrer une note officielle, un diplôme ou une certification.
- Cette classe est utilisée avec un parent, un enseignant ou un facilitateur présent. Le professeur humain reste responsable.`;

function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-MAX_MESSAGES)
    .filter((m) => m && ["user", "assistant"].includes(m.role))
    .map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 3000) }))
    .filter((m) => m.content.trim());
}

function getOutputText(data) {
  return data.output_text || data.output
    ?.flatMap((item) => item.content || [])
    ?.filter((item) => item.type === "output_text")
    ?.map((item) => item.text)
    ?.join("\n")
    ?.trim();
}

function latestUser(messages) {
  return [...messages].reverse().find((m) => m.role === "user")?.content || "";
}

function latestAssistant(messages) {
  return [...messages].reverse().find((m) => m.role === "assistant")?.content || "";
}

function isStart(text) {
  return /^(?:start|d[eé]marrer|commencer|시작|시작하기)[.! ]*$/i.test(String(text).trim());
}

function isHint(text) {
  return /\b(?:indice|aide|help|hint|je\s+ne\s+sais\s+pas|je\s+ne\s+comprends\s+pas|r[eé]p[eè]te|encore)\b/i.test(String(text))
    || /(?:힌트|모르겠|도와|도움)/i.test(String(text));
}

function safeHint(messages) {
  const q = latestAssistant(messages);
  if (/vrai|faux/i.test(q)) return "Calcule d'abord la multiplication, puis compare avec l'égalité proposée.";
  if (/suite|nombre manquant|compl[eè]te/i.test(q)) return "Regarde de combien les nombres augmentent à chaque étape, puis continue une seule étape.";
  if (/A\)|B\)|C\)/.test(q)) return "Calcule d'abord sans regarder les lettres, puis choisis la proposition qui correspond à ton résultat.";
  if (/rang[eé]e|colonne|groupe|bo[iî]te|panier|image/i.test(q)) return "Compte un groupe égal à la fois, sans en oublier.";
  if (/facteur|manquant|combien de groupes/i.test(q)) return "Représente les objets en groupes égaux et avance une petite étape à la fois.";
  return "Repère ce qui est donné et ce qu'il faut trouver, puis fais seulement la première petite étape.";
}

function normalize(text) {
  return String(text || "").toLowerCase()
    .replace(/activit[eé]\s*\d+\s*\/\s*10[^\n]*/gi, "")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, "")
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ#]/gi, "")
    .slice(0, 300);
}

function ensureAnswerSlot(text, suppress = false) {
  let out = String(text || "").trim();
  if (suppress) return out.replace(/^\s*R[eé]ponse\s*:\s*\([ _]{3,}\)\s*$/gim, "").trim();
  out = out.replace(/^\s*(?:Answer|답|정답)\s*:\s*.*$/gim, "Réponse : (________)");
  if (/R[eé]ponse\s*:\s*\([ _]{3,}\)/i.test(out)) return out;
  if (/Activit[eé]\s*\d+\s*\/\s*10/i.test(out) || /(?:essaie|r[eé]ponds|donne ta r[eé]ponse)/i.test(out)) {
    return `${out}\n\nRéponse : (________)`;
  }
  return out;
}

function invalidStart(text) {
  const out = String(text || "");
  const activities = [...out.matchAll(/Activit[eé]\s*\d+\s*\/\s*10/gi)].map((m) => m[0]);
  return activities.length !== 1 || !/Activit[eé]\s*1\s*\/\s*10/i.test(out)
    || /Activit[eé]\s*2\s*\/\s*10/i.test(out)
    || /(?:bravo|bien jou[eé]|bonne r[eé]ponse|la r[eé]ponse est|r[eé]sultat est)/i.test(out);
}

function revealsAnswer(text) {
  return /(?:la\s+(?:bonne\s+)?r[eé]ponse\s+est|choisis\s+[A-C]|option\s+[A-C]|r[eé]sultat\s+est|[=＝]\s*\d+)/i.test(String(text || ""));
}

async function handleChat(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Seules les requêtes POST sont acceptées." });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return sendJson(res, 503, { error: "Le moteur de la classe n'est pas encore disponible." });

  const messages = sanitizeMessages(req.body?.messages);
  if (!messages.length) return sendJson(res, 400, { error: "Écris une réponse pour continuer la leçon." });
  const userText = latestUser(messages);
  const hint = isHint(userText);
  if (hint) return sendJson(res, 200, { text: safeHint(messages) });

  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-50).map(String) : [];
  const signatures = new Set(history.map(normalize).filter(Boolean));
  const historyRule = history.length
    ? `\n\n[Activités précédentes — ne pas répéter]\n${history.map((h, i) => `${i + 1}. ${h.slice(0, 500)}`).join("\n")}\nCrée une structure différente, pas seulement d'autres nombres ou objets.`
    : "";
  const voiceRule = req.body?.inputMode === "voice"
    ? "\n\n[Réponse reconnue par la voix]\nSi la réponse semble floue ou sans rapport, ne la note pas comme fausse et ne révèle jamais la réponse. Demande seulement une réponse courte une nouvelle fois."
    : "";
  const start = isStart(userText);

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const repair = attempt ? "\n\n[Vérification finale]\nUne seule activité. Aucun résultat révélé avant la réponse de l'élève. Tout QCM contient exactement A), B), C). Toute activité qui attend l'élève finit par Réponse : (________)." : "";
      const result = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          instructions: CE2_PROMPT + historyRule + voiceRule + repair,
          input: messages,
          max_output_tokens: 650
        })
      });
      const data = await result.json();
      if (!result.ok) {
        console.error("CE2 OpenAI error", result.status, data?.error?.code);
        return sendJson(res, 502, { error: "Le professeur IA est momentanément indisponible." });
      }
      let text = getOutputText(data);
      if (!text) continue;
      if (start && invalidStart(text)) continue;
      if (revealsAnswer(text) && !messages.some((m, i) => i < messages.length - 1 && m.role === "user" && /\d+|vrai|faux|[abc]/i.test(m.content))) continue;
      if (/A\)[^\n]*\nB\)[^\n]*\nC\)\s*$/im.test(text)) continue;
      text = ensureAnswerSlot(text);
      const sig = normalize(text);
      if (!sig || !signatures.has(sig)) return sendJson(res, 200, { text });
    }
    return sendJson(res, 502, { error: "Préparons une nouvelle activité." });
  } catch (error) {
    console.error("CE2 chat error", error);
    return sendJson(res, 500, { error: "Un problème de connexion est survenu pendant la leçon." });
  }
}

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz6LIvJEhy9KXQbpTghGRaAXtjL03HltJF7Lb4leU6v_q0bkoBsjMkhN-Q8laeT27zDdQ/exec";
const MAX_BASE64_LENGTH = 5_500_000;

async function trackCe2(student, action) {
  const url = new URL(APPS_SCRIPT_URL);
  const params = action === "start"
    ? { action:"start", session:student.session, sessionId:student.session, subject:"Mathématiques", course:"Mathématiques", level:"CE2", grade:"CE2" }
    : { action:"end", session:student.session, sessionId:student.session };
  Object.entries(params).forEach(([key,value]) => url.searchParams.set(key, String(value)));
  const result = await fetch(url, { redirect:"follow", headers:{ Accept:"text/html,application/xhtml+xml" } });
  if (!result.ok) throw new Error("Le suivi de la leçon n'est pas disponible.");
}

function cleanSpeechText(value) {
  const numbers = {1:"un",2:"deux",3:"trois",4:"quatre",5:"cinq",6:"six",7:"sept",8:"huit",9:"neuf",10:"dix"};
  return String(value || "")
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*|```/g, ""))
    .replace(/\*\*|__|`|#+\s?/g, "")
    .replace(/^\s*Activit[eé]\s*(\d{1,2})\s*\/\s*10\s*(?:[—–-]\s*[^\n]*)?\s*$/gim, (_, n) => `Question ${numbers[Number(n)] || n}.`)
    .replace(/^\s*R[eé]ponse\s*:\s*\([ _]{3,}\)\s*$/gim, "")
    .replace(/_{4,}/g, " ")
    .replace(/×|\*/g, " fois ")
    .replace(/÷/g, " divisé par ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1800);
}

async function handleSpeech(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  const input = cleanSpeechText(req.body?.text);
  if (!apiKey || !input) return sendJson(res, 400, { error: "Il n'y a aucun texte à lire." });
  try {
    const result = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts", voice: "marin", input,
        instructions: "Parle uniquement en français standard, naturellement, chaleureusement et un peu lentement, comme un professeur de mathématiques de CE2. Prononce le signe de multiplication comme « fois ». Ne lis jamais le Markdown, les blancs visuels, les champs de réponse ni les compteurs de leçon.",
        response_format: "mp3"
      })
    });
    if (!result.ok) return sendJson(res, 502, { error: "La voix du professeur n'a pas pu être créée." });
    const audio = Buffer.from(await result.arrayBuffer()).toString("base64");
    return sendJson(res, 200, { audio, mimeType:"audio/mpeg" });
  } catch (error) {
    console.error("CE2 speech error", error);
    return sendJson(res, 500, { error:"Un problème de connexion vocale est survenu." });
  }
}

async function handleTranscribe(req, res) {
  const apiKey = process.env.OPENAI_API_KEY;
  const base64 = String(req.body?.audio || "");
  if (!apiKey || !base64 || base64.length > MAX_BASE64_LENGTH) return sendJson(res, 400, { error:"Donne une réponse courte une nouvelle fois." });
  try {
    const mimeType = String(req.body?.mimeType || "audio/webm").split(";")[0];
    const extension = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";
    const context = String(req.body?.context || "").replace(/\s+/g," ").slice(-420);
    const audioBuffer = Buffer.from(base64,"base64");
    const keywords = [...new Set((context.match(/[A-Za-zÀ-ÿœŒæÆ]{2,}|\d+/g) || []).slice(-20))];
    function formFor(model) {
      const form = new FormData();
      form.append("file", new Blob([audioBuffer], { type:mimeType }), `eleve.${extension}`);
      form.append("model", model); form.append("response_format", "json");
      form.append("prompt", "Un élève de CE2 répond en français à une courte question de multiplication. Transcris uniquement sa réponse parlée, sans rien ajouter.");
      if (model === "gpt-transcribe") { form.append("languages[]","fr"); keywords.forEach(k => form.append("keywords[]",k)); }
      else form.append("language","fr");
      return form;
    }
    async function request(model) {
      const result = await fetch("https://api.openai.com/v1/audio/transcriptions", { method:"POST", headers:{ Authorization:`Bearer ${apiKey}` }, body:formFor(model) });
      return { result, data:await result.json() };
    }
    let { result, data } = await request("gpt-transcribe");
    if (!result.ok && [400,403,404].includes(result.status)) ({ result, data } = await request("gpt-4o-transcribe"));
    if (!result.ok || !data.text?.trim()) return sendJson(res, 502, { error:"Je n'ai pas compris ta réponse. Dis-la une nouvelle fois." });
    const text = data.text.trim();
    if (text.length > 220 || /Transcris uniquement|élève de CE2 répond/i.test(text)) return sendJson(res, 422, { error:"Je n'ai pas bien entendu. Donne seulement une réponse courte." });
    return sendJson(res, 200, { text });
  } catch (error) {
    console.error("CE2 transcription error", error);
    return sendJson(res, 500, { error:"Un problème de reconnaissance vocale est survenu." });
  }
}

export default async function handler(req, res) {
  const action = String(req.method === "GET" ? req.query?.action || "session" : req.body?.action || "chat");
  if (req.method === "GET") {
    if (action !== "session") return sendJson(res, 400, { error:"Action non prise en charge." });
    const student = readStudentSession(req);
    if (!student) return sendJson(res, 401, { error:"Connecte-toi d'abord avec un identifiant d'élève enregistré." });
    return sendJson(res, 200, { authenticated:true, student:{ id:student.id, name:student.name } });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error:"Requête non prise en charge." });
  }
  const student = requireStudentSession(req, res);
  if (!student) return;
  if (action === "session-start" || action === "session-end") {
    try { await trackCe2(student, action === "session-start" ? "start" : "end"); return sendJson(res, 200, { success:true }); }
    catch (error) { console.error("CE2 tracking error", error); return sendJson(res, 502, { error:"Le suivi de la leçon est momentanément indisponible." }); }
  }
  if (action === "speech") return handleSpeech(req, res);
  if (action === "transcribe") return handleTranscribe(req, res);
  return handleChat(req, res);
}
