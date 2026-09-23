import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
export async function loadAvatar(canvas,stage,status){
 let renderer,resizeObserver,raf=0;const modelUrl=new URL('./assets/avatar-sample-z.vrm',location.href).href;let cached=false;
 try{
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,1,.05,100);scene.add(new THREE.HemisphereLight(0xffffff,0x7890aa,2.2));const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(1.5,2.4,2.5);scene.add(light);
  let cache=null,response=null;try{cache=await caches.open('gem-g2-model-v1');response=await cache.match(modelUrl);cached=Boolean(response);}catch{}
  if(!response){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);try{response=await fetch(modelUrl,{signal:controller.signal});if(!response.ok)throw Error('Model HTTP '+response.status);const bytes=await response.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,4))!=='glTF')throw Error('Not a VRM file');response=new Response(bytes,{headers:{'Content-Type':'model/gltf-binary'}});if(cache)try{await cache.put(modelUrl,response.clone());}catch{}}finally{clearTimeout(timer);}}
  status(document.documentElement.lang==='fr'?'Préparation des textures 3D…':'Preparing 3D textures…');const bytes=await response.arrayBuffer();
  const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));const gltf=await loader.parseAsync(bytes,new URL('./assets/',location.href).href),vrm=gltf.userData.vrm;if(!vrm)throw Error('Missing VRM data');VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.combineSkeletons(gltf.scene);VRMUtils.rotateVRM0(vrm);scene.add(vrm.scene);
  const bone=n=>vrm.humanoid?.getNormalizedBoneNode(n),left=bone('leftUpperArm'),right=bone('rightUpperArm');if(left)left.rotation.z=-1.18;if(right)right.rotation.z=1.18;vrm.update(0);const box=new THREE.Box3().setFromObject(vrm.scene),center=box.getCenter(new THREE.Vector3()),h=Math.max(box.getSize(new THREE.Vector3()).y,1);vrm.scene.position.x-=center.x;vrm.scene.position.y-=box.min.y;
  function resize(){const w=stage.clientWidth,ht=stage.clientHeight;if(w<1||ht<1)return;renderer.setSize(w,ht,false);camera.aspect=w/ht;const top=h*1.04,bottom=h*.22,half=(top-bottom)/2,d=Math.max(half/Math.tan(Math.PI/12),h*.31/(Math.tan(Math.PI/12)*camera.aspect));camera.position.set(0,(top+bottom)/2,d);camera.lookAt(0,(top+bottom)/2,0);camera.updateProjectionMatrix();renderer.render(scene,camera);}
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);addEventListener('gem-display-resize',resize);resize();let elapsed=0,last=0,speaking=false;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const stats={cached,bytes:bytes.byteLength,frames:0,triangles:renderer.info.render.triangles,renderCalls:renderer.info.render.calls,hasExpressions:Boolean(vrm.expressionManager),hasHumanoid:Boolean(vrm.humanoid)};window.GEM_MODEL_STATS=stats;
  addEventListener('gem-avatar-speaking',e=>{speaking=Boolean(e.detail?.speaking);});
  function animate(now){raf=requestAnimationFrame(animate);if(document.hidden||stage.clientWidth===0||now-last<1000/24){if(document.hidden)last=now;return;}const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;if(!reduce.matches){const head=bone('head');if(head)head.rotation.y=Math.sin(elapsed*.55)*.025;const blink=elapsed%4.4;vrm.expressionManager?.setValue('blink',blink<.18?Math.sin(blink/.18*Math.PI):0);if(right){right.rotation.z=1.18-(speaking?(Math.sin(elapsed*2.2)+1)*.07:0);}}vrm.expressionManager?.setValue('aa',speaking?.18+Math.abs(Math.sin(elapsed*9.2))*.42:0);vrm.update(dt);renderer.render(scene,camera);stats.frames++;stats.mouth=vrm.expressionManager?.getValue('aa')||0;}
  raf=requestAnimationFrame(animate);
  addEventListener('pagehide',()=>{cancelAnimationFrame(raf);resizeObserver?.disconnect();renderer.dispose();},{once:true});
 }catch(error){resizeObserver?.disconnect();if(raf)cancelAnimationFrame(raf);renderer?.dispose();throw error;}
}
