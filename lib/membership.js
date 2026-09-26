export const MEMBERSHIP_PLANS = Object.freeze({
  trial: {prefix:'T',label:'1일 체험',amount:0},
  month1: {prefix:'M',label:'1개월 회원',amount:100000},
  month2: {prefix:'N',label:'2개월 회원',amount:150000},
  month3: {prefix:'P',label:'3개월 회원',amount:200000},
  lifetime: {prefix:'L',label:'평생회원',amount:null},
  representative: {prefix:'D',label:'대표',amount:0},
  free1: {prefix:'F',label:'1개월 무료',amount:0},
  legacy: {prefix:'R',label:'기존 정규 등록',amount:0}
});
// Only call with sheet responses or signed server-side payloads.
export function validatedMembership(id, membership) {
  if (!membership || typeof membership !== 'object') return null;
  const plan=MEMBERSHIP_PLANS[membership.plan];
  if(!plan || (membership.plan !== 'legacy' && !id.toUpperCase().startsWith(plan.prefix))) return null;
  if(membership.plan === 'legacy' && /^[TFMNPLD]/i.test(id)) return null;
  const startsAt=membership.startsAt===null && membership.plan==='legacy' ? null : Date.parse(membership.startsAt);
  const expiresAt=membership.expiresAt===null ? null : Date.parse(membership.expiresAt);
  if(startsAt!==null && !Number.isFinite(startsAt)) return null;
  if(['trial','month1','month2','month3','free1'].includes(membership.plan)) {
    if(!Number.isFinite(expiresAt) || expiresAt<=startsAt)return null;
  } else if(expiresAt!==null)return null;
  return {plan:membership.plan,label:plan.label,startsAt:startsAt===null?null:new Date(startsAt).toISOString(),expiresAt:expiresAt===null?null:new Date(expiresAt).toISOString()};
}
export function requiresMembership(id) {return /^[TFMNPLD][0-9]{6}$/i.test(String(id));}
export function membershipDeadline(membership) {return membership?.expiresAt ? Math.floor(Date.parse(membership.expiresAt)/1000) : Infinity;}
