import { readFile } from "node:fs/promises";
import { readStudentSession, assertStudentAccess } from "./student-session.js";
import { issueClassroomPass } from "./classroom-pass.js";
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
    const materialParams=new URLSearchParams({materials:'1'});
    for (const key of ['course','language','classroom','browse','worksheet','preparing','topic','start','question']) {
      const value=request.query?.[key];
      if (typeof value==='string'&&value.length<=160) materialParams.set(key,value);
    }
    response.setHeader("Location", page === "science-board" ? boardReturn : page === "whiteboard" ? "/?whiteboard=1&lang=" + language : page === "materials" ? "/?"+materialParams : "/");
    response.status(303).end();
    return;
  }
  try {
    await assertStudentAccess(student);
    let html = await readFile(new URL(`../${page}.html`, import.meta.url), "utf8");
    if (page === "materials") {
      // The page has just passed the authoritative membership check. Supply
      // its short-lived handoff now instead of checking the same Sheet again
      // from the browser. This is not a cached membership approval.
      const entry = JSON.stringify({ ticket: issueClassroomPass(student, "en") })
        .replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      html = html.replace('<script type="application/json" id="gem-entry-pass">null</script>',
        `<script type="application/json" id="gem-entry-pass">${entry}</script>`);
    }
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.status(200).end(request.method === "HEAD" ? "" : html);
  } catch (error) {
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.status(error.status || 503).end(error.status ? error.message : "교실을 준비하지 못했습니다. 잠시 후 다시 입장해 주세요.");
  }
}
