import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 BOARD_CATALOG,BOARD_COURSES,BOARD_COURSE_LABELS,WORKSHEET_TOPICS,
 getBoardCourse,getBoardTopic,isBoardCourse
} from '../whiteboard/board-courses.js';
import {SCIENCE_TOPICS} from '../whiteboard/science-topics.js';

const catalog=JSON.parse(await readFile(new URL('../lib/material-catalog.json',import.meta.url),'utf8'));
const legacyIds=new Set(['h3-science','suneung-2027-chemistry-1']);

test('browser board catalog matches every trusted classroom and cannot drift independently',()=>{
 assert.equal(catalog.length,297);
 assert.deepEqual(BOARD_CATALOG,catalog);
 assert.equal(BOARD_COURSES.length,catalog.length);
 assert.equal(new Set(BOARD_COURSES.map(course=>course.id)).size,catalog.length);
 assert.deepEqual(BOARD_COURSES.map(course=>course.id).sort(),catalog.map(course=>course.id).sort());
 for(const original of catalog){
  const course=getBoardCourse(original.id);
  assert(isBoardCourse(original.id));
  assert.equal(course.language,original.language);
  assert.equal(course.grade,original.grade);
  assert.equal(BOARD_COURSE_LABELS[original.id],course.title);
  if(!legacyIds.has(course.id)){
   for(const [key,value] of Object.entries(original))assert.deepEqual(course[key],value);
   assert.equal(course.worksheetOnly,true);
   assert.deepEqual(course.topics,[]);
  }
 }
});

test('the established Korean physics and chemistry topic entries preserve their names and identity',()=>{
 const physics=getBoardCourse('h3-science'),chemistry=getBoardCourse('suneung-2027-chemistry-1');
 assert.equal(getBoardCourse(),physics);
 assert.equal(physics.title,'한국어 고3 과학');
 assert.equal(physics.subject,'과학');
 assert.equal(physics.topics,SCIENCE_TOPICS);
 assert.equal(physics.worksheetOnly,false);
 assert.deepEqual(physics.topics.map(topic=>topic.id),['induction','momentum','capacitors']);
 assert.equal(chemistry.title,'2027학년도 수능 화학Ⅰ');
 assert.equal(chemistry.subject,'화학Ⅰ');
 assert.equal(chemistry.worksheetOnly,false);
 assert.deepEqual(chemistry.topics.map(topic=>[topic.id,topic.title]),[
  ['chemistry-mole','몰과 입자 수·질량'],
  ['chemistry-atom','원자·동위원소·이온'],
  ['chemistry-bonding','화학 결합과 분자의 극성'],
  ['chemistry-reaction','화학 반응식과 양적 관계']
 ]);
 for(const course of [physics,chemistry])for(const topic of course.topics){
  assert.equal(getBoardTopic(course.id,topic.id),topic);
  assert(topic.introGuide.includes('260–350'));
 }
 assert.equal(getBoardTopic(physics.id,'chemistry-mole'),null);
 assert.equal(getBoardTopic(chemistry.id,'induction'),null);
});

test('all three classroom languages receive the matching worksheet lesson without foreign fixed units',()=>{
 const expected={
  ko:'현재 10문제 개념 설명',
  en:'Concepts for the current 10 questions',
  fr:'Notions pour les 10 questions en cours'
 };
 for(const course of BOARD_COURSES){
  const topic=getBoardTopic(course.id,'worksheet');
  assert.equal(topic,WORKSHEET_TOPICS[course.language]);
  assert.equal(topic.id,'worksheet');
  assert.equal(topic.title,expected[course.language]);
  assert.equal(topic.outline.length,5);
  assert.equal(topic.facts.length,3);
  assert(topic.introGuide.includes(course.language==='ko'?'260–350':'450–750'));
  assert(!course.topics.some(entry=>entry.id==='worksheet'));
  if(course.worksheetOnly){
   assert.equal(getBoardTopic(course.id,'induction'),null);
   assert.equal(getBoardTopic(course.id,'chemistry-mole'),null);
  }
 }
 assert(!/[가-힣]/u.test(JSON.stringify(WORKSHEET_TOPICS.en)));
 assert(!/[가-힣]/u.test(JSON.stringify(WORKSHEET_TOPICS.fr)));
});

test('unknown or malformed course IDs never receive an implicit board or worksheet topic',()=>{
 for(const id of ['',null,42,{},'__proto__','constructor','h9-science','materials-en-999-0','h3-science ']){
  assert.equal(isBoardCourse(id),false);
  assert.equal(getBoardCourse(id),null);
  assert.equal(getBoardTopic(id,'worksheet'),null);
 }
 for(const topicId of ['',null,undefined,'__proto__','not-a-topic'])assert.equal(getBoardTopic('h3-science',topicId),null);
});

test('shared browser registry and worksheet definitions are immutable across classrooms',()=>{
 assert(Object.isFrozen(BOARD_CATALOG));
 assert(Object.isFrozen(BOARD_COURSES));
 assert(Object.isFrozen(BOARD_COURSE_LABELS));
 assert(Object.isFrozen(WORKSHEET_TOPICS));
 for(const course of BOARD_CATALOG)assert(Object.isFrozen(course));
 for(const course of BOARD_COURSES){
  assert(Object.isFrozen(course));
  assert(Object.isFrozen(course.topics));
 }
 for(const topic of Object.values(WORKSHEET_TOPICS)){
  assert(Object.isFrozen(topic));
  assert(Object.isFrozen(topic.outline));
  assert(Object.isFrozen(topic.facts));
 }
 assert.throws(()=>BOARD_COURSES.push({id:'untrusted'}),TypeError);
 assert.throws(()=>getBoardCourse('materials-en-1-0').topics.push({id:'induction'}),TypeError);
 assert.throws(()=>getBoardTopic('materials-fr-1-0','worksheet').outline[0]='Unrelated lesson',TypeError);
});
