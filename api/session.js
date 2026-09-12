import { getCourse } from "./courses.js";
import { randomUUID } from "node:crypto";
import { SCIENCE_VARIANT_PREFIX } from "../lib/suneung-science-variants.js";
import { createScienceLessonEngine } from "../lib/suneung-science-bank.js";
import { isGuardedSuneungScienceCourse } from "../lib/suneung-science-safety.js";
import {
  clearStudentSession,
  readStudentSession,
  isActiveCourseRun,
  requireStudentSession,
  setStudentSession
} from "../lib/student-session.js";

function scienceRunHistory(student) {
  return [...new Set([...(student.scienceRunHistory || []), isGuardedSuneungScienceCourse(student.courseId) ? student.courseRunId : ""])]
    .filter(id => typeof id === "string" && id.startsWith(SCIENCE_VARIANT_PREFIX) && id.length <= 80).slice(-20);
}

function newCourseRunId(courseId, student) {
  if (!isGuardedSuneungScienceCourse(courseId)) return randomUUID();
  const openingSignature = seed => {
    const first = createScienceLessonEngine(seed, courseId).questions[0];
    return JSON.stringify([first.stem, first.choices]);
  };
  const recentOpenings = new Set(scienceRunHistory(student).map(openingSignature));
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const seed = SCIENCE_VARIANT_PREFIX + randomUUID();
    if (!recentOpenings.has(openingSignature(seed))) return seed;
  }
  throw new Error("새 문제를 준비하지 못했습니다. 잠시 후 새 수업을 다시 눌러 주세요.");
}
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

function decodeJavaScriptHexEscapes(value) {
  return String(value || "").replace(/\\x([0-9a-f]{2})/gi, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16))
  );
}

function extractUserHtml(wrapper) {
  const body = String(wrapper || "");
  // Apps Script places its page configuration in the first JavaScript string
  // passed to goog.script.init(). Decode that outer string before parsing the
  // configuration JSON. Decoding \x22 globally first turns HTML attributes
  // into quotes and can make a userHtml regex stop in the middle of the page.
  const match = body.match(/goog\.script\.init\s*\(\s*("(?:\\.|[^"\\])*")/);
  if (!match) return decodeHtmlEntities(body);
  try {
    const literal = match[1].replace(/\\x([0-9a-f]{2})/gi, "\\u00$1");
    const configText = JSON.parse(literal);
    const config = JSON.parse(configText);
    if (typeof config?.userHtml === "string") {
      return decodeHtmlEntities(config.userHtml);
    }
  } catch (_) {
    // The caller's strict login/tracking validation rejects malformed wrappers.
  }
  return decodeHtmlEntities(body);
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
  return {
    html: `${html}\n${decodeJavaScriptHexEscapes(body)}`,
    message: plainMessage(html)
  };
}

function findLoginRedirect(html, expectedId) {
  const normalized = decodeHtmlEntities(decodeJavaScriptHexEscapes(html))
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\+\//g, "/");
  const match = normalized.match(/https:\/\/gem-ai-middle-high\.vercel\.app\/class\.html\?[^"'<>\\\s]+/i);
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

function requireCourse(courseId) {
  const normalizedCourseId = String(courseId || "");
  const course = getCourse(normalizedCourseId);
  if (!course) {
    const error = new Error("올바른 과목을 선택해 주세요.");
    error.status = 400;
    throw error;
  }
  return { courseId: normalizedCourseId, course };
}

export function isPositiveTrackingResponse(result, action) {
  const expectedAction = action === "start" || action === "end" ? action : "";
  if (!expectedAction) return false;

  const message = String(result?.message || "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!message || /찾을\s*수\s*없|할\s*수\s*없|유효하지|실패|오류|거부|않|못|아니|불가|미완료|보류|대기\s*중|unauthori[sz]ed|forbidden|error|fail|\b(?:not|never|incomplete|pending|unable|cannot)\b/i.test(message)) {
    return false;
  }

  try {
    const payload = JSON.parse(message);
    const responseAction = String(payload?.action || expectedAction).toLowerCase();
    if (payload?.success === true && responseAction === expectedAction) return true;
  } catch (_) {
    // The deployed Apps Script currently returns an HTML user message. JSON is
    // supported as an explicit future contract, but arbitrary HTML is not.
  }

  const actionWord = expectedAction === "start" ? "시작|입장" : "종료|퇴실";
  const englishAction = expectedAction === "start" ? "start(?:ed)?" : "end(?:ed)?|finish(?:ed)?";
  const koreanAction = new RegExp(`(?:수업|학습).{0,24}(?:${actionWord})|(?:${actionWord}).{0,24}(?:수업|학습)`);
  const koreanCompletedAction = new RegExp(`(?:수업|학습)(?:을|이|가)?\\s*(?:정상적으로\\s*)?(?:${actionWord})(?:했습니다|하였습니다|되었습니다|됐습니다)`);
  const koreanSuccess = /성공(?:했습니다)?|완료(?:되었습니다|됐습니다|했습니다|하였습니다)|(?:기록|저장|처리)(?:되었습니다|됐습니다|했습니다|하였습니다)|되었습니다|됐습니다/;
  const englishSuccess = new RegExp(`(?:${englishAction}).{0,32}(?:success|complete|saved|recorded|ok)|(?:success|complete|saved|recorded|ok).{0,32}(?:${englishAction})`, "i");
  return koreanCompletedAction.test(message)
    || (koreanAction.test(message) && koreanSuccess.test(message))
    || englishSuccess.test(message);
}

function assertPositiveTrackingResponse(result, action) {
  if (isPositiveTrackingResponse(result, action)) return;
  const error = new Error(action === "start"
    ? "수업 시작 기록을 저장하지 못했습니다. 다시 입장해 주세요."
    : "수업 종료 기록을 저장하지 못했습니다.");
  error.status = 502;
  throw error;
}

async function trackStart(student, courseId, validatedCourse = null) {
  const course = validatedCourse || requireCourse(courseId).course;
  const result = await requestSheet({
    action: "start",
    session: student.session,
    sessionId: student.session,
    subject: course.subject,
    course: course.subject,
    level: courseLevel(course),
    grade: course.grade
  });
  assertPositiveTrackingResponse(result, "start");
  return { course, message: result.message };
}

async function trackEnd(student) {
  if (!student?.session) return { message: "" };
  requireCourse(student.courseId);
  const result = await requestSheet({
    action: "end",
    session: student.session,
    sessionId: student.session
  });
  assertPositiveTrackingResponse(result, "end");
  return result;
}

async function createFreshCourseSession(student, courseId, course) {
  const courseRunId = newCourseRunId(courseId, student);
  if (student.courseId && !student.endedAt) {
    // Closing a previous page may already have ended this sheet row. Starting
    // the new page must still succeed if that best-effort end was duplicated.
    await trackEnd(student).catch((error) => {
      console.warn("Previous course tracking end could not be confirmed", error.message);
    });
  }
  const fresh = await loginStudent(student.id);
  const tracking = await trackStart(fresh, courseId, course);
  return {
    ...fresh,
    // loginStudent refreshes the sheet row, not the user's authentication.
    // Keep the signed cookie's original login boundary across course runs.
    authenticatedAt: student.authenticatedAt ?? student.iat,
    courseId,
    courseRunId,
    scienceRunHistory: scienceRunHistory(student),
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
      // Resolve the requested course before ending or starting any sheet row.
      // A stale/removed/forged course ID must never cause persistence changes.
      const { courseId, course } = requireCourse(body.courseId);
      let active = student;
      let trackingMessage = "";
      // Every learning-page load starts a fresh tracked row. This also avoids
      // reusing a row that a pagehide beacon has just ended without changing
      // the browser cookie.
      if (student.courseId || student.endedAt) {
        active = await createFreshCourseSession(student, courseId, course);
        trackingMessage = active.trackingMessage;
      } else if (!student.courseId || !student.startedAt) {
        const courseRunId = newCourseRunId(courseId, student);
        const tracking = await trackStart(student, courseId, course);
        trackingMessage = tracking.message;
        active = {
          ...student,
          courseId,
          courseRunId,
          scienceRunHistory: scienceRunHistory(student),
          startedAt: new Date().toISOString(),
          endedAt: null
        };
      }
      setStudentSession(response, active);
      return sendJson(response, 200, {
        success: true,
        courseId: active.courseId,
        courseRunId: active.courseRunId,
        startedAt: active.startedAt,
        trackingMessage
      });
    }

    if (action === "restart") {
      const { courseId, course } = requireCourse(body.courseId || student.courseId);
      const active = await createFreshCourseSession(student, courseId, course);
      setStudentSession(response, active);
      return sendJson(response, 200, {
        success: true,
        courseId: active.courseId,
        courseRunId: active.courseRunId,
        startedAt: active.startedAt,
        trackingMessage: active.trackingMessage
      });
    }

    if (action === "end" || action === "end-on-exit") {
      const courseId = String(body.courseId || "");
      const courseRunId = String(body.courseRunId || "");
      requireCourse(courseId);
      if (!isActiveCourseRun(student, courseId, courseRunId)) {
        if (action === "end-on-exit") {
          return sendJson(response, 200, { success: true, ignored: true });
        }
        return sendJson(response, 409, {
          error: "현재 수업과 종료 요청이 일치하지 않습니다."
        });
      }
      if (!student.endedAt) await trackEnd(student);
      const endedAt = student.endedAt || new Date().toISOString();
      // A pagehide response can arrive after the next page has already issued
      // a fresh active cookie. Never let that late response overwrite it.
      if (action === "end") setStudentSession(response, { ...student, endedAt });
      return sendJson(response, 200, { success: true, endedAt });
    }

    if (action === "logout") {
      if (student.courseId && getCourse(student.courseId) && !student.endedAt) {
        await trackEnd(student).catch(() => null);
      }
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
