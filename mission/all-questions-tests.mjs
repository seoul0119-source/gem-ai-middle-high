import assert from 'node:assert/strict';
import {supportsRemaining,remainingData,remainingFrame,remainingCard,remainingReply,remainingContext} from './auto-remaining.mjs';
let cases=0,frames=0;
for(const id of ['complete-ten','together','pair','story','practice','swap','check'])for(let a=1;a<=10;a++)for(let b=1;b<=10;b++){
 const s={id,a,b,missing:id==='complete-ten',answer:id==='complete-ten'?10-a:a+b};if(!supportsRemaining(s))continue;
 const before=JSON.stringify(s),d=remainingData(s),card=remainingCard(s);cases++;
 assert.equal(card.scenes.length,1);assert.equal(card.mediaCount,2);assert.equal(d.answer,s.answer);
 for(let i=0;i<=20;i++){
  const dots=remainingFrame(s,i/20);frames++;
  assert.equal(dots.length,d.method==='count'?b:a+b);assert.equal(new Set(dots.map(x=>x.id)).size,dots.length);
  assert.ok(dots.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)&&x.x>=16&&x.x<=604&&x.y>=16&&x.y<=245));
  if(i===20)assert.equal(new Set(dots.map(x=>`${x.x}:${x.y}`)).size,dots.length);
 }
 if(s.missing)assert.equal(remainingFrame(s,0,false).length,a);
 if(d.method==='ten'){
  const final=remainingFrame(s,1);assert.equal(final.filter(x=>x.x<300).length,10);assert.equal(final.filter(x=>x.x>300).length,d.rest);
 }
 for(const lang of ['en','fr']){
  const initial=card.scenes[0][lang];assert.ok(!initial.includes(`${a} + ${b} = ${a+b}`));
  const reply=remainingReply({kind:'incorrect',n:d.answer+1},s,lang);assert.ok(reply.includes(String(d.answer)));
  const context=JSON.parse(remainingContext(s,false));assert.equal(context.answer,'hidden');
  for(const match of reply.matchAll(/(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)/g))assert.equal(+match[1]+ +match[2],+match[3]);
 }
 assert.equal(JSON.stringify(s),before);
}
assert.equal(remainingCard({id:'count-on',a:5,b:2}),null);
assert.equal(remainingCard({id:'join',a:5,b:2}),null);
assert.equal(remainingCard({id:'bridge-ten',a:9,b:3}),null);
assert.equal(remainingCard({id:'complete-ten',a:7,b:4,missing:true}),null);
console.log('REMAINING MATERIAL UNIT PASS',JSON.stringify({cases,frames,remoteRequests:0}));
