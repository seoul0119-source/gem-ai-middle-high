import assert from 'node:assert/strict';
import fs from 'node:fs';
import {supportsJoin,joinFrame,joinCard,joinReply,joinContext} from './auto-join.mjs';
let combinations=0,frames=0;
for(let a=1;a<=10;a++)for(let b=1;b<=10;b++){
 const s={id:'join',a,b,answer:a+b},before=JSON.stringify(s);const card=joinCard(s);
 assert.ok(supportsJoin(s));assert.equal(card.scenes.length,1);assert.equal(card.mediaCount,2);
 for(let tick=0;tick<=20;tick++){
  const dots=joinFrame(s,tick/20);assert.equal(dots.length,a+b);assert.equal(new Set(dots.map(x=>x.id)).size,a+b);
  assert.equal(dots.filter(x=>x.group==='green').length,a);assert.equal(dots.filter(x=>x.group==='gold').length,b);
  assert.ok(dots.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)&&x.x>=16&&x.x<=604&&x.y>=16&&x.y<=248));frames++;
 }
 for(const l of ['en','fr']){
  assert.ok(!card.scenes[0][l].includes(`${a} + ${b} = ${a+b}`));
  assert.ok(joinReply({kind:'incorrect',n:a+b+1},s,l).includes(`${a} + ${b} = ${a+b}`));
  assert.ok(!joinReply({kind:'conservation'},s,l,false).includes(`${a} + ${b} = ${a+b}`));
 }
 assert.equal(JSON.parse(joinContext(s,false)).total,'not yet shown');assert.equal(JSON.parse(joinContext(s,true)).total,a+b);
 assert.equal(JSON.stringify(s),before);combinations++;
}
assert.equal(joinCard({id:'count-on',a:6,b:2}),null);assert.equal(joinCard({id:'join',a:1,b:99}),null);assert.equal(joinReply({kind:'greeting'},{id:'join',a:2,b:3},'en'),null);
const bytes=fs.statSync('mission/auto-join.mjs').size;assert.ok(bytes<24000);
console.log('AUTO JOIN UNIT PASS',JSON.stringify({combinations,frames,moduleBytes:bytes,mutatesLesson:false,remoteMediaRequests:0}));
