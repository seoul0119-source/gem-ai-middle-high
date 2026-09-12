import crypto from "node:crypto";
import { projectClosedSuneungScienceSpeechText } from "./suneung-science-bank.js";
import { GUARDED_SUNEUNG_SCIENCE_COURSE_ID } from "./suneung-science-safety.js";

const MAX_AGE_SECONDS = 2 * 60 * 60;
const MAX_REPLY_LENGTH = 1800;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

function digest(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function signingKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey
    ? crypto.createHash("sha256").update(`gem-science-reply-proof-v1:${apiKey}`).digest()
    : null;
}

function subjectFor(student) {
  if (!student?.id || !student.session || !student.courseRunId || student.endedAt
    || student.courseId !== GUARDED_SUNEUNG_SCIENCE_COURSE_ID) return null;
  return digest(JSON.stringify([student.id, student.session, student.courseId, student.courseRunId]));
}

function validPosition(questionNumber, attempt) {
  return Number.isInteger(questionNumber) && questionNumber >= 1 && questionNumber <= 10
    && Number.isInteger(attempt) && attempt >= 1 && attempt <= 3;
}

function readProof({ student, proof, now = Date.now() }) {
  const key = signingKey();
  const subject = subjectFor(student);
  if (!key || !subject || typeof proof !== "string" || proof.length > 2048) return null;
  const parts = proof.split(".");
  if (parts.length !== 2 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return null;
  const [encoded, signature] = parts;
  const expected = crypto.createHmac("sha256", key).update(encoded).digest("base64url");
  const expectedBytes = Buffer.from(expected);
  const signatureBytes = Buffer.from(signature);
  if (expectedBytes.length !== signatureBytes.length || !crypto.timingSafeEqual(expectedBytes, signatureBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const seconds = Math.floor(now / 1000);
    if (payload.v !== 1 || payload.subject !== subject
      || !Number.isSafeInteger(seconds)
      || !Number.isSafeInteger(payload.iat) || payload.iat > seconds
      || !Number.isSafeInteger(payload.exp) || payload.exp <= seconds
      || payload.exp <= payload.iat || payload.exp - payload.iat > MAX_AGE_SECONDS
      || (Number.isFinite(student.exp) && payload.exp > student.exp)
      || !validPosition(payload.questionNumber, payload.attempt)
      || !DIGEST_PATTERN.test(payload.textHash) || !DIGEST_PATTERN.test(payload.speechHash)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// Call only after the server has reviewed the generated reply. The proof
// authorizes that exact reply and its full spoken projection, never arbitrary
// client text or a substring. `now` is a millisecond timestamp for testing.
export function createScienceReplyProof({ student, text, questionNumber, attempt, now = Date.now() }) {
  const key = signingKey();
  const subject = subjectFor(student);
  if (!key || !subject || !validPosition(questionNumber, attempt)
    || typeof text !== "string" || !text.trim() || text.length > MAX_REPLY_LENGTH) return null;
  const seconds = Math.floor(now / 1000);
  const exp = Math.min(seconds + MAX_AGE_SECONDS, Number.isFinite(student.exp) ? student.exp : Infinity);
  const speech = projectClosedSuneungScienceSpeechText(text);
  if (!Number.isSafeInteger(seconds) || !Number.isSafeInteger(exp) || exp <= seconds || !speech) return null;
  const payload = {
    v: 1, subject, iat: seconds, exp, questionNumber, attempt,
    textHash: digest(text), speechHash: digest(speech)
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", key).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyScienceReplyProof({ student, text, proof, now }) {
  const payload = readProof({ student, proof, now });
  if (!payload || typeof text !== "string" || digest(text) !== payload.textHash) return null;
  return { questionNumber: payload.questionNumber, attempt: payload.attempt };
}

export function isApprovedScienceReplySpeech({ student, text, proof, now }) {
  const payload = readProof({ student, proof, now });
  return Boolean(payload && typeof text === "string" && digest(text) === payload.speechHash);
}
