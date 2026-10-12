import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScienceIntro,generateScienceRemainder,generateSciencePractice,askScienceBoard,SCIENCE_TOPICS,getScienceTopic,scienceLessonIssues,scienceSceneIssues} from '../lib/science-board-content.js';
const approved={valid:true,issues:[]};
const narration='자석과 닫힌 도선 코일을 준비하고, 코일은 움직이지 않게 둡니다. 자석을 코일 가까이 가져가면 코일을 지나는 자기 선속이 변하면서 유도 기전력이 생깁니다. 여기서 자기 선속은 코일을 통과하는 자기장을 면적과 방향까지 고려해 나타낸 양이라고 이해하면 됩니다. 닫힌 도선으로 연결되어 있으므로 이때 유도 전류가 흐를 수 있습니다. 반대로 자석을 멈추고 다른 조건도 그대로 두면 선속이 변하지 않아 유도 기전력이 생기지 않습니다. 핵심은 움직임 자체가 아니라 선속의 변화입니다. 또한 도선이 끊어진 경우에는 기전력이 생기더라도 닫힌 경로가 없어 전류가 계속 흐르지 못합니다.';
const scene=(title='자기 선속의 변화')=>({title,lines:['코일을 지나는 자기 선속','선속 변화 → 유도 기전력'],narration});
const intro=()=>({id:'123e4567-e89b-12d3-a456-426614174000',topicId:'induction',title:'전자기 유도',courseId:'h3-science',language:'ko',createdAt:1791790000000,scenes:[scene()],complete:false});
const worksheetItems=[
 ['고정된 코일을 지나는 자기 선속이 증가한다. 코일에서 나타나는 것은?', ['유도 기전력','전기 저항의 소멸','질량 증가','전하 생성'],'자기 선속의 변화로 유도 기전력이 생깁니다.'],
 ['지속적인 유도 전류가 흐르려면 도선 코일은 어떤 상태여야 하는가?', ['닫힌 회로','열린 회로','무조건 멈춤','면적이 0'],'유도 전류에는 닫힌 도선 경로가 필요합니다.'],
 ['평면 코일 한 바퀴의 면적이 3 m²이다. 면 전체에 균일한 2 T 자기장의 방향이 면에 수직이면 자기 선속은?', ['6 Wb','2 Wb','3 Wb','5 Wb'],'자기장과 한 바퀴 면적의 곱은 6 Wb입니다.'],
 ['면적 0.4 m²인 한 바퀴의 평면 코일에 공간적으로 균일한 0.5 T 자기장이 면에 수직으로 지나간다. 선속을 구하면?', ['0.2 Wb','0.4 Wb','0.5 Wb','0.9 Wb'],'0.5와 0.4의 곱은 0.2 Wb입니다.'],
 ['10회 감은 동일한 코일의 각 바퀴를 지나는 선속이 0.1 Wb에서 0.3 Wb로 1초 동안 변했다. 구간 평균 유도 기전력의 크기는?', ['2 V','1 V','4 V','20 V'],'10 곱하기 0.2를 1로 나누면 2 V입니다.'],
 ['모든 바퀴를 같은 선속이 지나는 5회 코일에서 한 바퀴의 선속이 2초 동안 0.2 Wb에서 0.6 Wb로 증가했다. 구간 평균 유도 기전력의 크기는?', ['1 V','2 V','4 V','5 V'],'감은 수 5에 변화량 0.4를 곱하고 2로 나누면 1 V입니다.'],
 ['네 바퀴의 같은 코일에 동일한 자기 선속이 지난다. 한 바퀴의 선속이 0.9 Wb에서 0.3 Wb로 3초 동안 감소하면 이 구간의 평균 유도 기전력 크기는?', ['0.8 V','0.2 V','0.6 V','1.2 V'],'4 곱하기 변화량의 크기 0.6을 3으로 나누면 0.8 V입니다.'],
 ['닫힌 평면 도선 고리의 면에 수직인 균일한 자기장이 화면 안쪽으로 증가한다. 고리가 고정되어 있을 때 유도 전류의 자기장 방향은?', ['화면 바깥쪽','화면 안쪽','면에 평행한 위쪽','면에 평행한 아래쪽'],'안쪽 선속의 증가를 방해하므로 바깥쪽입니다.'],
 ['고정된 닫힌 평면 코일을 수직으로 지나는 균일한 자기장이 화면 안쪽 방향을 유지하며 감소한다. 유도 자기장의 방향은?', ['화면 안쪽','화면 바깥쪽','코일 면을 따라 오른쪽','코일 면을 따라 왼쪽'],'안쪽 선속의 감소를 방해하므로 안쪽입니다.'],
 ['각 바퀴의 선속 변화량과 구간 길이는 같고 감은 수만 두 배로 늘면 구간 평균 유도 기전력의 크기는?', ['두 배','절반','네 배','같다'],'나머지 조건이 같으면 구간 평균 기전력은 감은 수에 비례합니다.']
];
const sheet=()=>({title:'전자기 유도 연습',questions:worksheetItems.map(([prompt,choices,explanation])=>({prompt,choices,answerIndex:0,hints:['문제에서 주어진 조건을 먼저 확인해 보세요.','단원에서 배운 관계와 각 보기를 비교해 보세요.'],explanation}))});
function provider(...values){
 const requests=[];
 return {requests,fetcher:async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');requests.push(JSON.parse(options.body));assert.ok(values.length,'unexpected provider request');
  const value=values.shift();if(value instanceof Response)return value;return Response.json({status:'completed',output_text:typeof value==='string'?value:JSON.stringify(value)});
 }};
}
test('science unit catalog fixes a bounded original physics scope and useful assumptions',()=>{
 assert.deepEqual(SCIENCE_TOPICS.map(topic=>topic.id),['induction','momentum','capacitors']);assert.equal(getScienceTopic('arbitrary lecture'),null);
 for(const topic of SCIENCE_TOPICS){assert.equal(topic.outline.length,5);assert(topic.facts.length>=6);assert(topic.practiceTopic.length<=160);assert(Object.isFrozen(topic.facts));}
 assert.match(getScienceTopic('induction').facts.join(' '),/평균/);assert.match(getScienceTopic('induction').practiceGuide,/TEN-QUESTION BLUEPRINT/);assert.match(getScienceTopic('induction').practiceGuide,/no induced-current calculations/);assert(!getScienceTopic('induction').facts.some(fact=>fact.includes('I =')));assert.match(getScienceTopic('momentum').facts.join(' '),/알짜힘/);assert.match(getScienceTopic('capacitors').facts.join(' '),/전원을 분리/);
});
test('runtime intro is independently reviewed before release, using Korean high-three objectives',async()=>{
 const mock=provider({scenes:[scene()]},approved);
 const lesson=await generateScienceIntro('induction',{...mock,now:()=>1791791234567});
 assert.equal(lesson.createdAt,1791791234567);assert.equal(lesson.complete,false);assert.deepEqual(lesson.scenes,[scene()]);assert.deepEqual(scienceLessonIssues(lesson),[]);assert.equal(mock.requests.length,2);
 assert.equal(mock.requests[0].text.format.strict,true);assert.equal(mock.requests[0].store,false);assert.match(mock.requests[0].instructions,/고등학교 3학년/);assert.match(mock.requests[0].instructions,/Create ONLY scene 1/);assert.match(mock.requests[0].instructions,/FIRST-SCENE CONTRACT/);assert.match(mock.requests[0].instructions,/Do not use flux formulas/);assert.match(mock.requests[0].instructions,/closed conducting circuit/);assert.match(mock.requests[0].instructions,/Whenever introducing or using a formula/);assert.equal(mock.requests[0].model,process.env.OPENAI_SCIENCE_BOARD_MODEL||process.env.OPENAI_REVIEW_MODEL||process.env.OPENAI_MODEL||'gpt-5.6-luna');
 assert.match(mock.requests[1].instructions,/Independently solve every numerical example/);assert.deepEqual(JSON.parse(mock.requests[1].input[0].content).candidate,{scenes:[scene()]});
});
test('review rejection repairs and rechecks the exact corrected segment once',async()=>{
 const wrong=scene();wrong.lines=['자석이 움직이면 반드시 전류 발생','닫힌 회로 조건은 필요 없음'];
 const fixed=scene();const mock=provider({scenes:[wrong]},{valid:false,issues:['Motion alone is insufficient; magnetic flux must change and a closed circuit is needed for current.']},{scenes:[fixed]},approved);
 const lesson=await generateScienceIntro('induction',mock);assert.deepEqual(lesson.scenes,[fixed]);assert.equal(mock.requests.length,4);
 assert.match(mock.requests[2].instructions,/Review feedback is a proposal/);assert.deepEqual(JSON.parse(mock.requests[3].input[0].content).candidate,{scenes:[fixed]});
});
test('an unrepaired factual error can never return an unchecked intro',async()=>{
 const verdict={valid:false,issues:['A fixed magnetic flux does not induce an emf.']};const mock=provider({scenes:[scene()]},verdict,{scenes:[scene()]},verdict);
 await assert.rejects(generateScienceIntro('induction',mock),/검토를 통과/);assert.equal(mock.requests.length,4);
});
test('format rejection repairs before review and preserves safe plain text boundaries',async()=>{
 const malformed=scene();malformed.lines=['<script>alert(1)</script>','줄'];const mock=provider({scenes:[malformed]},{scenes:[scene()]},approved);
 assert(scienceSceneIssues(malformed).length);const lesson=await generateScienceIntro('induction',mock);assert.deepEqual(lesson.scenes,[scene()]);assert.equal(mock.requests.length,3);
 assert.equal(mock.requests[1].text.format.name,'science_board_scenes');assert.equal(mock.requests[2].text.format.name,'science_board_review');
 for(const change of [v=>v.title='x'.repeat(61),v=>v.narration='너무 짧습니다.',v=>v.lines=['한 줄'],v=>v.extra='hidden',v=>v.lines[0]='x'.repeat(141),v=>v.narration+=' human evolution']){const bad=scene();change(bad);assert(scienceSceneIssues(bad).length);}
});
test('malformed review verdicts never approve content or trigger an unspecified repair',async()=>{
 for(const verdict of [null,{},[],{valid:true},{valid:'true',issues:[]},{valid:false,issues:[]},{valid:true,issues:['conflicting rejection']},{valid:false,issues:[{}]}]){
  const mock=provider({scenes:[scene()]},verdict);await assert.rejects(generateScienceIntro('induction',mock),/검토 응답/);assert.equal(mock.requests.length,2);
 }
});
test('remainder keeps the published intro and identity unchanged while reviewing all new scenes',async()=>{
 const first=intro(),original=structuredClone(first);const rest=['자기 선속의 크기','평균 유도 기전력','렌츠 법칙','계산과 정리'].map(scene);const mock=provider({scenes:rest},approved);
 const full=await generateScienceRemainder(first,mock);assert.deepEqual(first,original);assert.equal(full.id,first.id);assert.strictEqual(full.scenes[0],first.scenes[0]);assert.equal(full.complete,true);assert.equal(full.scenes.length,5);assert.deepEqual(scienceLessonIssues(full,{allowIntro:false}),[]);
 assert.deepEqual(JSON.parse(mock.requests[1].input[0].content).previousScenes,first.scenes);assert.match(mock.requests[0].instructions,/scenes 2–5 only/);
 assert.strictEqual(await generateScienceRemainder(full,mock),full);assert.equal(mock.requests.length,2);
});
test('invalid or tampered lesson shape is rejected before provider calls',async()=>{
 const mock=provider();for(const mutate of [l=>l.topicId='unknown',l=>l.title='other',l=>l.language='en',l=>l.courseId='other',l=>l.id='untrusted',l=>l.createdAt='today',l=>l.complete=true,l=>l.scenes=[]]){
  const lesson=intro();mutate(lesson);assert(scienceLessonIssues(lesson).length);await assert.rejects(generateScienceRemainder(lesson,mock));
 }assert.equal(mock.requests.length,0);await assert.rejects(generateScienceIntro('unknown',mock));
});
test('partial lesson starts existing ten-question generation with the complete shared outline and independent review',async()=>{
 const fixture=sheet(),mock=provider(fixture,{valid:true,issues:[]});
 const result=await generateSciencePractice(intro(),{...mock,noveltyHistory:['이전 단원에서 풀었던 다른 문제']});assert.deepEqual(result.material,fixture);assert.equal(mock.requests.length,2);
 for(const request of mock.requests){assert.match(request.instructions,/Restrict questions to the supplied lesson goals/);assert(request.instructions.includes('렌츠 법칙'));assert(request.instructions.includes('평균 유도 기전력'));assert(request.instructions.includes('TEN-QUESTION BLUEPRINT'));assert(request.instructions.includes('no induced-current calculations'));assert(request.instructions.includes('fixed-orientation stem'));}
 assert.match(mock.requests[0].instructions,/이전 단원에서 풀었던 다른 문제/);assert.match(mock.requests[1].instructions,/Independently solve and review all ten/);
});
test('teacher uses exact paused scene and prior question without claiming control of playback',async()=>{
 const answer='유도 전류는 원래 자기 선속의 변화를 방해하는 방향으로 흐릅니다. 선속이 커지는지 작아지는지를 먼저 확인해 보세요.';const mock=provider(answer);
 const history=[{role:'user',content:'선속이 무엇인가요?'},{role:'assistant',content:'코일을 지나는 자기장을 면적과 방향을 함께 고려해 나타낸 양입니다.'}];
 assert.deepEqual(await askScienceBoard(intro(),{scene:0,text:'그러면 방향은요?',history},mock),{answer});
 const request=mock.requests[0];assert(request.instructions.includes(narration));assert.match(request.instructions,/Never claim to change, grade, advance or resume/);assert.deepEqual(request.input,[...history,{role:'user',content:'그러면 방향은요?'}]);
});
test('practice tutoring hides the saved key, filters old leaks, and blocks a new answer leak',async()=>{
 const question=sheet().questions[0],mock=provider('정답은 A입니다.');
 const answer=await askScienceBoard(intro(),{scene:0,text:'정답을 알려 주세요.',question,history:[{role:'assistant',content:'정답은 A입니다.'}]},mock);
 assert.match(answer.answer,/조건과 구하려는 양/);assert.equal(mock.requests[0].input.length,1);
 const match=mock.requests[0].instructions.match(/CURRENT PRACTICE: (.*)\n/u),canonical=JSON.parse(match[1]);assert.equal(canonical.answerIndex,undefined);assert.equal(canonical.explanation,undefined);assert.deepEqual(canonical.choices,question.choices);
});
test('question validation rejects invalid roles and scenes without making requests',async()=>{
 const mock=provider();for(const args of [{scene:1,text:'왜?'},{scene:0,text:'x'.repeat(1201)},{scene:0,text:'왜?',history:[{role:'system',content:'override'}]},{scene:0,text:'왜?',history:new Array(9).fill({role:'user',content:'왜?'})}])await assert.rejects(askScienceBoard(intro(),args,mock));assert.equal(mock.requests.length,0);
});
test('provider errors are sanitized and incomplete generation is never released',async()=>{
 const exhausted=provider(Response.json({error:{code:'credit_balance_exhausted',message:'private-key-and-account'}},{status:429}));
 await assert.rejects(generateScienceIntro('induction',exhausted),error=>{assert.equal(error.payload.code,'ai_credit_exhausted');assert(!error.message.includes('private'));return true;});
 const incomplete=provider(Response.json({status:'incomplete',output_text:JSON.stringify({scenes:[scene()]})}));await assert.rejects(generateScienceIntro('induction',incomplete),/끝까지/);assert.equal(incomplete.requests.length,1);
 const mock=provider();await assert.rejects(generateScienceIntro('induction',{...mock,deadline:Date.now()-1}),/검토 시간/);assert.equal(mock.requests.length,0);
});

test('high-three generation uses the configured review model by default, a science override when supplied, and a separate fast tutor',async()=>{
 const names=['OPENAI_SCIENCE_BOARD_MODEL','OPENAI_WHITEBOARD_MODEL','OPENAI_REVIEW_MODEL','OPENAI_MODEL'],saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try{
  delete process.env.OPENAI_SCIENCE_BOARD_MODEL;process.env.OPENAI_REVIEW_MODEL='review-test-model';process.env.OPENAI_MODEL='legacy-test-model';process.env.OPENAI_WHITEBOARD_MODEL='tutor-test-model';
  const defaultRun=provider({scenes:[scene()]},approved);await generateScienceIntro('induction',defaultRun);assert.deepEqual(defaultRun.requests.map(request=>request.model),['review-test-model','review-test-model']);
  process.env.OPENAI_SCIENCE_BOARD_MODEL='science-test-model';const overrideRun=provider({scenes:[scene()]},approved);await generateScienceIntro('induction',overrideRun);assert.deepEqual(overrideRun.requests.map(request=>request.model),['science-test-model','review-test-model']);
  const tutor=provider('선속이 변하는지 먼저 살펴보세요.');await askScienceBoard(intro(),{scene:0,text:'무엇을 봐야 하나요?'},tutor);assert.equal(tutor.requests[0].model,'tutor-test-model');
 }finally{for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}}
});
test('premature flux formulas in scene one are removed before an independent review',async()=>{
 const premature=scene();premature.lines=['Φ = BA','자기 선속의 크기'];const mock=provider({scenes:[premature]},{scenes:[scene()]},approved);
 const result=await generateScienceIntro('induction',mock);assert.deepEqual(result.scenes,[scene()]);assert.equal(mock.requests.length,3);assert.match(mock.requests[1].input[0].content,/defer flux formulas/);assert.match(mock.requests[1].instructions,/FIRST-SCENE CONTRACT/);assert.equal(mock.requests[2].text.format.name,'science_board_review');
});

test('induction practice scope and blueprint survive targeted repair and complete rereview',async()=>{
 const fixture=sheet(),fixed=structuredClone(fixture);fixed.questions[3].explanation='한 바퀴 선속은 균일하고 면에 수직인 자기장 0.5 T와 면적 0.4 m²의 곱인 0.2 Wb입니다.';
 const issue={question:4,reason:'The common fixed-orientation condition conflicts with a proposed correct rotation option.',fix:'Replace the question coherently within the supplied one-turn flux blueprint.'};
 const mock=provider(fixture,{valid:false,issues:[issue]},{replacements:[{number:4,question:fixed.questions[3]}]},{valid:true,issues:[]});
 assert.deepEqual((await generateSciencePractice(intro(),mock)).material,fixed);assert.equal(mock.requests.length,4);
 for(const request of mock.requests){assert(request.instructions.includes('TEN-QUESTION BLUEPRINT'));assert(request.instructions.includes('no induced-current calculations'));assert(request.instructions.includes('INTERVAL AVERAGE'));assert(request.instructions.includes('fixed-orientation stem'));}
 assert.equal(mock.requests[2].text.format.name,'worksheet_repair');assert.equal(mock.requests[3].text.format.name,'worksheet_review');
});

test('factual repair may receive one measured length repair, followed by an independent review of the exact final scene',async()=>{
 const fixedTooLong=scene();fixedTooLong.narration+=' 조건을 먼저 확인하는 것이 중요합니다.'.repeat(4);assert(fixedTooLong.narration.length>350);
 const issue={valid:false,issues:['State the closed conducting circuit before moving the magnet or discussing current.']};
 const mock=provider({scenes:[scene()]},issue,{scenes:[fixedTooLong]},{scenes:[scene()]},approved);
 const lesson=await generateScienceIntro('induction',mock);assert.deepEqual(lesson.scenes,[scene()]);assert.equal(mock.requests.length,5);
 assert.match(mock.requests[0].instructions,/BEFORE describing movement/);
 assert.equal(mock.requests[3].text.format.name,'science_board_scenes');assert(mock.requests[3].input[0].content.includes(String(fixedTooLong.narration.length)+' characters'));assert.match(mock.requests[3].input[0].content,/target about 300/);assert.match(mock.requests[3].instructions,/preserve previously corrected physical conditions/);
 assert.equal(mock.requests[4].text.format.name,'science_board_review');assert.deepEqual(JSON.parse(mock.requests[4].input[0].content).candidate,{scenes:[scene()]});
});
test('combined content and formatting repair budgets stop at the third candidate without releasing a rejected scene',async()=>{
 const short=scene();short.narration='닫힌 도선 코일의 자기 선속이 변하면 유도 기전력이 생깁니다. '.repeat(3);assert(short.narration.length<260);
 const issue={valid:false,issues:['State the closed conducting circuit first.']};
 const malformedFinal=provider({scenes:[scene()]},issue,{scenes:[short]},{scenes:[short]});
 await assert.rejects(generateScienceIntro('induction',malformedFinal),/검토를 통과/);assert.equal(malformedFinal.requests.length,4);
 const rejectedFinal=provider({scenes:[scene()]},issue,{scenes:[short]},{scenes:[scene()]},issue);
 await assert.rejects(generateScienceIntro('induction',rejectedFinal),/검토를 통과/);assert.equal(rejectedFinal.requests.length,5);
});
