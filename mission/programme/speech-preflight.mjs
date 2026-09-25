import assert from 'node:assert/strict';
import {runSpeech} from '../../api/mission-speech.js';
// Synthetic test phrases only, never a user's microphone recording. Runs once
// in the preview build using the existing server key; no audio artifacts saved.
if(process.env.OPENAI_API_KEY){
 const phrases={ne:'नमस्ते। आज हामी पानीको बारेमा सिक्छौँ।',ur:'سلام۔ آج ہم پانی کے بارے میں سیکھیں گے۔',sw:'Habari darasa. Leo tunajifunza kuhusu maji.'};
 for(const [lang,text] of Object.entries(phrases)){
  const voice=await runSpeech({action:'speak',lang,text,consent:true});assert.equal(voice.status,200,'AI speech '+lang+': '+voice.code);assert.ok(voice.audio.length>1000);
  const result=await runSpeech({action:'transcribe',lang,mime:voice.mime,audio:voice.audio,consent:true});assert.equal(result.status,200,'AI transcription '+lang+': '+result.code);
  assert.ok((lang==='ne'?/[\u0900-\u097f]/:lang==='ur'?/[\u0600-\u06ff]/:/maji|darasa|habari/i).test(result.text),'Expected language '+lang);
  console.log('PROGRAMME LIVE SPEECH PASS',JSON.stringify({lang,audioBytes:Math.floor(voice.audio.length*3/4),transcriptCharacters:result.text.length,syntheticRoundTrip:true}));
 }
}else console.log('PROGRAMME LIVE SPEECH SKIP: no server key');
