// Shared contract for the existing GEM TOEIC scene illustrations. Metadata is
// persisted with the prompt; rendering it must never rewrite saved answers.
const key = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[_.\s]+/g, '-');
const aliases = {
  office: ['office', '사무실'], warehouse: ['warehouse', '창고'],
  'meeting-room': ['meeting-room', 'conference-room', '회의실'],
  cafe: ['cafe', 'café', 'coffee-shop', '카페'], restaurant: ['restaurant', '식당'],
  store: ['store', 'shop', '상점'], library: ['library', '도서관'], classroom: ['classroom', '교실'],
  station: ['station', 'train-station', '기차역'], airport: ['airport', '공항'], hotel: ['hotel', '호텔'],
  street: ['street', '거리'], park: ['park', '공원'], garden: ['garden', '정원'],
  'typing-computer': ['typing-computer', 'typing-at-a-computer', 'typing-on-a-computer', 'typing-on-a-keyboard', 'using-a-computer', 'typing', '컴퓨터로-작업하는', '컴퓨터-사용', '타이핑'],
  'labeling-box': ['labeling-box', 'labelling-box', 'labeling-a-box', 'labelling-a-box', '상자에-라벨-붙이기'],
  'carrying-box': ['carrying-box', 'carrying-a-box', 'carrying-boxes', '상자-나르기'],
  'reading-document': ['reading-document', 'reading-a-document', 'reading-documents', '문서-읽기'],
  'writing-document': ['writing-document', 'writing-a-document', 'writing-on-paper', '문서-작성'],
  talking: ['talking', 'having-a-conversation', '대화'], meeting: ['meeting', 'having-a-meeting', '회의'],
  'serving-drink': ['serving-drink', 'serving-a-drink', 'serving-drinks', 'serving-coffee', '음료-서빙'],
  'loading-boxes': ['loading-boxes', 'loading-a-box', '상자-싣기'],
  cleaning: ['cleaning', 'sweeping', 'sweeping-the-floor', 'cleaning-the-floor', '바닥-청소'],
  walking: ['walking', '걷기'], sitting: ['sitting', 'sitting-on-a-chair', '앉아-있기'], standing: ['standing', '서-있기', 'none', '없음'],
};
const resolve = value => Object.keys(aliases).find(name => aliases[name].includes(key(value)));
const objects = {
  desk:['desk','desks'], table:['table','tables','packing-table'], monitor:['monitor','monitors','computer','computers','screen'],
  keyboard:['keyboard'], chair:['chair','chairs'], window:['window','windows'], shelves:['shelf','shelves','shelving','bookshelf','bookshelves'],
  boxes:['box','boxes','cartons'], books:['book','books'], counter:['counter','service-counter'], cup:['cup','cups','coffee-cup','mug','mugs','drink','drinks'],
  paper:['paper','papers','document','documents'], pen:['pen','pencil'], truck:['truck','delivery-truck','van'], broom:['broom'],
  trees:['tree','trees'], bench:['bench','benches'], buildings:['building','buildings'], road:['road','street'],
  board:['board','blackboard','whiteboard'], sign:['sign','signs','departure-board','platform-sign','reception-sign'],
};
export const SCENE_PLACES = ['warehouse','office','meeting-room','cafe','restaurant','store','station','airport','street','park','garden','library','classroom','hotel'];
export const SCENE_ACTIONS = ['labeling-box','carrying-box','typing-computer','reading-document','writing-document','talking','meeting','serving-drink','loading-boxes','cleaning','walking','sitting','standing'];
const placeObjects = {
  warehouse:['shelves','boxes','sign'], office:['window','desk'], 'meeting-room':['window','table'],
  cafe:['counter','sign'], restaurant:['counter','sign'], store:['shelves','boxes'], library:['shelves','books'], classroom:['board','desk'],
  station:['sign','counter','bench'], airport:['sign','counter','bench'], hotel:['sign','counter','bench'],
  street:['buildings','window','road'], park:['trees','bench'], garden:['trees','bench'],
};
const actionObjects = {
  'labeling-box':['table','boxes'], 'carrying-box':['boxes'], 'typing-computer':['desk','table','monitor','keyboard','chair'],
  'reading-document':['table','paper'], 'writing-document':['table','paper','pen'],
  talking:[], meeting:['table'], 'serving-drink':['counter','cup'], 'loading-boxes':['truck','boxes'],
  cleaning:['broom'], walking:[], sitting:['chair'], standing:[],
};
export function sceneObjects(scene) {
  return [...new Set([...(placeObjects[scene.place] || []), ...(scene.people ? actionObjects[scene.action] || [] : [])])];
}
const field = /^\s*(?:[-*]\s*)?(장소|인물|행동|배경|place|people|action|background)\s*[:：]\s*(.*?)\s*$/iu;
const fields = {장소:'place',인물:'people',행동:'action',배경:'background',place:'place',people:'people',action:'action',background:'background'};
function extract(value) {
  const source=String(value || '').replace(/\r/g,'');
  const block=source.match(/\[TOEIC\s*그림\s*시작\]([\s\S]*?)\[TOEIC\s*그림\s*끝\]/iu);
  let text=block ? block[1] : '', start=block?.index ?? -1, length=block?.[0].length ?? 0;
  if(!block){
    // Older saved worksheets sometimes omitted the wrapping markers. Match
    // one contiguous run of all four labelled fields, never arbitrary prose.
    const lines=source.split('\n');let offset=0;
    for(let i=0;i<lines.length;i++){
      if(field.test(lines[i])){
        const found=new Set();let j=i;
        while(j<lines.length&&(field.test(lines[j])||!lines[j].trim())){const m=lines[j].match(field);if(m)found.add(fields[m[1].toLowerCase()]);j++;}
        if(found.size===4){text=lines.slice(i,j).join('\n');start=offset;length=text.length;break;}
      }
      offset+=lines[i].length+1;
    }
  }
  if(start<0)return {prompt:source.trim(),values:null,hasMetadata:/\[TOEIC\s*그림\s*시작\]/iu.test(source)};
  const values={};let duplicate=(source.match(/\[TOEIC\s*그림\s*시작\]/giu)||[]).length>1||(source.slice(0,start)+source.slice(start+length)).split('\n').some(line=>field.test(line));
  for(const line of text.split('\n')){const m=line.match(field);if(m){const name=fields[m[1].toLowerCase()];if(name in values)duplicate=true;values[name]=m[2];}else if(line.trim())duplicate=true;}
  return {prompt:(source.slice(0,start)+source.slice(start+length)).replace(/\n{3,}/g,'\n\n').trim(),values,hasMetadata:true,duplicate};
}
function choiceKey(value){return String(value || '').normalize('NFKC').replace(/^\s*[A-D][.)]\s*/u,'').trim().replace(/\s+/g,' ').toLowerCase();}
function removeDuplicateChoices(prompt,choices){
  if(!Array.isArray(choices)||choices.length!==4)return prompt;
  const lines=prompt.split('\n');
  for(let i=0;i<lines.length;i++){
    const matches=[];let end=i;
    for(const expected of 'ABCD'){
      while(end<lines.length&&!lines[end].trim())end++;
      const match=lines[end]?.match(/^\s*([A-D])[.)]\s*(.+?)\s*$/u);
      if(!match||match[1]!==expected)break;matches.push(match);end++;
    }
    if(matches.length===4){
      const actual=matches.map(m=>choiceKey(m[2])).sort(),saved=choices.map(choiceKey).sort();
      if(actual.every((text,j)=>text===saved[j])){lines.splice(i,end-i);return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();}
    }
  }
  return prompt;
}
export function needsScene(prompt){
  return /\[TOEIC\s*그림\s*시작\]|(?:TOEIC\s+(?:Listening\s+)?|Listening\s+)Part\s*1\b|(?:그림|사진)(?:\s*정보)?(?:을|를|과|에|에서)|(?:그림|사진)\s*묘사|(?:look at|shown in|describes?|description of|depicted in|refer to)\s+(?:(?:the|this|a|following|below)\s+)*(?:picture|photo(?:graph)?|illustration)|(?:picture|photo(?:graph)?)\s+(?:below|above|shows)|(?:regardez|sur)\s+(?:l['’]image|la\s+photo)/iu.test(String(prompt||''));
}
export function worksheetQuestion(prompt,choices=[],requirePicture=false){
  const extracted=extract(prompt),clean=removeDuplicateChoices(extracted.prompt,choices);
  if(!extracted.values)return {prompt:clean,scene:null,issue:extracted.hasMetadata||(requirePicture&&needsScene(prompt))?'missing_scene':null};
  const v=extracted.values,place=resolve(v.place),action=resolve(v.action);
  const count=String(v.people??'').normalize('NFKC').trim().match(/^(?:(?:사람|인물|people|persons?)\s*)?([0-3])\s*(?:명|people|persons?)?$/iu);
  const people=count?Number(count[1]):-1;
  if(extracted.duplicate||!SCENE_PLACES.includes(place)||!SCENE_ACTIONS.includes(action)||people<0||((action==='meeting'||action==='talking')&&people<2)||(people===0&&action!=='standing'))return {prompt:clean,scene:null,issue:'invalid_scene'};
  const scene={place,people,action,background:[]};
  const raw=String(v.background||'').split(/[,，]/u).map(key).filter(Boolean);
  const background=raw.map(value=>Object.keys(objects).find(name=>objects[name].includes(value)));
  const available=sceneObjects(scene);
  if(!raw.length||background.some(value=>!value||!available.includes(value)))return {prompt:clean,scene:null,issue:'unsupported_background'};
  scene.background=[...new Set(background)];
  return {prompt:clean,scene,issue:null};
}
export const worksheetSceneRules=`For every picture-dependent exercise, include one complete [TOEIC 그림 시작] block with four lines 장소:, 인물:, 행동:, 배경:, ending [TOEIC 그림 끝]. This also applies to TOEFL if a picture is needed. Text-only listening/reading questions must not ask students to look at a missing image. Never repeat A–D choices in prompt; choices belongs only in its array. These worksheet rules override embedded interactive course scripts. The application displays the existing GEM illustration matching this exact finite contract, not an external photograph. Places: ${SCENE_PLACES.join(', ')}. Actions: ${SCENE_ACTIONS.join(', ')}. Use canonical tokens; people must be 0–3. Exactly one main person performs the action; any additional people stand nearby. Talking/meeting needs at least two people. Zero people requires action standing and describes an empty location. Only mention visible objects. Place objects: ${JSON.stringify(placeObjects)}. Action objects (added only with people): ${JSON.stringify(actionObjects)}. 배경 must be a comma-separated subset of those actual objects, never unspecified props. Do not ask about fine details, gender, age, exact background object counts, or motion that a static illustration cannot establish. Ensure exactly one choice describes the rendered scene and the other three plainly contradict it. The reviewer must solve the question against this rendering contract.`;
