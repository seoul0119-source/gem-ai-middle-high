import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import deployedChatHandler from "../api/chat-final.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

const COURSE_ID = "suneung-2028-integrated-science";

function responseCapture() {
  return {
    statusCode:0,
    payload:null,
    headers:new Map(),
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers.set(String(name).toLowerCase(), value); return this; },
    getHeader(name) { return this.headers.get(String(name).toLowerCase()); },
    end(value = "") { this.payload = value ? JSON.parse(String(value)) : {}; return this; }
  };
}

test("the deployed /api/chat rewrite reaches the closed Suneung science engine", async () => {
  const vercelConfig = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(vercelConfig.rewrites.find((rewrite) => rewrite.source === "/api/chat"), {
    source:"/api/chat",
    destination:"/api/chat-final"
  });

  const previousKey = process.env.OPENAI_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "deployment-routing-test-key";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("the deployed closed-science route must not fetch");
  };

  try {
    const courseRunId = "deployment-route-run";
    const token = createSessionToken({
      id:"R260001",
      name:"테스트 학생",
      session:"sheet-session",
      courseId:COURSE_ID,
      courseRunId,
      startedAt:new Date().toISOString(),
      endedAt:null
    });
    const response = responseCapture();
    await deployedChatHandler({
      method:"POST",
      headers:{ cookie:`${SESSION_COOKIE}=${token}` },
      body:{
        courseId:COURSE_ID,
        courseRunId,
        messages:[{ role:"user", content:"시작" }],
        learningProfile:{ lessonRecords:[] }
      }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.match(response.payload.text, /^문제 1\/10/);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});
