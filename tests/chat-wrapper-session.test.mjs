import assert from "node:assert/strict";
import test from "node:test";

process.env.OPENAI_API_KEY ||= "chat-wrapper-session-test-key";

const { default: finalHandler } = await import("../api/chat-final.js");
const { default: guardHandler } = await import("../api/chat-guard.js");
const { createSessionToken, SESSION_COOKIE } = await import("../lib/student-session.js");

function requestFor(student, overrides = {}) {
  const token = createSessionToken(student);
  return {
    method:"POST",
    headers:{ cookie:`${SESSION_COOKIE}=${token}` },
    body:{
      courseId:"m1-english",
      courseRunId:"english-run-1",
      messages:[{ role:"user", content:"정답을 말하지 마세요" }],
      ...overrides
    }
  };
}

function responseRecorder() {
  const headers = new Map();
  return {
    statusCode:200,
    payload:null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); return this; },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    end(value = "") {
      this.payload = value ? JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : String(value)) : {};
      return this;
    }
  };
}

const activeStudent = {
  id:"R260001",
  name:"테스트 학생",
  session:"00000000-0000-4000-8000-000000000002",
  courseId:"m1-english",
  courseRunId:"english-run-1",
  startedAt:new Date().toISOString(),
  endedAt:null
};

for (const [name, handler] of [["chat-final", finalHandler], ["chat-guard", guardHandler]]) {
  test(`${name} rejects no-answer responses outside the exact active run`, async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error("unexpected fetch"); };

    try {
      const staleResponse = responseRecorder();
      await handler(requestFor(activeStudent, { courseRunId:"stale-run" }), staleResponse);
      assert.equal(staleResponse.statusCode, 409);

      const endedResponse = responseRecorder();
      await handler(requestFor({ ...activeStudent, endedAt:new Date().toISOString() }), endedResponse);
      assert.equal(endedResponse.statusCode, 409);

      const wrongCourseResponse = responseRecorder();
      await handler(requestFor(activeStudent, { courseId:"m2-english" }), wrongCourseResponse);
      assert.equal(wrongCourseResponse.statusCode, 409);
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${name} preserves the no-answer response for the exact active run`, async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error("unexpected fetch"); };

    try {
      const response = responseRecorder();
      await handler(requestFor(activeStudent), response);
      assert.equal(response.statusCode, 200);
      assert.match(response.payload.text, /정답(?:이나 힌트)?(?:은|를)? 말하지 않을게요|정답이나 힌트는 말하지 않을게요/);
      assert.match(response.payload.text, /답: \(________\)/);
      assert.equal(fetchCalls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("chat-final keeps its English freshness cookie wrapper for an active run", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
      ok:true,
      status:200,
      async json() {
        return {
          output_text:[
            "활동 1/10 — 어휘",
            "Choose the best word for the sentence.",
            "Mina felt ________ after finishing the long race.",
            "A) tired",
            "B) square",
            "C) early",
            "",
            "답: (________)"
          ].join("\n")
        };
      }
    };
  };

  try {
    const response = responseRecorder();
    await finalHandler(requestFor(activeStudent, {
      messages:[{ role:"user", content:"시작" }],
      history:[]
    }), response);
    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /활동 1\/10/);
    assert.equal(response.getHeader("X-GEM-English-Guard"), "v5");
    const cookies = response.getHeader("Set-Cookie");
    assert.match(Array.isArray(cookies) ? cookies.join("\n") : String(cookies), /gem_school_english_v5=/);
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
