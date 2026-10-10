/* Shared Korean entrance choices; course IDs stay identical to the lesson catalog. */
(function () {
  const schools = {
    elementary: { label: '초등학교', prefix: 'e', grades: 6 },
    middle: { label: '중학교', prefix: 'm', grades: 3 },
    high: { label: '고등학교', prefix: 'h', grades: 3 }
  };
  const subjects = {
    korean: '📘 국어', math: '📐 수학', english: '🔤 영어',
    integrated: '🌱 통합교과', social: '🌏 사회', science: '🔬 과학',
    ethics: '🤝 도덕', history: '🏛️ 한국사'
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
  globalThis.GEMEntrance = { schools, choices, course, destination };
})();
