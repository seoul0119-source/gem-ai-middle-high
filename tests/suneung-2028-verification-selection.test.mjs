import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const script = new URL("../scripts/verify-suneung-2028.mjs", import.meta.url);

function inspect(...args) {
  // Inspection never needs credentials and cannot make a paid provider call.
  const result = spawnSync(process.execPath, [script.pathname, "--fixtures-only", ...args], {
    encoding: "utf8", timeout: 10_000,
    env: { ...process.env, OPENAI_API_KEY: "" }
  });
  assert.ifError(result.error);
  return { status: result.status, output: result.stdout + result.stderr };
}

test("focused release verification selects English and bounds paid work", () => {
  const result = inspect("--course=suneung-2028-english");
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /selected=suneung-2028-english; application turns=3;/);
  assert.match(result.output, /expected provider requests=7; maximum=14; deadline=90s; concurrency=1/);
  assert.match(result.output, /No live AI requests were made/);
});

test("full course audit remains available explicitly and by its existing default", () => {
  for (const args of [[], ["--all"]]) {
    const result = inspect(...args);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /application turns=39; expected provider requests=91; maximum=170; deadline=300s; concurrency=3/);
  }
});

test("invalid or conflicting selectors cannot silently launch the full paid audit", () => {
  const cases = [
    ["--course=suneung-2028-engilsh"],
    ["--course=suneung-2027-english"],
    ["--course=suneung-2028-math"],
    ["--course=suneung-2028-integrated-science"],
    ["--course="],
    ["--course", "suneung-2028-english"],
    ["--all", "--course=suneung-2028-english"],
    ["--course=suneung-2028-english", "--course=suneung-2028-english"],
    ["--unknown"]
  ];
  for (const args of cases) {
    const result = inspect(...args);
    assert.equal(result.status, 1, `${args.join(" ")}: ${result.output}`);
    assert.match(result.output, /build_2028_(?:course_selection_invalid|unknown_option|conflicting_selection|duplicate_option)/);
    assert.doesNotMatch(result.output, /credentials_missing|live verification passed|fixture coverage checked/);
  }
});
