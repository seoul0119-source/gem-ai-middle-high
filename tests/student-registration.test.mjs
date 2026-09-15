import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { parseRegistrationResponse } from '../api/session.js';
const wrap = (payload) => {
  const html = `<script>window.top.postMessage(${JSON.stringify(payload)}, "*");</script>`;
  return `goog.script.init(${JSON.stringify(JSON.stringify({ userHtml: html }))}, "");`;
};
const response = () => ({ statusCode: 0, status(n) { this.statusCode = n; return this; }, setHeader() {}, end(s) { this.body = JSON.parse(s); } });
test('decodes Apps Script registration without executing returned scripts', () => {
  const data = { success: true, studentId: 'T260021', name: '테스트', grade: '중학교 1학년' };
  assert.deepEqual(parseRegistrationResponse(wrap(data)), data);
  assert.throws(() => parseRegistrationResponse('<script>alert(1)</script>'));
});
test('trial registration validates fields, ignores requested paid type, and reports uncertain outcomes without retry', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, opts) => {
    calls++;
    const data = new URLSearchParams(opts.body);
    assert.equal(data.get('registrationType'), '체험');
    return { ok: true, text: async () => wrap({ success: true, studentId: 'T260021', name: data.get('name'), grade: data.get('grade') }) };
  };
  try {
    for (const body of [{name:'=IMPORTXML("x")',grade:'중학교 1학년'}, {name:'테스트',grade:'invalid'}]) {
      const r = response(); await handler({method:'POST',body:{action:'register',...body}}, r);
      assert.equal(r.statusCode,400);
    }
    assert.equal(calls,0);
    const r = response(); await handler({method:'POST',body:{action:'register',name:'테스트',grade:'중학교 1학년',registrationType:'정규 등록'}},r);
    assert.equal(r.statusCode,200); assert.equal(r.body.student.id,'T260021'); assert.equal(calls,1);
    globalThis.fetch = async () => { calls++; throw new Error('network loss after save'); };
    const lost = response(); await handler({method:'POST',body:{action:'register',name:'테스트',grade:'중학교 1학년'}},lost);
    assert.equal(lost.statusCode,502); assert.equal(lost.body.registrationUncertain,true); assert.equal(calls,2);
  } finally { globalThis.fetch = original; }
});

test('English and French grades reach the same student register unchanged', async () => {
  const original = globalThis.fetch;
  const stored = [];
  globalThis.fetch = async (_url, opts) => {
    const data = new URLSearchParams(opts.body);
    stored.push(data.get('grade'));
    return { ok: true, text: async () => wrap({ success:true, studentId:'T260022', name:data.get('name'), grade:data.get('grade') }) };
  };
  try {
    for (const grade of ['Grade 1','Grade 6','Grade 12','CP','6e','Première','Terminale']) {
      const r=response(); await handler({method:'POST',body:{action:'register',name:'GEM Test',grade}},r);
      assert.equal(r.statusCode,200); assert.equal(r.body.student.grade,grade);
    }
    assert.deepEqual(stored,['Grade 1','Grade 6','Grade 12','CP','6e','Première','Terminale']);
  } finally { globalThis.fetch=original; }
});
