import test from "node:test";
import assert from "node:assert/strict";
import { serveStudentPage } from "../lib/student-page.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

const originalKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "student-page-test-only";
test.after(() => {
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
});
function response() {
  return { headers: {}, status(code) { this.code = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end(body = "") { this.body = body; return this; } };
}
test("all classroom URLs deny missing or forged cookies even with shared student parameters", async () => {
  for (const page of ["class", "learn", "learn-fr", "english", "suneung", "international-en", "international-fr", "emma-test"]) {
    for (const cookie of ["", `${SESSION_COOKIE}=forged.signature`]) {
      const res = response();
      await serveStudentPage({ method: "GET", headers: { cookie }, query: { page, id: "R269991", session: "shared" } }, res);
      assert.equal(res.code, 303);
      assert.equal(res.headers.Location, "/");
      assert.equal(res.body, "");
      assert.match(res.headers["Cache-Control"], /no-store/);
    }
  }
});
test("valid login serves the classroom; tampered, expired and traversal requests fail", async () => {
  const token = createSessionToken({ id: "R269991", session: "test-session" });
  const req = { method: "GET", headers: { cookie: `${SESSION_COOKIE}=${token}` }, query: { page: "class" } };
  const res = response();
  await serveStudentPage(req, res);
  assert.equal(res.code, 200);
  assert.match(res.body, /초·중·고 개인 맞춤형 AI 학습/);
  const now = Date.now;
  try {
    Date.now = () => now() + 13 * 3600 * 1000;
    const expired = response();
    await serveStudentPage(req, expired);
    assert.equal(expired.code, 303);
  } finally { Date.now = now; }
  for (const page of ["../index", ["class", "index"]]) {
    const denied = response();
    await serveStudentPage({ ...req, query: { page } }, denied);
    assert.equal(denied.code, 404);
  }
});
