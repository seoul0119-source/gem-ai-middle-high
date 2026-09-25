import {excludedContent} from './content-policy.mjs';
import {LANGS,getUnit} from './curriculum.mjs';
export const VERSION='gem-common-programme-v2';
export const KINDS=['explain','question','activity','question','question','recap'];
const str={type:'string'},arr={type:'array',items:str};
const localeSchema={type:'object',additionalProperties:false,properties:{narration:str,prompt:str,options:arr,explanation:str,board:arr},required:['narration','prompt','options','explanation','board']};
export const LESSON_SCHEMA={type:'object',additionalProperties:false,properties:{steps:{type:'array',items:{type:'object',additionalProperties:false,properties:{kind:{type:'string',enum:['explain','question','activity','recap']},answerIndex:{type:'integer'},text:{type:'object',additionalProperties:false,properties:Object.fromEntries(LANGS.map(l=>[l,localeSchema])),required:LANGS}},required:['kind','answerIndex','text']}}},required:['steps']};
export function validateLesson(p,unitId){
 if(!p||!getUnit(unitId)||!Array.isArray(p.steps)||p.steps.length!==6||excludedContent(p.steps))return false;
 return p.steps.every((s,i)=>s.kind===KINDS[i]&&Number.isInteger(s.answerIndex)&&(s.kind==='question'?s.answerIndex>=0&&s.answerIndex<3:s.answerIndex===-1)&&LANGS.every(l=>{const t=s.text?.[l];return t&&['narration','prompt','explanation'].every(k=>typeof t[k]==='string'&&t[k].length<=2400)&&t.narration.trim().length>0&&Array.isArray(t.options)&&t.options.length===(s.kind==='question'?3:0)&&t.options.every(x=>typeof x==='string'&&x.trim()&&x.length<=350)&&Array.isArray(t.board)&&t.board.length>=1&&t.board.length<=4&&t.board.every(x=>typeof x==='string'&&x.trim()&&x.length<=450)&&(!(s.kind==='question')||t.prompt.trim()&&t.explanation.trim());}));
}
export function normalize(s){return String(s).normalize('NFKC').toLowerCase().replace(/[०-९٠-٩۰-۹]/g,c=>{const n=c.charCodeAt(0);return String(n>=0x966?n-0x966:n>=0x6f0?n-0x6f0:n-0x660);}).replace(/[.!?؟।]/g,'').trim();}
export function choiceFor(input,options){const n=normalize(input);const i=options.findIndex(x=>normalize(x)===n);if(i>=0)return i;const map={a:0,b:1,c:2,'ए':0,'बी':1,'सी':2};return Object.hasOwn(map,n)?map[n]:-1;}
export function savedSession(value){return value&&value.version===VERSION&&LANGS.includes(value.lang)&&getUnit(value.unitId)&&validateLesson(value.lesson,value.unitId)&&Number.isInteger(value.index)&&value.index>=0&&value.index<6;}
