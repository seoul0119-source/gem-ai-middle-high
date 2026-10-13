import test from 'node:test';
import assert from 'node:assert/strict';
import {askScienceBoard,scienceLessonIssues} from '../lib/science-board-content.js';
import {BOARD_TEACHERS} from '../whiteboard/board-teachers.js';
import {questionRoutingFixture} from './fixtures/board-question-routing.js';
function provider(...replies){const requests=[];return {requests,fetcher:async(_url,options)=>{requests.push(JSON.parse(options.body));assert(replies.length,'Unexpected extra model request');const reply=replies.shift();return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:typeof reply==='string'?reply:JSON.stringify(reply)}]}]});}};}
for(const language of ['ko','en','fr'])test(`${language}: an unresolved cell question does not turn a microscope definition into a hint`,async()=>{
 const f=questionRoutingFixture(language),before=structuredClone(f),p=provider(f.definition);
 assert.deepEqual(scienceLessonIssues(f.lesson),[]);
 assert.deepEqual(await askScienceBoard(f.lesson,{scene:0,text:f.question,question:f.material.questions[0]},{...p,material:f.material}),{answer:f.definition});
 assert.deepEqual(f,before);assert.equal(p.requests.length,1);
 assert.match(p.requests[0].instructions,/does NOT make every student question a hint request/);
 assert(p.requests[0].instructions.includes(`You are ${BOARD_TEACHERS[language]}`));
 assert(!p.requests[0].instructions.includes('Give a useful indirect hint or different worked example only.'));
});
test('a choice word in a genuine definition is independently checked instead of silently replaced with a generic hint',async()=>{
 const f=questionRoutingFixture('en'),reply='The nucleus is a structure in a cell that contains genetic material. It has a membrane around it and helps regulate cellular activities.';
 const p=provider(reply,{conceptOnly:true});
 const answer=await askScienceBoard(f.lesson,{scene:0,text:'What does the word nucleus mean?',question:f.material.questions[0]},{...p,material:f.material});
 assert.equal(answer.answer,reply);assert.equal(p.requests[1].text.format.name,'board_concept_guard');
 assert.equal(p.requests[1].model,process.env.OPENAI_WHITEBOARD_MODEL||'gpt-4.1-mini-2025-04-14');
});
test('a disguised solution and an explicit answer announcement stay blocked without grading or altering the worksheet',async()=>{
 const f=questionRoutingFixture('en'),before=structuredClone(f.material);
 for(const [reply,verdict] of [['We can see that the nucleus controls those activities and contains the genetic material.',{conceptOnly:false}],['The correct answer is C, Nucleus. It is the structure you should select.',null]]){
  const p=provider(reply,...(verdict?[verdict]:[]));
  const out=await askScienceBoard(f.lesson,{scene:0,text:f.prompt,question:f.material.questions[0]},{...p,material:f.material});
  assert(!out.answer.toLowerCase().includes('nucleus'));assert.equal(p.requests.length,verdict?2:1);
 }
 assert.deepEqual(f.material,before);
});
