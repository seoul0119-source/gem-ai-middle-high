const frenchGrades=Object.freeze({CP:1,CE1:2,CE2:3,CM1:4,CM2:5,'6e':6});

// Callers supply a course resolved from the trusted classroom catalog. French
// 6e is the app's sixth-year counterpart, although it belongs to collège.
export function elementaryBoardGrade(course){
 if(course?.language==='ko')return Number(/^초등학교 ([1-6])학년$/.exec(course.grade)?.[1])||null;
 if(course?.language==='en')return Number(/^Grade ([1-6])$/.exec(course.grade)?.[1])||null;
 if(course?.language==='fr')return Object.hasOwn(frenchGrades,course.grade)?frenchGrades[course.grade]:null;
 return null;
}

const levels=Object.freeze({
 1:'VERY, VERY EASY: Assume a child just starting school. Use very short spoken sentences and familiar objects, people and everyday actions. Introduce one tiny idea at a time. Show what to notice or do before naming the idea. Introduce at most one unfamiliar term at a time, explain it immediately in everyday words, and reuse the same simple words. Start with things a child can count, see or compare before any required symbol.',
 2:'VERY EASY: Use short everyday sentences and a familiar concrete example. Explain each small action in order, with a brief reminder of what it means. Introduce a necessary new word only after its everyday example and explain the word immediately. Keep each sentence to one simple idea.',
 3:'EASY: Begin with a familiar example, then name and explain the concept. Connect small steps with clear words such as first, next and because in the classroom language. Explain necessary operations instead of jumping to a rule. Keep each sentence focused on one idea.',
 4:'SOMEWHAT EASIER: Use clear everyday wording, with the meaning beside each necessary new subject term. Break a method into manageable steps and explain why each step helps. Move from a concrete example to a simple general rule without adding advanced background.',
 5:'A LITTLE EASIER: Keep the correct subject concepts and terms, explain unfamiliar terms in plain words, and break calculations or reasoning into clear small steps. Use one accessible example and make the connection from the example to the rule explicit.',
 6:'A LITTLE EASIER: Keep the sixth-year core concepts, with plain explanations of essential terminology and a concrete example before abstraction. State the purpose of each important reasoning or calculation step. Avoid compressed textbook wording and unnecessary advanced background.',
});

export function elementaryBoardGuidance(course,{answer=false}={}){
 const grade=elementaryBoardGrade(course);if(!grade)return '';
 const scope=answer?'For this paused answer, address only the actual question in the requested short reply. Explain its necessary small steps without generating scenes or recapping all ten questions. Follow the current practice-answer restrictions.':`Preserve all required worksheet methods. Group related methods across the five scenes and explain their small steps one at a time. Keep the existing scene count and narration bounds; use the space for clear concrete teaching, not filler, extra topics or long greetings.${grade<=2?' Prefer two very short board lines per scene, each with one simple idea.':''} This grade contract applies during generation, independent review and repairs. Review substantive accessibility barriers such as unexplained abstract terms, formula-only teaching or skipped essential steps; sentence-length and stylistic preferences alone are not rejection reasons. Do not demand more advanced detail to pass review.`;
 return `\nGEM GRADE-ACCESSIBILITY CONTRACT — YEAR ${grade}: ${levels[grade]} Speak naturally in the selected classroom language; these English instructions are not student text. Preserve correct facts, relevant conditions and units. Explain necessary prerequisites at this level using different example values or text, never an unresolved question's answer. Introduce symbols only after their everyday meaning; use them only when needed by this grade and actual task. Do not raise the explanation level merely because the worksheet uses difficult wording. ${scope}`;
}

export function elementaryWorksheetScaffolding(course){
 return elementaryBoardGrade(course)?'For this first-to-sixth-year learner, explicitly explain necessary arithmetic or prerequisite reasoning in small, age-appropriate steps using a different example. Do not assume algebraic rearrangements or an untaught operation. Teach only the prerequisites actually needed for these questions; do not add advanced derivations or every equivalent symbolic identity.':'';
}
