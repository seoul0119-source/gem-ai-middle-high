import assert from 'node:assert/strict';
import {handleGedLesson} from '../lib/ged-lesson.js';
import {GED_COURSES} from '../lib/ged-courses.js';
import {createGedQuestions} from '../lib/ged-bank.js';
if(!process.env.OPENAI_API_KEY)throw Error('GED live verification requires configured AI service');
console.log('GED live verification: 3 tutor requests, no student records are written.');
for(const courseId of Object.keys(GED_COURSES)){
 const student={id:'GED_BUILD_VERIFICATION',courseId,courseRunId:'ged-build-verification-v1'};
 const first=await handleGedLesson({student,messages:[{role:'user',content:'시작'}]});
 const messages=[{role:'user',content:'시작'},{role:'assistant',content:first.text},{role:'user',content:'이 문제를 풀려면 어떤 개념을 알아야 하나요? 정답은 말하지 말고 짧게 설명해 주세요.'}];
 const r=await handleGedLesson({student,messages});assert.ok(r.text.length>30);assert.equal(r.progress.event,'discussion');assert.equal(r.record,undefined);
 messages.push({role:'assistant',content:r.text},{role:'user',content:createGedQuestions(courseId,student.courseRunId)[0].answer});
 const graded=await handleGedLesson({student,messages});assert.equal(graded.record?.outcome,'correct');assert.equal(graded.record?.attempts,1);assert.match(graded.text,/문제 2\/10/);
 console.log(JSON.stringify({gedVerification:'passed',courseId}));
}
