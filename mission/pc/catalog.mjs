// GEM common programme. A teaching language never selects a national curriculum.
export const LANGUAGES=Object.freeze([
 {code:'en',name:'English',locale:'en-US',dir:'ltr',mobileTarget:true},
 {code:'fr',name:'Français',locale:'fr-FR',dir:'ltr',mobileTarget:false},
 {code:'ne',name:'नेपाली',locale:'ne-NP',dir:'ltr',mobileTarget:false},
 {code:'ur',name:'اردو',locale:'ur-PK',dir:'rtl',mobileTarget:false},
 {code:'sw',name:'Kiswahili',locale:'sw-KE',dir:'ltr',mobileTarget:false}
]);
export const SUBJECTS=Object.freeze([
 {id:'math',minGrade:1,maxGrade:12,targetLanguage:null},
 {id:'science',minGrade:1,maxGrade:12,targetLanguage:null},
 {id:'english',minGrade:1,maxGrade:12,targetLanguage:'en'},
 {id:'world-history',minGrade:7,maxGrade:12,targetLanguage:null}
]);
export const PROGRAMME={id:'gem-common-v1',nationalAlignment:false,defaultMinutes:40,advancedTracks:false,optional:['local-history','local-society','local-language','art','music'],primaryDevices:['PC','TV','projector']};
export function language(code){return LANGUAGES.find(x=>x.code===code)||LANGUAGES[0];}
export function course(subject,grade){
 const spec=SUBJECTS.find(x=>x.id===subject);
 if(!spec||!Number.isInteger(grade)||grade<spec.minGrade||grade>spec.maxGrade)return {available:false,status:'not-offered'};
 if(subject==='math'&&grade===2)return {available:true,status:'pc-language-pilot',lessonId:'gem-g2-add20-v1',targetLanguage:null};
 return {available:false,status:'planned',targetLanguage:spec.targetLanguage};
}
export const translationStatus={en:'pilot',fr:'pilot',ne:'draft-needs-teacher-review',ur:'draft-needs-teacher-review',sw:'draft-needs-teacher-review'};
