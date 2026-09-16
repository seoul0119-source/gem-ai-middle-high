import {handleMaterials,validMaterial} from '../lib/materials-ai.js';
if(!process.env.OPENAI_API_KEY)throw Error('Worksheet live verification requires the configured AI service.');
console.log('Worksheet live verification: Korean middle 2 history, 4.19 Revolution; no student records are written.');
const started=Date.now();const result=await handleMaterials({mode:'generate',courseId:'m2-history',topic:'4.19 혁명'});
if(!validMaterial(result.material))throw Error('Invalid reviewed history worksheet');
console.log(JSON.stringify({worksheetVerification:'passed',questions:result.material.questions.length,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
