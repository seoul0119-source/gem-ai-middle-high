import { readFile } from "node:fs/promises";
import { readStudentSession, assertStudentAccess } from "./student-session.js";
import {isBoardCourse} from "../whiteboard/board-courses.js";

const pages = new Set(["class", "learn", "learn-fr", "english", "suneung", "international-en", "international-fr", "emma-test", "materials", "whiteboard", "science-board"]);

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
  const student=readStudentSession(request);
  if (!student) {
    const language = ['ko','en','fr'].includes(request.query?.lang) ? request.query.lang : 'ko';
    const boardCourse=typeof request.query?.course==='string'&&isBoardCourse(request.query.course)?request.query.course:'h3-science';
    const boardWorksheet=typeof request.query?.worksheet==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.query.worksheet)?request.query.worksheet:'';
    const boardReturn='/?scienceboard=1'+(boardCourse==='h3-science'?'':'&course='+encodeURIComponent(boardCourse))+(boardWorksheet?'&worksheet='+boardWorksheet:'');
    response.setHeader("Location", page === "science-board" ? boardReturn : page === "whiteboard" ? "/?whiteboard=1&lang=" + language : page === "materials" ? "/?materials=1" : "/");
    response.status(303).end();
    return;
  }
  try {
    await assertStudentAccess(student);
    const html = await readFile(new URL(`../${page}.html`, import.meta.url), "utf8");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(200).end(request.method === "HEAD" ? "" : html);
  } catch (error) {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(error.status || 503).end(error.status ? error.message : "교실을 준비하지 못했습니다. 잠시 후 다시 입장해 주세요.");
  }
}
