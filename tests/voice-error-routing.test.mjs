import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const learnHtml = await readFile(new URL("../learn.html", import.meta.url), "utf8");

function extractNamedFunction(source, name) {
  const asyncStart = source.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const openingBrace = source.indexOf("{", start);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} must have a closing brace`);
}

function createVoiceContext({ sendMessage }) {
  const rendered = [];
  let scheduled = 0;
  const context = {
    AVATAR_TEXT:{
      checkConnection:"연결을 확인해 주세요.",
      heard:"인식",
      inProgress:"수업 진행 중",
      notUnderstood:"목소리를 알아듣지 못했습니다.",
      recognizing:"학생 음성 인식 중",
      recognitionUnavailable:"음성 인식 서버 오류",
      status:"상태"
    },
    COURSE:{ avatar:false },
    COURSE_ID:"suneung-2027-math-probability",
    FileReader:class {
      readAsDataURL() {
        this.result = "data:audio/webm;base64,QUJD";
        this.onload();
      }
    },
    addMessage(role, message) { rendered.push({ role, message }); },
    connection:{ innerHTML:"", replaceChildren() {} },
    courseRunId:"run-voice-test",
    document:{
      createElement() { return { textContent:"" }; },
      createTextNode(text) { return { text }; }
    },
    fetch:async () => ({ ok:true }),
    input:{ disabled:false, value:"" },
    lastAssistantText:"문제 2/10",
    micButton:{ disabled:false },
    readJsonResponse:async () => ({ text:"안녕하세요. 시작해 주세요." }),
    scheduleRecording() { scheduled += 1; },
    sendMessage,
    console:{ error() {} }
  };
  return { context, rendered, scheduled:() => scheduled };
}

test("does not relabel a teacher-response failure as failed voice recognition", async () => {
  const functionSource = extractNamedFunction(learnHtml, "transcribeRecording");
  const { context, rendered, scheduled } = createVoiceContext({
    sendMessage:async () => { throw new Error("chat unavailable"); }
  });
  runInNewContext(`
    let voiceFailureNoticeShown = false;
    ${functionSource}
    this.transcribeRecording = transcribeRecording;
  `, context);

  await context.transcribeRecording({ type:"audio/webm" });

  assert.deepEqual(rendered, [{
    role:"assistant",
    message:"음성은 정상적으로 인식했지만 답을 AI 선생님에게 전달하지 못했습니다. 잠시 후 다시 보내 주세요."
  }]);
  assert.doesNotMatch(rendered[0].message, /목소리를 알아듣지 못했습니다/);
  assert.match(context.connection.innerHTML, /수업 진행 중/);
  assert.equal(scheduled(), 1, "an escaped teacher-response error must restart voice conversation");
});
