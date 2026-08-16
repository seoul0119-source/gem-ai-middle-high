import crypto from "node:crypto";

export const SESSION_COOKIE = "gem_student_session";
const SESSION_MAX_AGE = 12 * 60 * 60;

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
  const payload = {
    id: String(student.id || "").slice(0, 20),
    name: String(student.name || "학생").slice(0, 80),
    session: String(student.session || "").slice(0, 80),
    courseId: student.courseId ? String(student.courseId).slice(0, 40) : null,
    startedAt: student.startedAt || null,
    endedAt: student.endedAt || null,
    iat: now,
    exp: now + SESSION_MAX_AGE
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
    return payload;
  } catch (_) {
    return null;
  }
}

export function setStudentSession(response, student) {
  const token = createSessionToken(student);
  if (!token) return false;
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
  return true;
}

export function clearStudentSession(response) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
  );
}

export function requireStudentSession(request, response) {
  const student = readStudentSession(request);
  if (student) return student;
  response.status(401).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ error: "등록된 학생 ID로 먼저 입장해 주세요." }));
  return null;
}
