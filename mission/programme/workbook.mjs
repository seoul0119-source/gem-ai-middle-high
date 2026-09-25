import {WORKBOOK_VERSION,readWorkbookHistory,nextWorkbookUnit,previousForUnit,rememberWorkbook} from './workbook-core.mjs';
const words={
 en:{title:'AI practice workbook',button:'Create new AI questions',description:'A fresh set of 3 questions, with explanation and a group activity. Units rotate within this grade and subject.',note:'Generates new content online using the existing AI service. API usage applies. Review the draft before starting.',pending:'Creating new questions…',tag:'Fresh AI practice'},
 fr:{title:'Cahier d’exercices IA',button:'Créer de nouvelles questions',description:'3 nouvelles questions, avec explication et activité de groupe. Les unités alternent dans ce niveau et cette matière.',note:'Génération en ligne avec le service IA existant. Consommation API facturée. Vérifiez le brouillon avant de commencer.',pending:'Création de nouvelles questions…',tag:'Nouveaux exercices IA'},
 ne:{title:'AI अभ्यास पुस्तिका',button:'AI बाट नयाँ प्रश्न बनाउनुहोस्',description:'व्याख्या र समूह गतिविधिसहित ३ नयाँ प्रश्न। यही कक्षा र विषयका एकाइहरू पालैपालो आउँछन्।',note:'पहिलेकै AI सेवा प्रयोग गरेर अनलाइन सामग्री बनाइन्छ। API प्रयोगको शुल्क लाग्छ। सुरु गर्नुअघि मस्यौदा जाँच्नुहोस्।',pending:'नयाँ प्रश्न बनाइँदै छन्…',tag:'नयाँ AI अभ्यास'},
 ur:{title:'AI مشق کی کتاب',button:'AI سے نئے سوالات بنائیں',description:'وضاحت اور گروہی سرگرمی کے ساتھ 3 نئے سوالات۔ اسی جماعت اور مضمون کی اکائیاں باری باری آتی ہیں۔',note:'موجودہ AI خدمت سے آن لائن مواد بنتا ہے۔ API استعمال کی فیس لگتی ہے۔ شروع کرنے سے پہلے مسودہ دیکھیں۔',pending:'نئے سوالات تیار ہو رہے ہیں…',tag:'نئی AI مشق'},
 sw:{title:'Kitabu cha mazoezi cha AI',button:'Tengeneza maswali mapya',description:'Maswali 3 mapya, maelezo na shughuli ya kikundi. Vitengo hubadilishana ndani ya darasa na somo hili.',note:'Maudhui mapya yanatengenezwa mtandaoni kwa huduma ya AI iliyopo. Matumizi ya API yana gharama. Hakiki rasimu kabla ya kuanza.',pending:'Kutengeneza maswali mapya…',tag:'Mazoezi mapya ya AI'}
};
export const workbookLabel=(lang,key)=>(words[lang]||words.en)[key];
export function installWorkbook(h){
 let history=[];
 try{history=readWorkbookHistory(JSON.parse(localStorage.getItem(WORKBOOK_VERSION)));}catch{}
 function start(){
  if(h.busy())return;
  const unit=nextWorkbookUnit(h.course(),history);
  if(!unit)return;
  // Generation is only initiated here: never by render, reload, language change, or Continue.
  return h.generate(unit.id,previousForUnit(history,unit.id));
 }
 function remember(unitId,lesson){history=rememberWorkbook(history,unitId,lesson);try{localStorage.setItem(WORKBOOK_VERSION,JSON.stringify(history));}catch{}}
 function render(){
  const lang=h.lang(),root=document.getElementById('unit-list');
  root.querySelector('#ai-workbook-card')?.remove();
  const a=document.createElement('article');a.id='ai-workbook-card';a.dir='auto';
  const title=document.createElement('h3');title.textContent=workbookLabel(lang,'title');
  const desc=document.createElement('p');desc.textContent=workbookLabel(lang,'description');
  const button=document.createElement('button');button.id='ai-workbook';button.type='button';button.className='primary';button.disabled=h.busy()||!h.course();button.textContent=workbookLabel(lang,h.busy()?'pending':'button');button.onclick=start;
  const note=document.createElement('small');note.textContent=workbookLabel(lang,'note');
  a.append(title,desc,button,note);root.append(a);
 }
 return {render,start,remember};
}
