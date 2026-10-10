import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getCourse } from '../api/courses.js';
import sessionHandler from '../api/session.js';
import { createSessionToken, SESSION_COOKIE } from '../lib/student-session.js';

const context = { URLSearchParams };
vm.runInNewContext(readFileSync(new URL('../entrance-catalog.js', import.meta.url), 'utf8'), context);
const catalog = context.GEMEntrance;
const choices = Object.entries(catalog.schools).flatMap(([level, school]) =>
  Array.from({ length: school.grades }, (_, i) => catalog.choices(level, i + 1)).flat());

test('all 68 Korean entrance choices match existing classroom and server courses', () => {
  const classroom = readFileSync(new URL('../class.html', import.meta.url), 'utf8');
  assert.equal(choices.length, 68);
  assert.equal(new Set(choices.map(item => item.id)).size, 68);
  for (const item of choices) {
    const server = getCourse(item.id);
    assert.ok(server, item.id);
    assert.equal(server.grade, item.grade, item.id);
    assert.ok(item.label.includes(server.subject), item.id);
    assert.ok(classroom.includes(`data-href="/learn.html?course=${item.id}"`), item.id);
    const worksheet = new URL(catalog.destination(item), 'https://gem.test');
    assert.equal(worksheet.pathname, '/materials.html');
    assert.equal(worksheet.searchParams.get('classroom'), '1');
    assert.equal(worksheet.searchParams.get('course'), item.id);
    assert.equal(catalog.destination(item, 'conversation'), `/learn.html?course=${item.id}`);
    assert.equal(new URL(catalog.destination(item, 'worksheet', true), 'https://gem.test').searchParams.has('classroom'), false);
  }
  assert.equal(catalog.course('elementary', 1, 'science'), null);
  assert.equal(catalog.course('middle', 6, 'math'), null);
});

test('new direct entrance routes retain the signed-session Google Sheets start and end contract', async () => {
  const originalFetch = globalThis.fetch, originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'synthetic-entrance-verification';
  const calls = [];
  globalThis.fetch = async value => {
    const url = new URL(value); calls.push(url);
    return { ok: true, text: async () => JSON.stringify({ success: true, action: url.searchParams.get('action') }) };
  };
  const response = () => ({ headers: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } });
  const request = (body, extra = {}) => ({ method: 'POST', body, headers: { cookie: `${SESSION_COOKIE}=${createSessionToken({ id: 'BUILD_CHECK', name: '합성 입구 검증', session: 'synthetic-entrance-session', ...extra })}` } });
  try {
    for (const item of choices) {
      const server = getCourse(item.id), started = response();
      await sessionHandler(request({ action: 'start', courseId: item.id }), started);
      assert.equal(started.statusCode, 200, item.id);
      assert.equal(calls.at(-1).searchParams.get('subject'), server.subject);
      assert.equal(calls.at(-1).searchParams.get('grade'), server.grade);
      const ended = response();
      await sessionHandler(request({ action: 'end', courseId: item.id, courseRunId: started.body.courseRunId }, { courseId: item.id, courseRunId: started.body.courseRunId }), ended);
      assert.equal(ended.statusCode, 200, item.id);
      assert.equal(calls.at(-1).searchParams.get('action'), 'end');
    }
    assert.equal(calls.length, 136);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
