import crypto from "node:crypto";

export const SESSION_COOKIE = "gem_student_session";
const SESSION_MAX_AGE = 12 * 60 * 60;
export const SESSION_ABSOLUTE_MAX_AGE = 12 * 60 * 60;

function getSigningKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return crypto.createHash("sha256").update(`gem-student-session-v1:${apiKey}`).digest();
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(encodedPayload) {
  const key = getSigningKey();
  if (!key) return null;
  return crypto.createHmac("sha256", key).update(encodedPayload).digest("base64url");
}

function parseCookies(header) {
  return String(header || "").split(";").reduce((cookies, item) => {
    const separator = item.indexOf("=");
    if (separator < 0) return cookies;
    const name = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (name) cookies[name] = value;
    return cookies;
  }, {});
}

export function createSessionToken(student) {
  const now = Math.floor(Date.now() / 1000);
  // Preserve the original authentication time when a signed session is
  // updated. Without this absolute boundary, start/restart/end actions could
  // keep renewing the same login forever.
  const savedAuthenticationTime = Number(student?.authenticatedAt ?? student?.iat);
  const authenticatedAt = Number.isSafeInteger(savedAuthenticationTime)
    && savedAuthenticationTime > 0
    && savedAuthenticationTime <= now
    ? savedAuthenticationTime
    : now;
  const absoluteExpiry = authenticatedAt + SESSION_ABSOLUTE_MAX_AGE;
  if (absoluteExpiry <= now) return null;
  const payload = {
    id: String(student.id || "").slice(0, 20),
    name: String(student.name || "학생").slice(0, 80),
    session: String(student.session || "").slice(0, 80),
    courseId: student.courseId ? String(student.courseId).slice(0, 40) : null,
    courseRunId: student.courseRunId ? String(student.courseRunId).slice(0, 80) : null,
    startedAt: student.startedAt || null,
    endedAt: student.endedAt || null,
    authenticatedAt,
    iat: now,
    exp: Math.min(now + SESSION_MAX_AGE, absoluteExpiry)
  };
  const encoded = encode(JSON.stringify(payload));
  const signature = sign(encoded);
  return signature ? `${encoded}.${signature}` : null;
}

export function readStudentSession(request) {
  const token = parseCookies(request.headers?.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (!expected) return null;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(decode(encoded));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.id || !payload.session || !payload.exp || payload.exp <= now) return null;
    // Tokens issued before authenticatedAt was introduced use their original
    // iat as the absolute-login timestamp. This keeps existing cookies usable
    // without allowing their next save to restart the twelve-hour window.
    const authenticatedAt = Number(payload.authenticatedAt ?? payload.iat);
    if (!Number.isSafeInteger(authenticatedAt) || authenticatedAt <= 0 || authenticatedAt > now) return null;
    const absoluteExpiry = authenticatedAt + SESSION_ABSOLUTE_MAX_AGE;
    if (absoluteExpiry <= now || Number(payload.exp) > absoluteExpiry) return null;
    payload.authenticatedAt = authenticatedAt;
    return payload;
  } catch (_) {
    return null;
  }
}

export function setStudentSession(response, student) {
  const token = createSessionToken(student);
  if (!token) return false;
  const encodedPayload = token.split(".")[0];
  let remainingAge = 0;
  try {
    const payload = JSON.parse(decode(encodedPayload));
    remainingAge = Math.max(0, Number(payload.exp) - Math.floor(Date.now() / 1000));
  } catch (_) {
    return false;
  }
  if (!Number.isSafeInteger(remainingAge) || remainingAge <= 0) return false;
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Max-Age=${remainingAge}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
  return true;
}

export function clearStudentSession(response) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

export function isActiveCourseSession(student, courseId) {
  const requestedCourseId = String(courseId || "");
  return Boolean(
    student?.session
    && requestedCourseId
    && student.courseId === requestedCourseId
    && !student.endedAt
  );
}

export function isActiveCourseRun(student, courseId, courseRunId) {
  const requestedRunId = String(courseRunId || "");
  return isActiveCourseSession(student, courseId)
    && Boolean(requestedRunId)
    && student.courseRunId === requestedRunId;
}

export function requireStudentSession(request, response) {
  const student = readStudentSession(request);
  if (student) return student;
  response.status(401).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ error: "등록된 학생 ID로 먼저 입장해 주세요." }));
  return null;
}
