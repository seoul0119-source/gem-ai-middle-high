import {test} from 'node:test';import assert from 'node:assert/strict';
import {allowedUrl,blockedText,acceptReview,inspectBook,reviewSchema} from '../lib/library-core.js';
import {verifyLibraryRequest,narrationText} from '../lib/library-job.js';
test('only approved HTTPS source pages and assets are fetched',()=>{
 assert.equal(allowedUrl('https://bookdash.org/books/hello/'),true);
 for(const u of ['http://bookdash.org/books/hello/','https://bookdash.org.evil.test/books/hello/','https://bookdash.org@127.0.0.1/books/hello/','https://bookdash.org:444/books/hello/','https://bookdash.org/books/hello/?url=evil'])assert.equal(allowedUrl(u),false);
});
test('uncertainty, incomplete pages, unsafe illustrations and policy flags fail closed',()=>{
 const b={pages:['a','b']},r={rightsVerified:true,licenseEvidenceText:'Creative Commons Attribution 4.0',decision:'approve',level:2,confidence:0.99,allPagesRead:true,illustrationsSafe:true,flags:[],pageTexts:['Hello friend.','We play together.']};
 assert.equal(acceptReview(b,r),true);
 for(const patch of [{rightsVerified:false},{licenseEvidenceText:''},{confidence:.97},{allPagesRead:false},{illustrationsSafe:false},{flags:['religion']},{pageTexts:['partial']},{pageTexts:['Natural selection.','Darwin.']},{decision:'review'},{level:6}])assert.equal(acceptReview(b,{...r,...patch}),false);
 assert.equal(blockedText('Grandpa Farouk and Amir grow plants.'),false);
 assert.equal(blockedText('Common ancestry and evolution.'),true);
});
test('unsigned or altered library job is rejected',async()=>{assert.equal(await verifyLibraryRequest({payload:JSON.stringify({purpose:'gem-library-v1',timestamp:Date.now(),action:'inspect',url:'https://bookdash.org/books/hello/'}),signature:'forged'}),null);});
test('structured transcription preserves blank pages and exact image count',()=>{
 const s=reviewSchema(17);assert.equal(s.properties.pageTexts.minItems,17);assert.equal(s.properties.pageTexts.maxItems,17);
 const b={pages:['cover','blank','story']},r={rightsVerified:true,licenseEvidenceText:'CC BY 4.0',decision:'approve',level:1,confidence:.99,allPagesRead:true,illustrationsSafe:true,flags:[],pageTexts:['','','Hello friend.']};
 assert.equal(acceptReview(b,r),true);assert.equal(acceptReview(b,{...r,pageTexts:['Hello friend.']}),false);
});
test('narration omits an ownership form without rewriting story text',()=>{
 const story='Which shoes? You choose!';
 assert.equal(narrationText({review:{pageTexts:['','This book belongs to\n\n____________',story,'Please, please! More peas!']}}),story+'\n\nPlease, please! More peas!');
 assert.equal(narrationText({review:{pageTexts:['This book belongs to my friend.']}}),'This book belongs to my friend.');
});
test('manual inspection stops before AI or book downloads if the source licence changes',async()=>{
 const urls=[];
 await assert.rejects(inspectBook('https://bookdash.org/books/hello/','unused',{fetcher:async url=>{urls.push(url);return new Response('<html>No licence evidence</html>',{headers:{'Content-Type':'text/html'}});}}),/license_changed/);
 assert.deepEqual(urls,['https://bookdash.org/books/']);
});
