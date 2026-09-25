// Curriculum selection, not a scientific claim. Reject whole packs rather than
// deleting fragments that could change a question's meaning or correct answer.
export const CONTENT_POLICY='gem-selected-syllabus-2026-09-25';
export const CONTENT_RULES=`GEM has selected a Bible-oriented curriculum. Omit biological evolution, natural selection, common ancestry, Darwinism and human evolution from explanations, activities, examples, questions, options, boards and follow-up answers in every language. Do not introduce these topics even to dispute them. Redirect questions about excluded topics to the current approved lesson. Choose other scientific learning content; never invent or substitute false scientific claims. Teach recorded world history with evidence and distinguish historical descriptions of beliefs from endorsing those beliefs. Do not infer additional exclusions from a person's religion or nationality.`;
const patterns=[
 /\b(?:evolution(?:ary|ism|ist|ists)?|darwin\w*|natural[\s-]+selection|common[\s-]+ancest(?:or|ors|ry))\b/iu,
 /(?<!\p{L})(?:évolution(?:nisme|niste|nistes)?|sélection[\s-]+naturelle|selection[\s-]+naturelle|anc[êe]tres?[\s-]+communs?|ascendance[\s-]+commune)\b/iu,
 /(?:जैविक\s*विकास|क्रमिक\s*विकास|विकासवाद|प्राकृतिक\s*(?:छनोट|चयन)|साझा\s*(?:पुर्खा|पूर्वज)|डार्विन)/u,
 /(?:ارتقا|ارتقاء|قدرتی\s*انتخاب|مشترک\s*(?:اجداد|آبا)|ڈارون|ڈاروِن)/u,
 /\b(?:mageuzi[\s-]+ya[\s-]+(?:viumbe|binadamu|kibiolojia)|nadharia[\s-]+ya[\s-]+mageuzi|uteuzi[\s-]+(?:wa[\s-]+)?(?:asili|kiasili)|mababu[\s-]+wa[\s-]+pamoja)\b/iu,
 /(?:진화론|자연선택|공통\s*조상|다윈|인류\s*진화)/u
];
export function excludedContent(value){
 if(typeof value==='string'){const text=value.normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,'');return patterns.some(p=>p.test(text));}
 if(Array.isArray(value))return value.some(excludedContent);
 if(value&&typeof value==='object')return Object.values(value).some(excludedContent);
 return false;
}
const redirects={
 en:"This topic is outside our selected classroom curriculum. Let’s return to the current lesson. Which part would you like help with?",
 fr:"Ce sujet ne fait pas partie du programme choisi pour notre classe. Revenons à la leçon en cours. Sur quelle partie souhaitez-vous de l’aide ?",
 ne:"यो विषय हाम्रो कक्षाको छनोट गरिएको पाठ्यक्रममा पर्दैन। अहिलेको पाठमा फर्कौं। तपाईंलाई कुन भागमा सहयोग चाहिन्छ?",
 ur:"یہ موضوع ہماری جماعت کے منتخب نصاب میں شامل نہیں ہے۔ آئیے موجودہ سبق کی طرف واپس آئیں۔ آپ کو کس حصے میں مدد چاہیے؟",
 sw:"Mada hii haimo katika mtaala uliochaguliwa kwa darasa letu. Turudi kwenye somo la sasa. Unahitaji msaada katika sehemu gani?"
};
export const scopeReply=lang=>redirects[lang]||redirects.en;
