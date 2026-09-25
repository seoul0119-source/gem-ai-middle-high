import assert from 'node:assert/strict';
import {questionKeys,freshWorkbook,safeRecentQuestions,nextWorkbookUnit,rememberWorkbook,previousForUnit,WORKBOOK_QUESTIONS} from './workbook-core.mjs';
function draft(seed){return {steps:[0,1,2].map(i=>({kind:'question',text:{en:{prompt:'What is the total?',board:[`${seed+i} + 1 = ?`],options:[String(seed+i),String(seed+i+1),String(seed+i+2)]}}}))};}
const a=draft(2),b=draft(10);
assert.equal(WORKBOOK_QUESTIONS,3);assert.ok(freshWorkbook(a));assert.ok(!freshWorkbook(a,questionKeys(a)));assert.ok(freshWorkbook(b,questionKeys(a)));
const shuffled=structuredClone(a);for(const s of shuffled.steps)s.text.en.options.reverse();assert.ok(!freshWorkbook(shuffled,questionKeys(a)));
const repeated=structuredClone(a);repeated.steps[1]=structuredClone(repeated.steps[0]);assert.ok(!freshWorkbook(repeated));
assert.equal(safeRecentQuestions(Array.from({length:30},(_,i)=>String(i))).length,18);assert.deepEqual(safeRecentQuestions('not an array'),[]);
const course={units:[1,2,3,4].map(n=>({id:'math-g2-u'+n}))};let history=[];
for(let n=0;n<9;n++){const unit=nextWorkbookUnit(course,history);assert.equal(unit.id,course.units[n%4].id);history=rememberWorkbook(history,unit.id,draft(n*10));}
assert.ok(previousForUnit(history,'math-g2-u1').length>=3);assert.equal(nextWorkbookUnit({units:[{id:'science-g2-u1'}]},history).id,'science-g2-u1');assert.equal(nextWorkbookUnit(null),null);
console.log('WORKBOOK CORE PASS: unique question keys, choice-shuffle rejection, bounded history and grade/subject unit rotation.');
