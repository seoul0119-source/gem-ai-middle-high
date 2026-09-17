import {handleMaterials,validMaterial} from '../lib/materials-ai.js';
if(!process.env.OPENAI_API_KEY)throw Error('Worksheet live verification requires the configured AI service.');
console.log('Worksheet live verification: real provider calls; no student records are written.');
const cases=[
 ['materials-en-sat-reading-writing','words in context'],
 ['materials-en-sat-reading-writing','Central Ideas and Details'],
 ['m2-history','4.19 혁명'],
 ['materials-en-11-1','Laws of motion'],
 ['materials-fr-bac-argumentation','Distinguer un argument et un exemple']
];
for(const [courseId,topic] of cases){
 const started=Date.now();console.log(JSON.stringify({worksheetVerification:'started',courseId,topic}));
 const result=await handleMaterials({mode:'generate',courseId,topic});
 if(!validMaterial(result.material))throw Error('Invalid reviewed worksheet: '+courseId);
 console.log(JSON.stringify({worksheetVerification:'passed',courseId,questions:result.material.questions.length,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
}
