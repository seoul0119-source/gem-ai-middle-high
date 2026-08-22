import { readStudentSession, requireStudentSession } from "../lib/student-session.js";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz6LIvJEhy9KXQbpTghGRaAXtjL03HltJF7Lb4leU6v_q0bkoBsjMkhN-Q8laeT27zDdQ/exec";

function sendJson(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function track(student, action) {
  const url = new URL(APPS_SCRIPT_URL);
  const params = action === "start"
    ? { action:"start", session:student.session, sessionId:student.session, subject:"Mathématiques", course:"Mathématiques", level:"CE2", grade:"CE2" }
    : { action:"end", session:student.session, sessionId:student.session };
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, String(v)));
  const result = await fetch(url, { redirect:"follow", headers:{ Accept:"text/html,application/xhtml+xml" } });
  if (!result.ok) throw new Error("Le suivi de la leçon n'est pas disponible.");
  return true;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
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
  const action = String(req.body?.action || "");
  try {
    if (action === "start") { await track(student, "start"); return sendJson(res, 200, { success:true }); }
    if (action === "end") { await track(student, "end"); return sendJson(res, 200, { success:true }); }
    return sendJson(res, 400, { error:"Action non prise en charge." });
  } catch (error) {
    console.error("CE2 tracking error", error);
    return sendJson(res, 502, { error:"Le suivi de la leçon est momentanément indisponible." });
  }
}
