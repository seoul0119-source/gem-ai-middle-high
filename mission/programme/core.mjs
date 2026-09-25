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
export function choiceFor(input,options){return matchChoice(input,options);}
export function savedSession(value){return value&&value.version===VERSION&&LANGS.includes(value.lang)&&getUnit(value.unitId)&&validateLesson(value.lesson,value.unitId)&&Number.isInteger(value.index)&&value.index>=0&&value.index<6;}
// Strict selection matching. No fuzzy or substring matching and no AI grading.
// Sentence punctuation may differ; decimal points, signs and mathematical units
// must not disappear. A spoken label must agree with the repeated option text.
function selectionText(value){
 if(typeof value!=='string')return '';
 return value.normalize('NFKC')
  .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,'')
  .replace(/[०-९٠-٩۰-۹]/g,c=>{const n=c.charCodeAt(0);return String(n>=0x966?n-0x966:n>=0x6f0?n-0x6f0:n-0x660);})
  .replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\u2212/g,'-')
  .toLowerCase().trim().replace(/\s+/gu,' ')
  .replace(/^["'«»]+|["'«»]+$/gu,'')
  .replace(/[!?؟।。۔]+$/u,'').replace(/\.+$/u,'')
  .replace(/["'«»]+$/gu,'').trim();
}
const LABELS=[
 ['a','ay','eh','ए','اے','الف'],
 ['b','bee','be','bé','बी','بی','بے','bi'],
 ['c','see','sea','cee','cé','सी','سی','si']
];
const INTRO=/^(?:the answer is|my answer is|i choose|i select|i think it is|it is|it's|la réponse est|ma réponse est|je choisis|je pense que c'est|c'est|मेरो उत्तर|उत्तर|میرا جواب|جواب|jibu langu ni|jibu ni|ninachagua|nachagua)\s*[:：]?\s+/iu;
const OPTION=/^(?:option|choice|answer|réponse|choix|विकल्प|آپشن|chaguo)\s*[:：]?\s+/iu;
function uniqueMatch(text,options){
 const hits=[];for(let i=0;i<options.length;i++)if(text===selectionText(options[i]))hits.push(i);
 return hits.length===1?hits[0]:hits.length>1?-2:-1;
}
function matchChoice(input,options){
 if(typeof input!=='string'||!Array.isArray(options)||options.length<1||options.length>3||!options.every(x=>typeof x==='string'&&x.trim()))return -1;
 let q=selectionText(input);if(!q||q.length>450)return -1;
 // The exact displayed choice wins, even if it happens to contain a letter name.
 let direct=uniqueMatch(q,options);if(direct!==-1)return direct>=0?direct:-1;
 // Wrappers are affirmative phrases only. "Why C?" / "Is it C?" stay questions.
 for(let i=0;i<2;i++){const next=q.replace(INTRO,'').replace(OPTION,'');if(next===q)break;q=selectionText(next);}
 direct=uniqueMatch(q,options);if(direct!==-1)return direct>=0?direct:-1;
 for(let i=0;i<options.length;i++)for(const word of LABELS[i]){
  if(q===word)return i;
  if(!q.startsWith(word))continue;
  const after=q.slice(word.length);
  // A complete token, not a substring such as 'c' in 'can you explain'.
  if(!/^(?:\s|[.):：,،\-—])/u.test(after))continue;
  const remainder=selectionText(after.replace(/^[\s.):：,،\-—]+/u,''));
  if(remainder&&uniqueMatch(remainder,options)===i)return i;
 }
 return -1;
}
