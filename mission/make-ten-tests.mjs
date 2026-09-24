import assert from 'node:assert/strict';
import {makeTenData,makeTenFrame,makeTenCard,makeTenNarration,makeTenReply,supportsMakeTen} from './auto-make-ten.mjs';
let pairs=0,frames=0;
for(let a=1;a<10;a++)for(let b=1;b<=10;b++){
 const s={id:'bridge-ten',a,b,missing:false};if(a+b<=10){assert.equal(supportsMakeTen(s),false);continue;}
 const before=JSON.stringify(s),d=makeTenData(s);assert.equal(d.need,10-a);assert.equal(d.remaining,a+b-10);assert.equal(d.counters.length,a+b);
 for(let j=0;j<=20;j++){const f=makeTenFrame(s,j/20);assert.equal(f.length,a+b);assert.equal(new Set(f.map(x=>x.id)).size,a+b);assert.equal(f.filter(x=>x.group==='start').length,a);for(const c of f){assert.ok(c.x>=38&&c.x<=562);assert.ok(c.y>=50&&c.y<=160);}frames++;}
 const end=makeTenFrame(s,1);assert.equal(end.filter(c=>c.x<300).length,10);assert.equal(end.filter(c=>c.x>=300).length,d.remaining);assert.equal(new Set(end.map(c=>`${c.x}:${c.y}`)).size,a+b);
 for(const l of ['en','fr']){assert.ok(makeTenNarration(s,l).includes(`${a} + ${b} = ${a+b}`));assert.ok(makeTenReply({kind:'incorrect',n:a+b+1},s,l).includes(String(a+b)));assert.ok(!makeTenCard(s).scenes[0][l].includes(String(a+b)));}
 assert.equal(JSON.stringify(s),before);pairs++;
}
assert.equal(supportsMakeTen({id:'complete-ten',a:8,b:2,missing:true}),false);
console.log('MAKE TEN UNIT PASS',JSON.stringify({pairs,frames}));
