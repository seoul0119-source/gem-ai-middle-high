import {writeFileSync} from 'node:fs';
import {COURSES} from '../api/courses.js';
const list=Object.entries(COURSES).filter(([id])=>!/^g\d-math-(en|fr)$/.test(id)).map(([id,c])=>({id,language:'ko',grade:c.grade,subject:c.subject,title:c.title}));
for(const lang of ['en','fr']){
 const grades=lang==='en'?Array.from({length:12},(_,i)=>'Grade '+(i+1)):['CP','CE1','CE2','CM1','CM2','6e','5e','4e','3e','Seconde','Première','Terminale'];
 const subjects=lang==='en'?['Mathematics','Science','English Language Arts','Social Studies & History']:['Mathématiques','Sciences','Français','Histoire-Géographie-EMC'];
 grades.forEach((grade,i)=>subjects.forEach((subject,j)=>list.push({id:`materials-${lang}-${i+1}-${j}`,language:lang,grade,subject,title:`${grade} · ${subject}`})));
 const advanced=lang==='en'?['AP Calculus AB','AP Calculus BC','AP Statistics','Cells, Genetics & Physiology','AP Environmental Science','AP Physics 1','AP Physics 2','AP Chemistry','AP Physics C: Mechanics','AP Physics C: Electricity & Magnetism','AP English Language and Composition','AP English Literature and Composition','AP US History','AP World History','AP European History','AP US Government','AP Comparative Government','AP Human Geography','AP Macroeconomics','AP Microeconomics','AP Psychology','AP Art History']:['Spécialité Mathématiques Première','Spécialité Mathématiques Terminale','Mathématiques expertes','Physique-Chimie','Biologie, Terre & santé','Numérique & informatique','Sciences de l’ingénieur','HLP','LLCER','LLCA','LCA','LVC','HGGSP','Histoire des arts'];
 advanced.forEach((subject,i)=>list.push({id:`materials-${lang}-advanced-${i}`,language:lang,grade:lang==='en'?'Advanced / AP':'Spécialités & options',subject,title:subject}));
 const examCourses=lang==='en'?[
  ['sat-reading-writing','SAT · Reading & Writing','Reading comprehension, evidence, vocabulary in context, grammar and revision. Include original short passages.'],
  ['sat-math','SAT · Math','Algebra, advanced algebra, problem solving and data analysis, geometry and trigonometry.'],
  ['act-english','ACT · English','Grammar, punctuation, sentence structure and rhetorical revision in original passages.'],
  ['act-math','ACT · Math','High-school algebra, functions, geometry, trigonometry, probability and statistics.'],
  ['act-reading','ACT · Reading','Main ideas, evidence, inference, relationships and author purpose in original passages.'],
  ['act-science','ACT · Science','Interpret supplied experimental data and scientific reasoning; include every table or datum in plain text.'],
  ['act-writing','ACT · Writing — Planning & Revision','Practice evaluating thesis statements, perspectives, evidence, organization and revision, not writing a complete assessed essay.'],
  ['ib-tok','IB Diploma · Theory of Knowledge (TOK)','Practice recognizing knowledge questions, evidence, assumptions, perspectives and justification. Assess reasoning techniques, never treat a contested philosophical opinion as uniquely correct.'],
  ['ib-ee','IB Diploma · Extended Essay (EE)','Practice research questions, source evaluation, research planning, citations and academic integrity. Never write a student\'s assessed Extended Essay.'],
  ['ib-academic-writing','IB Diploma · Academic Writing','Practice thesis, paragraph coherence, evidence, quotation, paraphrase and citation using original mini-examples. Never produce work to submit as the student\'s own assessment.']
 ]:[
  ['bac-dissertation','Baccalauréat · Dissertation','En français : analyser un sujet, formuler une problématique, construire un plan et choisir des arguments. Exercices de méthode, pas une dissertation complète à remettre.'],
  ['bac-documents','Baccalauréat · Analyse de documents','En français : identifier la source, contextualiser, citer des preuves et comparer des documents originaux inclus dans chaque question.'],
  ['bac-grand-oral','Baccalauréat · Grand oral','En français : préparer une question, structurer une présentation, justifier une réponse et répondre au jury. Exercices écrits de préparation, sans prétendre évaluer une prestation orale.'],
  ['bac-recherche','Baccalauréat · Recherche & sources','En français : construire une question de recherche, évaluer la fiabilité des sources et citer correctement.'],
  ['bac-argumentation','Baccalauréat · Argumentation','En français : distinguer thèse, argument, exemple et objection, organiser une réponse et réviser un raisonnement.']
 ];
 examCourses.forEach(([id,subject,practiceFocus])=>list.push({id:`materials-${lang}-${id}`,language:lang,grade:lang==='en'?'Advanced / AP':'Spécialités & options',subject,title:subject,practiceFocus}));
}
writeFileSync(new URL('../lib/material-catalog.json',import.meta.url),JSON.stringify(list,null,2)+'\n');
console.log(`${list.length} material course selections`);
