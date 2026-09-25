import assert from 'node:assert/strict';
import {choiceFor} from './core.mjs';
const options=['I will visit my friend tomorrow.','She will finish her work soon.','He might come to the party.'];
const inputs=[
 ['see he might come to the party',2],['C. He might come to the party.',2],
 ['c:he might come to the party',2],['C — He might come to the party!',2],
 ['He might come to the party.',2],['“He might come to the party.”',2],
 ['C',2],['Ｃ',2],['see',2],['The answer is C',2],['I choose option C',2],
 ['La réponse est C',2],['Je choisis C. He might come to the party.',2],
 ['सी He might come to the party.',2],['उत्तर सी',2],['मेरो उत्तर सी',2],
 ['سی He might come to the party.',2],['میرا جواب سی',2],
 ['Jibu ni C',2],['Ninachagua C. He might come to the party.',2],
 ['A. I will visit my friend tomorrow.',0],['bee She will finish her work soon',1],
 ['Why is C correct?',-1],['Is it C?',-1],['Can you explain C?',-1],
 ['He might come to the party because I am not sure',-1],
 ['B. He might come to the party.',-1],['C or B',-1],['not C',-1],
 ['The answer is C or B',-1],['C. That is a possibility.',-1],['',-1]
];
for(const [q,n] of inputs)assert.equal(choiceFor(q,options),n,q);
const numbers=[['1.5',['15','1.5','2'],1],['15',['1.5','15','2'],1],
 ['-2',['2','-2','20'],1],['−2',['2','-2','20'],1],
 ['2,5',['25','2,5','2.5'],1],['2.5',['25','2,5','2.5'],2],
 ['2 m',['2 cm','2 m','20 m'],1],['२',['2','4','6'],0],
 ['۲',['2','4','6'],0],['٢',['2','4','6'],0],
 ['Why is 2 different?',['2','4','6'],-1],['3',['2','4','6'],-1],
 ['same',['same.','Same','other'],-1],['Be',['Be','Do','Have'],0]];
for(const [q,o,n] of numbers)assert.equal(choiceFor(q,o),n,q);
for(const [lang,prefix,o] of [
 ['en','see',['red','blue','green']],['fr','C',['rouge','bleu','vert']],
 ['ne','सी',['रातो','नीलो','हरियो']],['ur','سی',['سرخ','نیلا','سبز']],
 ['sw','C',['nyekundu','buluu','kijani']]
])assert.equal(choiceFor(prefix+' '+o[2],o),2,lang);
assert.equal(choiceFor(null,options),-1);assert.equal(choiceFor('C',null),-1);
console.log('NEXT SELECTION UNIT PASS',JSON.stringify({cases:inputs.length+numbers.length+7,languages:5,regression:'see he might come to the party -> C',ambiguousQuestionsNotGraded:true,decimalAndSignPreserved:true}));
