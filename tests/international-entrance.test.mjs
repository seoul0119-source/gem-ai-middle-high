import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {serveStudentPage} from '../lib/student-page.js';
const source=readFileSync(new URL('../entrance-catalog.js',import.meta.url),'utf8');
const courses=JSON.parse(readFileSync(new URL('../lib/material-catalog.json',import.meta.url),'utf8'));
const context={URLSearchParams};vm.runInNewContext(source,context);const entrance=context.GEMEntrance;
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('all 96 regular EN/FR selections enter the new authenticated worksheet classroom for the exact grade and subject',()=>{
 let count=0;
 for(const language of ['en','fr'])for(const level of ['elementary','middle','high'])for(const grade of entrance.internationalGrades(language,level))for(const subject of ['math','science','language','social']){
  const url=new URL(entrance.internationalDestination(language,level,grade.value,subject),'https://portal.test');
  assert.equal(url.pathname,'/materials.html');assert.equal(url.searchParams.get('classroom'),'1');assert.equal(url.searchParams.get('language'),language);
  const course=courses.find(c=>c.id===url.searchParams.get('course'));
  assert.equal(course.language,language);assert.equal(course.grade,grade.label);count++;
  const library=new URL(entrance.internationalDestination(language,level,grade.value,subject,'general',true),'https://portal.test');
  assert.equal(library.searchParams.get('course'),course.id);assert.equal(library.searchParams.get('browse'),'1');assert.equal(library.searchParams.has('classroom'),false);
 }
 assert.equal(count,96);
 assert.throws(()=>entrance.internationalDestination('fr','middle',10,'math'));
});

test('existing advanced selections resolve to real worksheet courses; grouped cards keep course choice in the new library',()=>{
 const paths={en:{math:3,science:8,language:2,social:1},fr:{math:3,science:4,language:0,social:1}};
 for(const [language,subjects]of Object.entries(paths))for(const [subject,n]of Object.entries(subjects))for(let i=1;i<=n;i++){
  const url=new URL(entrance.internationalDestination(language,'high',language==='fr'?10:9,subject,'advanced'+i),'https://portal.test');
  assert.ok(courses.some(c=>c.id===url.searchParams.get('course')&&c.language===language));
  const grouped=subject==='social'||language==='en'&&subject==='science'&&i===8;
  assert.equal(url.searchParams.get(grouped?'browse':'classroom'),'1');
 }
 assert.equal(new URL(entrance.internationalDestination('en','high',11,'science','advanced4'),'https://portal.test').searchParams.get('course'),'materials-en-advanced-7','AP Chemistry must not become AP Physics 2');
});

test('real homepage submit handler routes English middle math and French CP math to the new classrooms and leaves Korean routing intact',async()=>{
 const handlerSource=index.slice(index.indexOf('    loginForm.addEventListener("submit"'),index.lastIndexOf('  </script>'));
 for(const language of ['en','fr','ko']){
  let handler,destination,logins=0;
  const ctx={URLSearchParams,loginForm:{addEventListener:(_n,f)=>handler=f},studentIdInput:{value:'SYNTHETIC',focus(){}},loginError:{textContent:''},loginButton:{disabled:false,textContent:''},document:{getElementById:()=>({disabled:false})},boardEntrance:Promise.resolve(null),entranceParams:new URLSearchParams(),GEMEntrance:{...entrance,requestSession:async body=>{assert.equal(body.action,'login');logins++;return {student:{id:'SYNTHETIC'}};}},selectedLanguage:language,selectedSchoolLevel:language==='en'?'middle':'elementary',selectedInternationalGrade:language==='en'?6:1,selectedSubject:'math',selectedHighSchoolPathway:'general',selectedSupportCourse:'',supportRoutes:{},koreanDestination:()=>'/materials.html?course=e1-math&language=ko&classroom=1',location:{search:''},prepareParentRegistrationNotice:()=>false,enterClassroom:async value=>{destination=value},updateLoginButtonLabel(){}};
  vm.runInNewContext(handlerSource,ctx);await handler({preventDefault(){},submitter:{id:'login-button'}});
  assert.equal(logins,1);assert.equal(ctx.loginError.textContent,'');
  const url=new URL(destination,'https://portal.test');assert.equal(url.pathname,'/materials.html');assert.equal(url.searchParams.get('classroom'),'1');assert.equal(url.searchParams.get('course'),language==='en'?'materials-en-6-0':language==='fr'?'materials-fr-1-0':'e1-math');
 }
});

test('slow login aborts and errors remain errors instead of granting entry',async()=>{
 let expire,signal,cleared=0;
 const ctx={URLSearchParams,AbortController,setTimeout:f=>{expire=f;return 1},clearTimeout:()=>cleared++,fetch:async(_url,options)=>{signal=options.signal;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}};
 vm.runInNewContext(source,ctx);const pending=ctx.GEMEntrance.requestSession({action:'login',studentId:'SYNTHETIC'});expire();
 await assert.rejects(pending,/입장 확인 시간이/);assert.equal(signal.aborted,true);assert.equal(cleared,1);
 ctx.fetch=async()=>Response.json({error:'회원 이용이 제한되었습니다.'},{status:403});await assert.rejects(ctx.GEMEntrance.requestSession({action:'login'}),e=>e.status===403&&/제한/.test(e.message));
});

test('worksheet bridge posts the signed ticket and exact French destination once to the shared new classroom',async()=>{
 const html=readFileSync(new URL('../materials.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
 let release,requests=0,submitted=0;const forms=[],nodes={status:{textContent:''},retry:{disabled:false}};
 const ctx={URLSearchParams,location:{search:'?language=fr&course=materials-fr-1-0&classroom=1',replace:()=>assert.fail('must not redirect a signed session')},GEMEntrance:{requestSession:async body=>{requests++;assert.equal(body.classroom,'en');await new Promise(r=>release=r);return {ticket:'synthetic-ticket'}}},document:{getElementById:id=>nodes[id],createElement:tag=>({tag,children:[],append(n){this.children.push(n)},submit(){submitted++}}),body:{append:n=>forms.push(n)}}};
 vm.runInNewContext(script,ctx);await ctx.enter();assert.equal(requests,1,'double click does not allocate another pass');release();for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(submitted,1);assert.equal(forms[0].action,'https://gem-english-middle-school-math.seoul0119.chatgpt.site/api/learning/entry');
 assert.deepEqual(Object.fromEntries(forms[0].children.map(n=>[n.name,n.value])),{ticket:'synthetic-ticket',destination:'/materials'+ctx.location.search});
});

test('expired portal sessions preserve only the selected worksheet parameters while returning to ID login',async()=>{
 const headers={};let status;await serveStudentPage({method:'GET',headers:{},query:{page:'materials',language:'fr',course:'materials-fr-1-0',classroom:'1',redirect:'https://untrusted.test'}},{setHeader:(k,v)=>headers[k]=v,status:n=>{status=n;return {end(){}}}});
 assert.equal(status,303);const target=new URL(headers.Location,'https://portal.test');assert.equal(target.origin,'https://portal.test');assert.equal(target.searchParams.get('course'),'materials-fr-1-0');assert.equal(target.searchParams.get('classroom'),'1');assert.equal(target.searchParams.get('language'),'fr');assert.equal(target.searchParams.has('redirect'),false);
});
