// Compare question content, never option ordering. Numeric substitutions and
// punctuation alone do not make a new exercise.
export function normalizeGedPrompt(value){return String(value).normalize('NFKC').toLowerCase().replace(/\d+(?:[.,]\d+)*/g,'#').replace(/[^\p{L}#]+/gu,'');}
function grams(s){return new Set(Array.from({length:Math.max(0,s.length-2)},(_,i)=>s.slice(i,i+3)));}
export function similarGedPrompt(a,b){
 a=normalizeGedPrompt(a);b=normalizeGedPrompt(b);if(a===b)return true;
 if(Math.min(a.length,b.length)<12)return false;
 const x=grams(a),y=grams(b);let same=0;for(const g of x)if(y.has(g))same++;
 return 2*same/(x.size+y.size)>=0.84;
}
export function repeatedGedQuestions(questions,history=[]){const seen=[...history],issues=[];questions.forEach((q,i)=>{if(seen.some(p=>similarGedPrompt(q.prompt,p)))issues.push({question:i+1,reason:'Previously used or near-duplicate exercise',fix:'Replace with an original question using a different context, source passage and reasoning task; changing numbers, names or option order alone is insufficient.'});seen.push(q.prompt);});return issues;}
