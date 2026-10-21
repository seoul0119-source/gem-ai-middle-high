/* Shared Korean entrance choices; course IDs stay identical to the lesson catalog. */
(function () {
  const schools = {
    elementary: { label: '초등학교', prefix: 'e', grades: 6 },
    middle: { label: '중학교', prefix: 'm', grades: 3 },
    high: { label: '고등학교', prefix: 'h', grades: 3 }
  };
  const subjects = {
    korean: '국어', math: '수학', english: '영어',
    integrated: '통합교과', social: '사회', science: '과학',
    ethics: '도덕', history: '한국사'
  };
  function choices(level, grade) {
    const school = schools[level];
    if (!school || !Number.isInteger(grade) || grade < 1 || grade > school.grades) return [];
    const keys = level === 'elementary'
      ? (grade <= 2 ? ['korean', 'math', 'english', 'integrated'] : ['korean', 'math', 'english', 'social', 'science', 'ethics'])
      : ['korean', 'math', 'english', 'social', 'history', 'science'];
    return keys.map(subject => ({ subject, label: subjects[subject], id: `${school.prefix}${grade}-${subject}`, grade: `${school.label} ${grade}학년` }));
  }
  function course(level, grade, subject) {
    return choices(level, grade).find(item => item.subject === subject) || null;
  }
  function destination(item, mode = 'worksheet', materials = false) {
    if (!item) throw new Error('학년과 과목을 선택해 주세요.');
    const query = new URLSearchParams({ course: item.id, language: 'ko' });
    if (materials) return '/materials.html?' + query;
    if (mode === 'conversation') return '/learn.html?course=' + encodeURIComponent(item.id);
    query.set('classroom', '1');
    return '/materials.html?' + query;
  }
  const internationalSubjects = ['math','science','language','social'];
  const frenchGrades = ['CP','CE1','CE2','CM1','CM2','6e','5e','4e','3e','Seconde','Première','Terminale'];
  function internationalGrades(language, level) {
    if (!['en','fr'].includes(language) || !schools[level]) return [];
    const [first,last] = level === 'elementary' ? [1,5] : level === 'middle' ? [6,language === 'fr' ? 9 : 8] : [language === 'fr' ? 10 : 9,12];
    return Array.from({length:last-first+1},(_,i)=>({value:first+i,label:language === 'fr' ? frenchGrades[first+i-1] : 'Grade '+(first+i)}));
  }
  function internationalDestination(language, level, grade, subject, pathway='general', materials=false) {
    if (!internationalGrades(language,level).some(item=>item.value===grade) || !internationalSubjects.includes(subject)) throw Error('학년과 과목을 선택해 주세요.');
    let id=`materials-${language}-${grade}-${internationalSubjects.indexOf(subject)}`,browse=false;
    if (level === 'high' && pathway !== 'general') {
      const advanced = language === 'en' ? {math:[0,1,2],science:[3,4,5,7,6,8,9,3],language:[10,11],social:[12]} : {math:[0,1,2],science:[3,4,5,6],language:[],social:[12]};
      const number=/^advanced([1-9])$/.exec(pathway)?.[1],index=number ? advanced[subject][Number(number)-1] : undefined;
      if (index === undefined) throw Error('선택한 심화 과정을 확인해 주세요.');
      id=`materials-${language}-advanced-${index}`;
      // These existing entrance cards represent several courses. Open their
      // new worksheet library so the learner can choose the exact course.
      browse=subject==='social'||language==='en'&&subject==='science'&&pathway==='advanced8';
    }
    const params=new URLSearchParams({language,course:id});
    if (!materials && !browse) params.set('classroom','1');
    else params.set('browse','1');
    return '/materials.html?'+params;
  }
  function baccalaureateDestination(materials=false) {
    const params=new URLSearchParams({language:'fr',course:'materials-fr-bac-dissertation'});
    params.set(materials?'browse':'classroom','1');
    return '/materials.html?'+params;
  }
  // Membership verification may use three 10-second attempts plus backoff.
  // Keep the browser deadline above that complete server-side budget.
  async function requestSession(body,timeoutMs=45000) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if (!response.ok) throw Object.assign(Error(data.error||'학생 ID와 입장 연결을 확인하지 못했습니다. 다시 입장해 주세요.'),{status:response.status});
      return data;
    } catch(error) {
      if (controller.signal.aborted) throw Error('입장 확인 시간이 길어지고 있습니다. 잠시 후 입장 버튼을 다시 눌러 주세요.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  globalThis.GEMEntrance = { schools, choices, course, destination, internationalGrades, internationalDestination, baccalaureateDestination, requestSession };
})();
