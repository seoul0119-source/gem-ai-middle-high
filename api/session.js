import { getCourse } from "./courses.js";
import {
  clearStudentSession,
  readStudentSession,
  requireStudentSession,
  setStudentSession
} from "../lib/student-session.js";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz6LIvJEhy9KXQbpTghGRaAXtjL03HltJF7Lb4leU6v_q0bkoBsjMkhN-Q8laeT27zDdQ/exec";

function sendJson(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function getBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  try {
    return JSON.parse(String(request.body || "{}"));
  } catch (_) {
    return {};
  }
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractUserHtml(wrapper) {
  const body = String(wrapper || "");
  const match = body.match(/"userHtml"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!match) return decodeHtmlEntities(body);
  try {
    return decodeHtmlEntities(JSON.parse(`"${match[1]}"`));
  } catch (_) {
    return decodeHtmlEntities(match[1]
      .replace(/\\u003d/gi, "=")
      .replace(/\\u0026/gi, "&")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"'));
  }
}

function plainMessage(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

async function requestSheet(params) {
  const url = new URL(APPS_SCRIPT_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  const result = await fetch(url, {
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml" }
  });
  const body = await result.text();
  if (!result.ok) throw new Error("학생관리 시트 연결이 잠시 원활하지 않습니다.");
  const html = extractUserHtml(body);
  return { html, message: plainMessage(html) };
}

function findLoginRedirect(html, expectedId) {
  const normalized = String(html || "")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
  const match = normalized.match(/https:\/\/gem-ai-middle-high\.vercel\.app\/class\.html\?[^"'<>\s]+/i);
  if (!match) return null;
  try {
    const target = new URL(decodeHtmlEntities(match[0]));
    const id = String(target.searchParams.get("id") || "").toUpperCase();
    const name = String(target.searchParams.get("name") || "학생").trim();
    const session = String(target.searchParams.get("session") || "").trim();
    if (id !== expectedId || !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(session)) return null;
    return { id, name, session };
  } catch (_) {
    return null;
  }
}

async function loginStudent(rawId) {
  const id = String(rawId || "").trim().toUpperCase();
  if (!/^[A-Z][0-9]{6}$/.test(id)) {
    const error = new Error("학생 ID 형식을 확인해 주세요. 예: R260001");
    error.status = 400;
    throw error;
  }
  const result = await requestSheet({ action: "login", id });
  const student = findLoginRedirect(result.html, id);
  if (!student) {
    const error = new Error(/등록|학생|ID/i.test(result.message)
      ? result.message
      : "등록되지 않은 학생 ID입니다. 담당 선생님에게 확인해 주세요.");
    error.status = 401;
    throw error;
  }
  return student;
}

function courseLevel(course) {
  const match = course.title.match(/Lv\.(\d+)/i);
  return match ? `Lv.${match[1]}` : course.grade;
}

async function trackStart(student, courseId) {
  const course = getCourse(courseId);
  if (!course) {
    const error = new Error("올바른 과목을 선택해 주세요.");
    error.status = 400;
    throw error;
  }
  const result = await requestSheet({
    action: "start",
    session: student.session,
    sessionId: student.session,
    subject: course.subject,
    course: course.subject,
    level: courseLevel(course),
    grade: course.grade
  });
  if (/찾을\s*수\s*없|유효하지|실패|오류/.test(result.message)) {
    throw new Error("수업 시작 기록을 저장하지 못했습니다. 다시 입장해 주세요.");
  }
  return { course, message: result.message };
}

async function trackEnd(student) {
  if (!student?.session) return { message: "" };
  const result = await requestSheet({
    action: "end",
    session: student.session,
    sessionId: student.session
  });
  if (/찾을\s*수\s*없|유효하지|실패|오류/.test(result.message)) {
    throw new Error("수업 종료 기록을 저장하지 못했습니다.");
  }
  return result;
}

async function createFreshCourseSession(student, courseId) {
  if (student.courseId && !student.endedAt) await trackEnd(student);
  const fresh = await loginStudent(student.id);
  const tracking = await trackStart(fresh, courseId);
  return {
    ...fresh,
    courseId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    trackingMessage: tracking.message
  };
}

export default async function handler(request, response) {
  if (request.method === "GET") {
    const student = readStudentSession(request);
    if (!student) return sendJson(response, 401, { error: "등록된 학생 ID로 먼저 입장해 주세요." });
    return sendJson(response, 200, {
      authenticated: true,
      student: { id: student.id, name: student.name },
      courseId: student.courseId || null,
      startedAt: student.startedAt || null,
      endedAt: student.endedAt || null
    });
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return sendJson(response, 405, { error: "GET 또는 POST 요청만 사용할 수 있습니다." });
  }

  const body = getBody(request);
  const action = String(body.action || "login");

  try {
    if (action === "login") {
      const student = await loginStudent(body.studentId);
      if (!setStudentSession(response, student)) {
        return sendJson(response, 503, { error: "로그인 보안 설정을 준비하지 못했습니다." });
      }
      return sendJson(response, 200, {
        success: true,
        student: { id: student.id, name: student.name },
        redirect: "/class.html"
      });
    }

    const student = requireStudentSession(request, response);
    if (!student) return;

    if (action === "start") {
      const courseId = String(body.courseId || "");
      let active = student;
      let trackingMessage = "";
      if (student.endedAt || (student.courseId && student.courseId !== courseId)) {
        active = await createFreshCourseSession(student, courseId);
        trackingMessage = active.trackingMessage;
      } else if (!student.courseId || !student.startedAt) {
        const tracking = await trackStart(student, courseId);
        trackingMessage = tracking.message;
        active = {
          ...student,
          courseId,
          startedAt: new Date().toISOString(),
          endedAt: null
        };
      }
      setStudentSession(response, active);
      return sendJson(response, 200, {
        success: true,
        courseId: active.courseId,
        startedAt: active.startedAt,
        trackingMessage
      });
    }

    if (action === "restart") {
      const courseId = String(body.courseId || student.courseId || "");
      const active = await createFreshCourseSession(student, courseId);
      setStudentSession(response, active);
      return sendJson(response, 200, {
        success: true,
        courseId: active.courseId,
        startedAt: active.startedAt,
        trackingMessage: active.trackingMessage
      });
    }

    if (action === "end") {
      if (!student.endedAt) await trackEnd(student);
      const endedAt = student.endedAt || new Date().toISOString();
      setStudentSession(response, { ...student, endedAt });
      return sendJson(response, 200, { success: true, endedAt });
    }

    if (action === "logout") {
      if (!student.endedAt) await trackEnd(student).catch(() => null);
      clearStudentSession(response);
      return sendJson(response, 200, { success: true });
    }

    return sendJson(response, 400, { error: "올바른 세션 작업을 선택해 주세요." });
  } catch (error) {
    console.error("GEM student session error", action, error.message);
    return sendJson(response, error.status || 502, {
      error: error.message || "학생관리 연결 중 문제가 발생했습니다."
    });
  }
}
