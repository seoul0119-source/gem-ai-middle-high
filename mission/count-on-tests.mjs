import assert from 'node:assert/strict';
import {countOnData,countOnFrame,countOnCard,countOnReply,supportsCountOn} from './auto-count-on.mjs';
let pairs=0,frames=0;
for(let a=1;a<20;a++)for(let b=1;b<=4&&a+b<=20;b++){
 const s={id:'count-on',a,b,answer:a+b,missing:false},copy=JSON.stringify(s),d=countOnData(s);pairs++;
 assert.equal(d.total,a+b);assert.equal(d.hops.length,b);assert.deepEqual(d.hops.map(x=>x.to),Array.from({length:b},(_,i)=>a+i+1));
 for(let i=0;i<=20;i++){const f=countOnFrame(s,i/20);frames++;assert.equal(f.length,b);assert.ok(f.every(x=>Number.isFinite(x.x)&&x.x>=0&&x.x<=620&&x.y>=0&&x.y<=290));assert.ok(f.every((x,j)=>j===0||x.progress<=f[j-1].progress));}
 assert.ok(countOnFrame(s,1).every(x=>x.x===x.x1&&x.y===180));
 for(const lang of ['en','fr']){const card=countOnCard(s);assert.equal(card.scenes.length,1);assert.ok(!card.scenes[0][lang].includes(`${a} + ${b} = ${a+b}`));assert.ok(card.summary[lang].includes(`${a} + ${b} = ${a+b}`));assert.ok(countOnReply({kind:'incorrect',n:0},s,lang).includes(`${a} + ${b} = ${a+b}`));}
 assert.equal(JSON.stringify(s),copy);
}
assert.equal(supportsCountOn({id:'join',a:8,b:2}),false);assert.equal(supportsCountOn({id:'count-on',a:19,b:2}),false);
console.log('COUNT ON UNIT PASS',JSON.stringify({pairs,frames}));
