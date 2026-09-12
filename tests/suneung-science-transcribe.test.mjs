import assert from "node:assert/strict";
import test from "node:test";
import transcribeHandler from "../api/transcribe.js";
import { createSessionToken, SESSION_COOKIE } from "../lib/student-session.js";

test("science voice input preserves full concept questions and unambiguous E answers", async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "science-conversation-transcribe-test";
  const courseId = "suneung-2028-integrated-science";
  const courseRunId = "science-v2:question-transcription";
  const token = createSessionToken({ id: "R260001", name: "질문 테스트", session: "asr-science-test",
    courseId, courseRunId, startedAt: new Date().toISOString(), endedAt: null });
  let recognizedText = "";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/audio/transcriptions");
    const prompt = options.body.get("prompt");
    assert.match(prompt, /질문과 문장을 끝까지 그대로 받아쓰세요/);
    assert.match(prompt, /질문을 답안으로 줄이지 마세요/);
    assert.match(prompt, /E\(알파벳 이\)/);
    assert.ok(options.body.getAll("keywords[]").includes("질량"));
    return { ok: true, status: 200, json: async () => ({ text: recognizedText }) };
  };
  try {
    for (const text of ["물체의 질량에 대해서 설명해 주세요.", "여기에서 말하는 물체의 질량이 무엇입니까?", "예를 들어서 더 쉽게 설명해 주세요.", "알파벳 이", "2번입니다"]) {
      recognizedText = text;
      const response = { statusCode: 200, payload: null,
        status(code) { this.statusCode = code; return this; }, setHeader() { return this; },
        end(body) { this.payload = JSON.parse(String(body)); } };
      await transcribeHandler({ method: "POST", headers: { cookie: `${SESSION_COOKIE}=${token}` },
        body: { courseId, courseRunId, audio: Buffer.from("mock audio").toString("base64"),
          mimeType: "audio/webm", context: "문제 1/10 · 질량과 측정" } }, response);
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.payload, { text });
    }
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});
