import chatHandler from "./chat.js";
import { getCourse } from "./courses.js";
import { requireStudentSession } from "../lib/student-session.js";
import {
  isSchoolEnglishNoAnswerRequest,
  schoolEnglishNoAnswerResponse
} from "./_no-answer-guard.js";

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export default async function handler(request, response) {
  const course = getCourse(request.body?.courseId);
  const messages = Array.isArray(request.body?.messages) ? request.body.messages : [];

  if (course?.kind === "english" && isSchoolEnglishNoAnswerRequest(messages)) {
    if (!requireStudentSession(request, response)) return;
    return sendJson(response, 200, { text: schoolEnglishNoAnswerResponse() });
  }

  return chatHandler(request, response);
}
