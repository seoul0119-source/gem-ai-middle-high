import assert from 'node:assert/strict';
import {LANGUAGES,SUBJECTS,PROGRAMME,course,translationStatus} from './catalog.mjs';
import {UI,lessonText,answerNumber} from './i18n.mjs';
assert.equal(LANGUAGES.length,5);assert.equal(SUBJECTS.length,4);assert.equal(PROGRAMME.nationalAlignment,false);
assert.equal(LANGUAGES.find(l=>l.code==='ur').dir,'rtl');assert.equal(course('world-history',6).available,false);assert.equal(course('world-history',7).status,'planned');assert.equal(course('english',12).targetLanguage,'en');assert.equal(course('math',2).available,true);assert.equal(course('science',2).available,false);
let cases=0;for(let a=2;a<=10;a++)for(let b=1;b<=10;b++)for(const l of LANGUAGES){const s={id:'practice',a,b};const x=lessonText(s,l.code,false),y=lessonText(s,l.code,true);assert.equal(x.formula,`${a} + ${b} = ?`);assert.equal(y.formula,`${a} + ${b} = ${a+b}`);assert.ok(x.ob&&x.fact&&y.solve);assert.ok(Object.values(UI[l.code]).every(t=>typeof t==='string'&&t.length>0));assert.equal(lessonText({id:'complete-ten',a:7,b:3,missing:true},l.code,true).answer,3);cases++;}
for(const [s,n]of [['८',8],['۱۳',13],['١٣',13],['treize',13],['तेह्र',13],['تیرہ',13],['kumi na tatu',13],['13',13],['13 or 14',null],['Why is it 13?',null]])assert.equal(answerNumber(s),n,s);
console.log('PC FIVE UNIT PASS',JSON.stringify({languageCases:cases,grades:12,coreSubjects:4,worldHistoryMinimum:7,sourceTranslationReview:translationStatus}));
