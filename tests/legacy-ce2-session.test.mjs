import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

process.env.OPENAI_API_KEY ||= "legacy-ce2-test-key";

const { default: handleCe2 } = await import("../api/chat-ce2.js");
const { createSessionToken } = await import("../lib/student-session.js");
const learnFrHtml = await readFile(new URL("../learn-fr.html", import.meta.url), "utf8");

function requestFor(student, body) {
  const token = createSessionToken(student);
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

const activeStudent = {
  id:"R260001",
  name:"Élève",
  session:"00000000-0000-4000-8000-000000000001",
  courseId:"g3-math-fr",
  courseRunId:"ce2-run-1",
  startedAt:new Date().toISOString(),
  endedAt:null
};

test("legacy CE2 paid actions require the exact active French course run", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("A rejected request must not reach an external API");
  };

  try {
    for (const action of ["chat", "speech", "transcribe"]) {
      const response = responseRecorder();
      await handleCe2(requestFor(activeStudent, {
        action,
        courseId:"g3-math-fr",
        courseRunId:"a-different-run",
        messages:[{ role:"user", content:"3" }],
        text:"Bonjour",
        audio:"ZmFrZQ=="
      }), response);
      assert.equal(response.statusCode, 409, `${action} must reject a stale course run`);
    }

    const endedResponse = responseRecorder();
    await handleCe2(requestFor({ ...activeStudent, endedAt:new Date().toISOString() }, {
      action:"chat",
      courseId:"g3-math-fr",
      courseRunId:"ce2-run-1",
      messages:[{ role:"user", content:"3" }]
    }), endedResponse);
    assert.equal(endedResponse.statusCode, 409);

    const wrongCourseResponse = responseRecorder();
    await handleCe2(requestFor({ ...activeStudent, courseId:"g2-math-fr" }, {
      action:"speech",
      courseId:"g2-math-fr",
      courseRunId:"ce2-run-1",
      text:"Bonjour"
    }), wrongCourseResponse);
    assert.equal(wrongCourseResponse.statusCode, 409);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy CE2 chat still works for the exact active course run", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
      ok:true,
      status:200,
      async json() {
        return {
          output_text:"Activité 2/10 — calcul direct\nCombien font 2 fois 4 ?\n\nRéponse : (________)"
        };
      }
    };
  };

  try {
    const response = responseRecorder();
    await handleCe2(requestFor(activeStudent, {
      action:"chat",
      courseId:"g3-math-fr",
      courseRunId:"ce2-run-1",
      messages:[{ role:"user", content:"six" }],
      history:[]
    }), response);
    assert.equal(response.statusCode, 200);
    assert.match(response.body.text, /Activité 2\/10/);
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy CE2 tracking actions are retired without making external calls", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error("unexpected fetch"); };
  try {
    for (const action of ["session-start", "session-end"]) {
      const response = responseRecorder();
      await handleCe2(requestFor(activeStudent, { action }), response);
      assert.equal(response.statusCode, 410);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("legacy French page obtains and forwards the generic course run", () => {
  assert.match(learnFrHtml, /const COURSE_ID="g3-math-fr"/);
  assert.match(learnFrHtml, /fetch\("\/api\/session"/);
  assert.match(learnFrHtml, /action:"start",courseId:COURSE_ID/);
  assert.match(learnFrHtml, /action:"restart",courseId:COURSE_ID/);
  assert.match(learnFrHtml, /action:"end",courseId:COURSE_ID,courseRunId/);
  assert.match(learnFrHtml, /action:"end-on-exit",courseId:COURSE_ID,courseRunId/);
  assert.equal((learnFrHtml.match(/courseId:COURSE_ID,courseRunId/g) || []).length >= 5, true);
  assert.doesNotMatch(learnFrHtml, /action:"session-(?:start|end)"/);
});
