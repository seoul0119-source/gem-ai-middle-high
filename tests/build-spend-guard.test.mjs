import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {requirePaidVerificationApproval,offlineTestEnvironment} from '../scripts/build-spend-guard.mjs';

test('ordinary deployment stops before any build stage even when an API key is present',()=>{
  const result=spawnSync(process.execPath,['scripts/build.mjs'],{
    cwd:new URL('../',import.meta.url),encoding:'utf8',
    env:{PATH:process.env.PATH,OPENAI_API_KEY:'synthetic-not-a-real-key'}
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/Paid release verification is on hold/);
  assert.doesNotMatch(result.stdout,/GEM build stage|GEM deployment verification reviewer/);
});

test('paid verification requires the exact explicit argument, never an inherited environment flag',()=>{
  for(const args of [[],['--offline'],['--allow-paid-verification=false'],['--allow-paid-verification','--other']]){
    assert.throws(()=>requirePaidVerificationApproval(args),/on hold/);
  }
  assert.doesNotThrow(()=>requirePaidVerificationApproval(['--allow-paid-verification']));
});

test('offline checks remove provider credentials and model overrides without mutating the caller environment',()=>{
  const env={PATH:'/test/bin',OPENAI_API_KEY:'synthetic-key',OPENAI_REVIEW_MODEL:'expensive',OPENAI_BASE_URL:'https://invalid.example',GEM_VERIFICATION_WRITER_MODEL:'expensive',NODE_ENV:'test'};
  assert.deepEqual(offlineTestEnvironment(env),{PATH:'/test/bin',NODE_ENV:'test'});
  assert.equal(env.OPENAI_API_KEY,'synthetic-key');
});
