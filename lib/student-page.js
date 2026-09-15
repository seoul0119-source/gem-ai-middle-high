import { readFile } from "node:fs/promises";
import { readStudentSession } from "./student-session.js";

const pages = new Set(["class", "learn", "learn-fr", "english", "suneung", "international-en", "international-fr", "emma-test"]);

export async function serveStudentPage(request, response) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("Vary", "Cookie");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const page = request.query?.page;
  if (typeof page !== "string" || !pages.has(page)) {
    response.status(404).end("Not found");
    return;
  }
  // A shared URL (including old id/name/session parameters) is never proof
  // of login. Only the server-verified HttpOnly cookie grants admission.
  if (!readStudentSession(request)) {
    response.setHeader("Location", "/");
    response.status(303).end();
    return;
  }
  try {
    const html = await readFile(new URL(`../${page}.html`, import.meta.url), "utf8");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(200).end(request.method === "HEAD" ? "" : html);
  } catch (_) {
    response.status(503).end("교실을 준비하지 못했습니다. 잠시 후 다시 입장해 주세요.");
  }
}
