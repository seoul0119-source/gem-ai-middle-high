import assert from "node:assert/strict";
import test from "node:test";

process.env.OPENAI_API_KEY ||= "transcribe-fallback-test-key";

const { default: handleTranscribe } = await import("../api/transcribe.js");
const { createSessionToken } = await import("../lib/student-session.js");

const activeStudent = {
  id:"R260001",
  name:"학생",
  session:"00000000-0000-4000-8000-000000000001",
  courseId:"suneung-2027-math-probability",
  courseRunId:"voice-run-1",
  startedAt:new Date().toISOString(),
  endedAt:null
};

function requestFor(body) {
  const token = createSessionToken(activeStudent);
  return {
    method:"POST",
    headers:{ cookie:`gem_student_session=${token}` },
    body
  };
}

function responseRecorder() {
  return {
    statusCode:200,
    headers:{},
    body:null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    end(value) { this.body = value ? JSON.parse(value) : null; }
  };
}

function transcriptionRequest() {
  return requestFor({
    courseId:activeStudent.courseId,
    courseRunId:activeStudent.courseRunId,
    audio:Buffer.from("test audio").toString("base64"),
    mimeType:"audio/webm",
    context:"문제 2/10 — 수능 수학"
  });
}

test("retries a successful but empty gpt-transcribe response with gpt-4o-transcribe", async () => {
  const originalFetch = globalThis.fetch;
  const requestedModels = [];
  globalThis.fetch = async (_url, options) => {
    requestedModels.push(options.body.get("model"));
    const text = requestedModels.length === 1 ? "   " : "안녕하세요. 시작해 주세요.";
    return {
      ok:true,
      status:200,
      async json() { return { text }; }
    };
  };

  try {
    const response = responseRecorder();
    await handleTranscribe(transcriptionRequest(), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { text:"안녕하세요. 시작해 주세요." });
    assert.deepEqual(requestedModels, ["gpt-transcribe", "gpt-4o-transcribe"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not call the fallback model when gpt-transcribe returns text", async () => {
  const originalFetch = globalThis.fetch;
  const requestedModels = [];
  globalThis.fetch = async (_url, options) => {
    requestedModels.push(options.body.get("model"));
    return {
      ok:true,
      status:200,
      async json() { return { text:"C" }; }
    };
  };

  try {
    const response = responseRecorder();
    await handleTranscribe(transcriptionRequest(), response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { text:"C" });
    assert.deepEqual(requestedModels, ["gpt-transcribe"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
