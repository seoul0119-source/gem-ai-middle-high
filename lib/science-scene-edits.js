// Factual repairs may change exact spans in scenes 2–5, never the approved
// first scene, titles, scene ordering, or unrelated text. Match every proposal
// against the immutable input before applying any of them to a fresh clone.
export const sceneEditsSchema={
 type:'object',additionalProperties:false,required:['edits'],properties:{edits:{
  type:'array',minItems:1,maxItems:24,items:{
   type:'object',additionalProperties:false,required:['sceneNumber','field','lineIndex','before','after'],properties:{
    sceneNumber:{type:'integer',minimum:2,maximum:5},
    field:{type:'string',enum:['line','narration']},
    lineIndex:{type:'integer',minimum:-1,maximum:3},
    before:{type:'string',minLength:0,maxLength:650},
    after:{type:'string',minLength:1,maxLength:650}
   }
  }
 }}
};

const invalid=code=>{throw Object.assign(Error('수업 수정 내용을 확인하지 못했습니다. 다시 시도해 주세요.'),{code:`scene_edit_${code}`});};
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');

export function applySceneEdits(candidate,editsResponse){
 if(!exactKeys(candidate,['scenes'])||!Array.isArray(candidate.scenes)||candidate.scenes.length!==4)invalid('invalid_candidate');
 for(const scene of candidate.scenes){
  if(!exactKeys(scene,['title','lines','narration'])||typeof scene.title!=='string'||typeof scene.narration!=='string'||!Array.isArray(scene.lines)||scene.lines.length<2||scene.lines.length>4||scene.lines.some(line=>typeof line!=='string'))invalid('invalid_candidate');
 }
 if(!exactKeys(editsResponse,['edits'])||!Array.isArray(editsResponse.edits)||editsResponse.edits.length<1||editsResponse.edits.length>24)invalid('invalid_response');
 const targets=new Map();
 for(const edit of editsResponse.edits){
  if(!exactKeys(edit,['sceneNumber','field','lineIndex','before','after'])||!Number.isInteger(edit.sceneNumber)||edit.sceneNumber<2||edit.sceneNumber>5||!['line','narration'].includes(edit.field)||!Number.isInteger(edit.lineIndex)||typeof edit.before!=='string'||edit.before.length>650||typeof edit.after!=='string'||!edit.after.trim()||edit.after.length>650)invalid('invalid_edit');
  if(edit.before===edit.after)invalid('noop');
  const sceneIndex=edit.sceneNumber-2,scene=candidate.scenes[sceneIndex],narration=edit.field==='narration';
  if(narration?edit.lineIndex!==-1:edit.lineIndex<0||edit.lineIndex>=scene.lines.length)invalid('invalid_target');
  const key=`${sceneIndex}:${edit.field}:${edit.lineIndex}`,original=narration?scene.narration:scene.lines[edit.lineIndex];
  const target=targets.get(key)||{sceneIndex,lineIndex:edit.lineIndex,narration,original,spans:[],appends:[]};
  if(edit.before===''){
   if(!narration)invalid('invalid_target');
   target.appends.push(edit.after);
  }else{
   const start=original.indexOf(edit.before);
   if(start<0)invalid('target_not_found');
   if(original.indexOf(edit.before,start+1)!==-1)invalid('ambiguous');
   const end=start+edit.before.length;
   if(target.spans.some(span=>start<span.end&&end>span.start))invalid('overlap');
   target.spans.push({start,end,after:edit.after});
  }
  targets.set(key,target);
 }
 // Compute every result without mutating either caller-owned input. A later
 // invalid target therefore cannot leave earlier changes partly applied.
 for(const target of targets.values()){
  let value=target.original;
  for(const span of [...target.spans].sort((a,b)=>b.start-a.start))value=value.slice(0,span.start)+span.after+value.slice(span.end);
  if(target.appends.length)value+=' '+target.appends.join(' ');
  if(value===target.original)invalid('noop');
  target.value=value;
 }
 const result={scenes:candidate.scenes.map(scene=>({...scene,lines:[...scene.lines]}))};
 for(const target of targets.values()){
  if(target.narration)result.scenes[target.sceneIndex].narration=target.value;
  else result.scenes[target.sceneIndex].lines[target.lineIndex]=target.value;
 }
 return result;
}
