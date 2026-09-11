import assert from "node:assert/strict";
import test from "node:test";

import sessionHandler, { isPositiveTrackingResponse } from "../api/session.js";
import {
  createSessionToken,
  SESSION_ABSOLUTE_MAX_AGE,
  SESSION_COOKIE,
  setStudentSession
} from "../lib/student-session.js";

const originalApiKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "session-security-test-key";

test.after(() => {
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

function decodeToken(token) {
  return JSON.parse(Buffer.from(String(token).split(".")[0], "base64url").toString("utf8"));
}

function makeResponse() {
  return {
    body: "",
    headers: new Map(),
    statusCode: 0,
    status(value) {
      this.statusCode = value;
      return this;
    },
    setHeader(name, value) {
      this.headers.set(String(name).toLowerCase(), value);
      return this;
    },
    end(value = "") {
      this.body = String(value);
      return this;
    }
  };
}

function signedRequest(body, student = {}) {
  const token = createSessionToken({
    id: "R260001",
    name: "테스트 학생",
    session: "11111111-1111-4111-8111-111111111111",
    ...student
  });
  assert.ok(token);
  return {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
    body
  };
}

function appsScriptTrackingWrapper(message) {
  const userHtml = `
<!DOCTYPE html>
<html lang="ko"><body><main data-state="saved"><h1>GEM AI CLASS</h1><p>${message}</p></main></body></html>`;
  const configText = JSON.stringify({
    functionNames: ["doGet"],
    userHtml,
    ncc: "test"
  });
  const hexEncoded = new Set(["{", "}", "[", "]", '"', "<", ">", "="]);
  let encodedConfig = "";
  for (const character of configText) {
    if (character === "\\") encodedConfig += "\\\\";
    else if (hexEncoded.has(character)) {
      encodedConfig += `\\x${character.charCodeAt(0).toString(16).padStart(2, "0")}`;
    } else encodedConfig += character;
  }
  return `<!DOCTYPE html><html><body><script>goog.script.init("${encodedConfig}", "", undefined, true);</script></body></html>`;
}

test("accepts only an explicit sheet tracking success contract", () => {
  assert.equal(isPositiveTrackingResponse({ message: "수업 시작 기록이 저장되었습니다." }, "start"), true);
  assert.equal(isPositiveTrackingResponse({ message: "수업이 종료되었습니다." }, "end"), true);
  assert.equal(isPositiveTrackingResponse({ message: "수업을 시작했습니다." }, "start"), true);
  assert.equal(isPositiveTrackingResponse({ message: "학습을 정상적으로 종료했습니다." }, "end"), true);
  assert.equal(isPositiveTrackingResponse({ message: '{"success":true,"action":"start"}' }, "start"), true);
  assert.equal(isPositiveTrackingResponse({ message: '{"success":true,"action":"end"}' }, "start"), false);
  assert.equal(isPositiveTrackingResponse({ message: "Google Apps Script" }, "start"), false);
  assert.equal(isPositiveTrackingResponse({ message: "수업 시작 기록 저장 실패" }, "start"), false);
  assert.equal(isPositiveTrackingResponse({ message: "수업 시작이 완료되지 않았습니다." }, "start"), false);
  assert.equal(isPositiveTrackingResponse({ message: "수업 시작 완료" }, "start"), false);
  assert.equal(isPositiveTrackingResponse({ message: "start was not completed" }, "start"), false);
  assert.equal(isPositiveTrackingResponse({ message: "lesson end pending" }, "end"), false);
  assert.equal(isPositiveTrackingResponse({ message: "<html><body>unknown response</body></html>" }, "end"), false);
});

test("rejects a removed course before any sheet mutation", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch must not be called");
  };

  try {
    for (const body of [
      { action: "start", courseId: "removed-course" },
      { action: "restart", courseId: "removed-course" },
      { action: "end", courseId: "removed-course", courseRunId: "run-old" }
    ]) {
      const response = makeResponse();
      await sessionHandler(signedRequest(body, {
        courseId: "removed-course",
        courseRunId: "run-old",
        startedAt: new Date().toISOString(),
        endedAt: null
      }), response);
      assert.equal(response.statusCode, 400);
      assert.match(JSON.parse(response.body).error, /올바른 과목/);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not accept an unknown 2xx HTML sheet response", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      text: async () => "<html><body>Google Apps Script</body></html>"
    };
  };

  try {
    const response = makeResponse();
    await sessionHandler(signedRequest({ action: "start", courseId: "h3-math" }), response);
    assert.equal(fetchCalls, 1);
    assert.equal(response.statusCode, 502);
    assert.match(JSON.parse(response.body).error, /시작 기록을 저장하지 못했습니다/);
    assert.equal(response.headers.has("set-cookie"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("decodes the real Apps Script wrapper before validating a tracking success", async () => {
  const originalFetch = globalThis.fetch;
  const wrapper = appsScriptTrackingWrapper("수업 입장 기록이 저장되었습니다.");
  assert.match(wrapper, /html lang\\x3d\\\\\\x22ko\\\\\\x22/,
    "the fixture must retain Apps Script's quoted-attribute encoding trap");
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => wrapper
  });

  try {
    const response = makeResponse();
    await sessionHandler(signedRequest({ action: "start", courseId: "h3-math" }), response);
    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.courseId, "h3-math");
    assert.match(payload.courseRunId, /^[0-9a-f-]{36}$/i);
    assert.match(payload.trackingMessage, /수업 입장 기록이 저장되었습니다/);
    assert.equal(response.headers.has("set-cookie"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an invalid-session message decoded from the real Apps Script wrapper", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => appsScriptTrackingWrapper("수업 입장 기록을 찾을 수 없습니다.")
  });

  try {
    const response = makeResponse();
    await sessionHandler(signedRequest({ action: "start", courseId: "h3-math" }), response);
    assert.equal(response.statusCode, 502);
    assert.match(JSON.parse(response.body).error, /시작 기록을 저장하지 못했습니다/);
    assert.equal(response.headers.has("set-cookie"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves the original login time across cookie saves", () => {
  const now = Math.floor(Date.now() / 1000);
  const authenticatedAt = now - 60 * 60;
  const firstToken = createSessionToken({
    id: "R260001",
    name: "테스트 학생",
    session: "11111111-1111-4111-8111-111111111111",
    authenticatedAt
  });
  const firstPayload = decodeToken(firstToken);

  const refreshedToken = createSessionToken({
    ...firstPayload,
    courseId: "h3-math",
    courseRunId: "run-new"
  });
  const refreshedPayload = decodeToken(refreshedToken);

  assert.equal(firstPayload.authenticatedAt, authenticatedAt);
  assert.equal(firstPayload.exp, authenticatedAt + SESSION_ABSOLUTE_MAX_AGE);
  assert.equal(refreshedPayload.authenticatedAt, authenticatedAt);
  assert.equal(refreshedPayload.exp, firstPayload.exp);

  const response = makeResponse();
  assert.equal(setStudentSession(response, refreshedPayload), true);
  const cookie = response.headers.get("set-cookie");
  const remaining = Number(cookie.match(/Max-Age=(\d+)/)?.[1]);
  assert.ok(remaining > 0 && remaining <= SESSION_ABSOLUTE_MAX_AGE - 60 * 60);

  assert.equal(createSessionToken({
    ...refreshedPayload,
    authenticatedAt: now - SESSION_ABSOLUTE_MAX_AGE
  }), null);
});

test("keeps the login boundary when a fresh tracked course row is created", async () => {
  const originalFetch = globalThis.fetch;
  const now = Math.floor(Date.now() / 1000);
  const authenticatedAt = now - 60 * 60;
  const replies = [
    "<html><body>수업이 종료되었습니다.</body></html>",
    '<html><body><a href="https://gem-ai-middle-high.vercel.app/class.html?id=R260001&name=%ED%85%8C%EC%8A%A4%ED%8A%B8&session=22222222-2222-4222-8222-222222222222">입장</a></body></html>',
    "<html><body>수업 시작 기록이 저장되었습니다.</body></html>"
  ];
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => replies.shift()
  });

  try {
    const response = makeResponse();
    await sessionHandler(signedRequest({ action: "start", courseId: "h3-math" }, {
      authenticatedAt,
      courseId: "h3-math",
      courseRunId: "run-old",
      startedAt: new Date().toISOString(),
      endedAt: null
    }), response);

    assert.equal(response.statusCode, 200);
    assert.equal(replies.length, 0);
    const cookieToken = String(response.headers.get("set-cookie")).match(
      new RegExp(`${SESSION_COOKIE}=([^;]+)`)
    )?.[1];
    assert.ok(cookieToken);
    assert.equal(decodeToken(cookieToken).authenticatedAt, authenticatedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
