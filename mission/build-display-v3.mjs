// Display-only patch after the existing input, speech and arithmetic checks.
import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
for(const file of ['display-v3.mjs','display-v3-browser-tests.mjs'])execFileSync(process.execPath,['--check','mission/'+file],{stdio:'inherit'});
await import('./build-input-v2.mjs');
const out='mission-dist';
for(const file of ['display-v3.mjs','display-v3.css'])await fs.copyFile('mission/'+file,out+'/'+file);
let app=await fs.readFile(out+'/app.mjs','utf8');
if(app.includes('installDisplayV3'))throw Error('Display patch already installed');
app+="\nimport {installDisplayV3} from './display-v3.mjs';\ninstallDisplayV3();\n";
await fs.writeFile(out+'/app.mjs',app);
let html=await fs.readFile(out+'/index.html','utf8');
if(!html.includes('</head>'))throw Error('Missing HTML head');
html=html.replace('</head>','<link rel="stylesheet" href="./display-v3.css"></head>').replace('초2 입력 수정 v2 · 첫 문제부터 응답 · 답변 후 정답 공개 · 종료 확인','초2 화면 수정 v3 · 시작/일시정지 하나 · 휴대폰 전체 화면');
await fs.writeFile(out+'/index.html',html);
let avatar=await fs.readFile('mission/avatar.mjs','utf8');
const start=avatar.indexOf('  function resize(){'),end=avatar.indexOf('\n  resizeObserver=',start);
if(start<0||end<start)throw Error('Avatar resize anchor missing');
avatar=avatar.slice(0,start)+`
  function resize(){
   const w=canvas.clientWidth,ht=canvas.clientHeight;
   if(w<1||ht<1)return;
   const presentation=Boolean(canvas.closest('.gem-presentation'));
   renderer.setSize(w,ht,false);camera.aspect=w/ht;
   const top=h*(presentation?1.05:1.04),bottom=h*(presentation?-.025:.22),half=(top-bottom)/2;
   const halfWidth=presentation?Math.max(box.getSize(new THREE.Vector3()).x/2,h*.27)*1.12:h*.31;
   const d=Math.max(half/Math.tan(Math.PI/12),halfWidth/(Math.tan(Math.PI/12)*camera.aspect));
   camera.position.set(0,(top+bottom)/2,d);camera.lookAt(0,(top+bottom)/2,0);camera.updateProjectionMatrix();
   renderer.render(scene,camera);
   // Read only a few pixels immediately after rendering; no screenshots, recordings or uploads.
   const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2()),rgba=new Uint8Array(4);
   let opaqueSamples=0;
   for(const fraction of [.25,.4,.55,.7,.85]){gl.readPixels(Math.floor(size.x/2),Math.min(size.y-1,Math.floor(size.y*fraction)),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);if(rgba[3]>32)opaqueSamples++;}
   const head=new THREE.Vector3(0,h,0).project(camera),feet=new THREE.Vector3(0,0,0).project(camera);
   window.GEM_RENDER_BOUNDS={width:w,height:ht,aspect:camera.aspect,presentation,headY:head.y,feetY:feet.y,opaqueSamples};
  }
`+avatar.slice(end);
if(!avatar.includes('resizeObserver.observe(stage);'))throw Error('Avatar resize observer anchor missing');
avatar=avatar.replace('resizeObserver.observe(stage);','resizeObserver.observe(stage);resizeObserver.observe(canvas);');
await fs.writeFile('mission/avatar-display.generated.mjs',avatar);
await build({entryPoints:['mission/avatar-display.generated.mjs'],bundle:true,format:'esm',outfile:out+'/avatar.bundle.js',target:['es2020'],minify:true,legalComments:'eof'});
let sw=await fs.readFile(out+'/sw.js','utf8');
if(!sw.includes('gem-group-input-v2')||!sw.includes("'./interaction-support.mjs'"))throw Error('Display cache anchor missing');
sw=sw.replace('gem-group-input-v2','gem-group-display-v3').replace("'./interaction-support.mjs'","'./interaction-support.mjs','./display-v3.mjs','./display-v3.css'");
await fs.writeFile(out+'/sw.js',sw);
execFileSync(process.execPath,['--check',out+'/app.mjs'],{stdio:'inherit'});
await import('./display-v3-browser-tests.mjs');
