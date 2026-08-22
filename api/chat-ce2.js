import { requireStudentSession } from "../lib/student-session.js";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Seules les requêtes POST sont acceptées." });
  }
  if (!requireStudentSession(req, res)) return;
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
