// Reuse verified geometry; only labels and teacher language are localized in the PC shell.
import {joinFrame} from '../auto-join.mjs';
import {countOnData,countOnFrame} from '../auto-count-on.mjs';
import {makeTenFrame} from '../auto-make-ten.mjs';
import {remainingData,remainingFrame} from '../auto-remaining.mjs';
export function boardSVG(s,progress,reveal){
 const p=reveal?progress:0;let dots=[],base='';
 const frame=x=>`<rect x="${x}" y="42" width="240" height="100" rx="8" fill="white" stroke="#90aa9d"/>${Array.from({length:10},(_,i)=>`<rect x="${x+(i%5)*48}" y="${42+Math.floor(i/5)*50}" width="48" height="50" fill="none" stroke="#b5c8bf"/>`).join('')}`;
 const line=d=>`<line x1="38" y1="180" x2="584" y2="180" stroke="#527569" stroke-width="3"/>${d.ticks.map(t=>`<line x1="${t.x}" y1="174" x2="${t.x}" y2="191" stroke="#527569"/><text x="${t.x}" y="220" text-anchor="middle" font-size="21">${t.n}</text>`).join('')}<circle cx="${d.startX}" cy="180" r="16" fill="#126d59"/>`;
 if(s.id==='join'){dots=joinFrame(s,p);}
 else if(s.id==='count-on'){const d=countOnData(s);base=line(d);dots=countOnFrame(s,p).map(x=>({...x,group:'add'}));}
 else if(s.id==='bridge-ten'){base=frame(30)+frame(330);dots=makeTenFrame(s,p);}
 else {const d=remainingData(s);base=d.method==='count'?line(d):s.missing?frame(180):frame(30)+frame(330);dots=remainingFrame(s,p,reveal);}
 const total=s.a+s.b,answer=s.missing?10-s.a:total;
 const formula=s.missing?`${s.a} + ${reveal?answer:'?'} = 10`:`${s.a} + ${s.b} = ${reveal?total:'?'}`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 305" role="img" aria-label="${formula}" dir="ltr">${base}${dots.map(d=>`<circle data-counter="${d.id}" cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="15" fill="${['green','start'].includes(d.group)?'#126d59':'#ba7b29'}"/>`).join('')}<text x="310" y="286" text-anchor="middle" font-family="Arial,sans-serif" font-size="29" fill="#173d43">${formula}</text></svg>`;
}
