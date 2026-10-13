import {BOARD_CATALOG} from './board-catalog.js';

const courses = new Map(BOARD_CATALOG.map(course => [course.id, course]));
const worksheetId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const transferToken = /^[A-Za-z0-9._-]{32,1024}$/;

// This only restores navigation. The protected board endpoint independently
// authenticates the student and verifies worksheet ownership/transfer tokens.
export function boardLoginEntry(search = '', hash = '') {
  const params = new URLSearchParams(search);
  if (params.get('scienceboard') !== '1') return null;
  const course = courses.get(params.get('course') || 'h3-science');
  if (!course) return null;
  const worksheet = params.get('worksheet') || '';
  const transfer = new URLSearchParams(String(hash).replace(/^#/, '')).get('transfer') || '';
  const target = new URLSearchParams();
  if (course.id !== 'h3-science' || worksheetId.test(worksheet)) target.set('course', course.id);
  if (worksheetId.test(worksheet)) target.set('worksheet', worksheet);
  return {
    courseId: course.id,
    language: course.language,
    destination: '/science-board.html' + (target.size ? '?' + target.toString() : '')
      + (transferToken.test(transfer) ? '#transfer=' + encodeURIComponent(transfer) : '')
  };
}
