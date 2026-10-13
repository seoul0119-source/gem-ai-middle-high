// Live AI regression only: no student, worksheet database or Sheets writes.
import assert from 'node:assert/strict';
import {askScienceBoard} from '../lib/science-board-content.js';
import {hasBoardLanguage} from '../lib/board-language.js';
import {questionRoutingFixture} from '../tests/fixtures/board-question-routing.js';
for(const language of ['ko','en','fr']){
 const f=questionRoutingFixture(language),before=JSON.stringify(f.material),started=Date.now();
 const result=await askScienceBoard(f.lesson,{scene:0,text:f.question,question:f.material.questions[0]},{material:f.material});
 assert(hasBoardLanguage(result.answer,language));assert(result.answer.toLowerCase().includes(f.term));
 assert(({ko:/확대|렌즈|작은/,en:/magnif|lens|small|tiny/i,fr:/agrandi|lentille|petit/i})[language].test(result.answer),'Must define the instrument, not give generic problem-solving hints');
 assert.equal(JSON.stringify(f.material),before);
 console.log('Board concept question live verified',JSON.stringify({courseId:f.courseId,language,elapsedMs:Date.now()-started,answer:result.answer}));
}
