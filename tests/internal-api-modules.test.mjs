import assert from "node:assert/strict";
import test from "node:test";

import noAnswerHandler, {
  isSchoolEnglishNoAnswerRequest,
  schoolEnglishNoAnswerResponse
} from "../api/_no-answer-guard.js";
import coursesHandler, { COURSES, getCourse } from "../api/courses.js";
import suneungCoursesHandler, { SUNEUNG_COURSES } from "../api/suneung-courses.js";

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

for (const [path, handler] of [
  ["/api/courses", coursesHandler],
  ["/api/suneung-courses", suneungCoursesHandler],
  ["/api/_no-answer-guard", noAnswerHandler]
]) {
  test(`${path} returns a data-free 404 response`, () => {
    const response = createResponse();

    handler({ method: "GET" }, response);

    assert.equal(response.statusCode, 404);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.deepEqual(response.body, { error: "Not found" });
  });
}

test("internal named exports remain available to API modules", () => {
  assert.ok(Object.keys(COURSES).length > 0);
  assert.equal(getCourse("suneung-2028-math"), SUNEUNG_COURSES["suneung-2028-math"]);
  assert.equal(typeof isSchoolEnglishNoAnswerRequest, "function");
  assert.equal(typeof schoolEnglishNoAnswerResponse, "function");
});
