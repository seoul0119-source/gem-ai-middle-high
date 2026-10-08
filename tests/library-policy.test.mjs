import {test} from 'node:test';import assert from 'node:assert/strict';
import {allowedUrl,blockedText,acceptReview} from '../lib/library-core.js';
import {verifyLibraryRequest} from '../api/library-job.js';
test('only approved HTTPS source pages and assets are fetched',()=>{
 assert.equal(allowedUrl('https://bookdash.org/books/hello/'),true);
 for(const u of ['http://bookdash.org/books/hello/','https://bookdash.org.evil.test/books/hello/','https://bookdash.org@127.0.0.1/books/hello/','https://bookdash.org:444/books/hello/','https://bookdash.org/books/hello/?url=evil'])assert.equal(allowedUrl(u),false);
});
test('uncertainty, incomplete pages, unsafe illustrations and policy flags fail closed',()=>{
 const b={pages:['a','b']},r={decision:'approve',level:2,confidence:0.99,allPagesRead:true,illustrationsSafe:true,flags:[],pageTexts:['Hello friend.','We play together.']};
 assert.equal(acceptReview(b,r),true);
 for(const patch of [{confidence:.97},{allPagesRead:false},{illustrationsSafe:false},{flags:['religion']},{pageTexts:['partial']},{pageTexts:['Natural selection.','Darwin.']},{decision:'review'},{level:6}])assert.equal(acceptReview(b,{...r,...patch}),false);
 assert.equal(blockedText('Grandpa Farouk and Amir grow plants.'),false);
 assert.equal(blockedText('Common ancestry and evolution.'),true);
});
test('unsigned or altered library job is rejected',async()=>{assert.equal(await verifyLibraryRequest({payload:JSON.stringify({purpose:'gem-library-v1',timestamp:Date.now(),action:'inspect',url:'https://bookdash.org/books/hello/'}),signature:'forged'}),null);});
