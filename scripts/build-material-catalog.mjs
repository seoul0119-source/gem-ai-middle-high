import {writeFileSync} from 'node:fs';
import {COURSES} from '../api/courses.js';
const list=Object.entries(COURSES).filter(([id])=>!/^g\d-math-(en|fr)$/.test(id)).map(([id,c])=>({id,language:'ko',grade:c.grade,subject:c.subject,title:c.title}));
for(const lang of ['en','fr']){
 const grades=lang==='en'?Array.from({length:12},(_,i)=>'Grade '+(i+1)):['CP','CE1','CE2','CM1','CM2','6e','5e','4e','3e','Seconde','Première','Terminale'];
 const subjects=lang==='en'?['Mathematics','Science','English Language Arts','Social Studies & History']:['Mathématiques','Sciences','Français','Histoire-Géographie-EMC'];
 grades.forEach((grade,i)=>subjects.forEach((subject,j)=>list.push({id:`materials-${lang}-${i+1}-${j}`,language:lang,grade,subject,title:`${grade} · ${subject}`})));
 const advanced=lang==='en'?['AP Calculus AB','AP Calculus BC','AP Statistics','Cells, Genetics & Physiology','AP Environmental Science','AP Physics 1','AP Physics 2','AP Chemistry','AP Physics C: Mechanics','AP Physics C: Electricity & Magnetism','AP English Language and Composition','AP English Literature and Composition','AP US History','AP World History','AP European History','AP US Government','AP Comparative Government','AP Human Geography','AP Macroeconomics','AP Microeconomics','AP Psychology','AP Art History']:['Spécialité Mathématiques Première','Spécialité Mathématiques Terminale','Mathématiques expertes','Physique-Chimie','Biologie, Terre & santé','Numérique & informatique','Sciences de l’ingénieur','HLP','LLCER','LLCA','LCA','LVC','HGGSP','Histoire des arts'];
 advanced.forEach((subject,i)=>list.push({id:`materials-${lang}-advanced-${i}`,language:lang,grade:lang==='en'?'Advanced / AP':'Spécialités & options',subject,title:subject}));
}
writeFileSync(new URL('../lib/material-catalog.json',import.meta.url),JSON.stringify(list,null,2)+'\n');
console.log(`${list.length} material course selections`);
