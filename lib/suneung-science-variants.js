import { createHash } from "node:crypto";

// Only reviewed templates and calculated numbers enter a lesson. The signed
// course run is the seed, so requests and voice share the same answer key.
export function scienceVariants(base, seed) {
  if (!seed) return base;
  const bytes = createHash("sha256").update(String(seed)).digest();
  const n = (i, max, min = 1) => min + bytes[i % bytes.length] % max;
  const questions = base.map(q => ({ ...q, choices:[...q.choices], hints:[...q.hints] }));
  const set = (i, stem, choices, correct, hints, explanation) => Object.assign(questions[i], {
    stem, choices:choices.map(String), answer:"ABCDE"[correct], hints, explanation
  });
  const unitNames = ["전류", "전압", "전기 저항", "전력", "에너지"];
  const unitValues = ["암페어(A)", "볼트(V)", "옴(Ω)", "와트(W)", "줄(J)"];
  const u = n(0,5,0);
  set(0, `실험 기록에서 ${unitNames[u]}의 측정값 옆에 적을 알맞은 단위를 고르세요.`, unitValues, u,
    ["먼저 측정하는 물리량과 단위를 구분해 보세요.", "전류·전압·저항·전력·에너지는 각각 서로 다른 단위를 사용합니다."],
    `${unitNames[u]}의 단위는 ${unitValues[u]}입니다.`);
  const sensor = ["빛의 세기", "온도", "압력", "소리"][n(1,4,0)];
  set(1, `자동 측정 장치가 ${sensor} 정보를 읽습니다. 센서의 역할로 알맞은 것은 무엇인가요?`,
    [`${sensor} 정보를 전기 신호로 바꾼다`, "물체의 질량을 무조건 늘린다", "공기 중 산소를 모두 없앤다", "장치의 면적만 바꾼다", "정보를 저장하지 못하도록 지운다"],0,
    ["기기가 주변 정보를 처리하려면 어떤 형태의 신호가 필요할까요?", "전자 회로는 전기 신호를 처리합니다."], `센서는 ${sensor} 정보를 회로가 처리할 전기 신호로 변환합니다.`);
  const metal = [["나트륨", "Na", 1], ["마그네슘", "Mg", 2], ["알루미늄", "Al", 3]][n(2,3,0)];
  set(2, `중성 ${metal[0]} 원자가 전자 ${metal[2]}개를 잃었습니다. 생성된 이온의 전하는 얼마인가요?`,
    ["+1", "+2", "+3", "-1", "0"],metal[2]-1,
    ["전자는 음전하를 가집니다. 이를 잃으면 양전하가 남습니다.", "잃은 전자 개수와 양전하의 크기를 연결하세요."], `${metal[0]} 원자가 전자 ${metal[2]}개를 잃으면 전하는 +${metal[2]}입니다.`);
  const mass=n(3,18), speed=n(4,12), momentum=mass*speed;
  set(3, `질량 ${mass} kg인 수레가 ${speed} m/s로 움직입니다. 운동량의 크기는 얼마인가요?`,
    [momentum, momentum+1,momentum+2,momentum+3,momentum+4].map(v=>`${v} kg·m/s`),0,
    ["운동량의 크기는 질량 × 속력입니다.", `${mass}와 ${speed}를 곱하고 단위를 확인하세요.`], `운동량은 ${mass} × ${speed} = ${momentum} kg·m/s입니다.`);
  const ph=n(5,5), other=ph+1;
  set(4, `같은 온도에서 갑의 pH는 ${ph}, 을의 pH는 ${other}입니다. 두 산성 수용액 중 수소 이온 농도가 더 큰 것은?`,
    ["갑", "을", "농도가 같다", "둘 다 중성이다", "둘 다 염기성이다"],0,
    ["pH가 낮을수록 수소 이온 농도가 높습니다.", `${ph}와 ${other} 중 더 작은 수를 찾아보세요.`], `갑의 pH ${ph}가 더 낮으므로 갑의 수소 이온 농도가 더 큽니다.`);
  const before=n(6,40,10), oxygen=n(7,15), after=before+oxygen;
  set(5, `철 ${before} g이 산소와 반응하여 고체 ${after} g이 되었습니다. 고체 손실이 없을 때 결합한 산소의 질량은?`,
    [oxygen,oxygen+1,oxygen+2,oxygen+3,oxygen+4].map(v=>`${v} g`),0,
    ["증가한 질량은 결합한 산소의 질량입니다.", `${after}에서 ${before}를 빼세요.`], `산소의 질량은 ${after} - ${before} = ${oxygen} g입니다.`);
  const input=n(8,9,2)*100, efficiency=n(9,70,20), output=input*efficiency/100;
  set(6, `장치에 ${input} J를 공급했더니 유용한 출력은 ${output} J였습니다. 에너지 효율은?`,
    [efficiency,efficiency+1,efficiency+2,efficiency+3,efficiency+4].map(v=>`${v}%`),0,
    ["효율 = 유용한 출력 ÷ 공급 에너지 × 100%입니다.", `${output} ÷ ${input} × 100을 계산하세요.`], `효율은 ${output} ÷ ${input} × 100 = ${efficiency}%입니다.`);
  const force=n(10,8,2)*100, factor=n(11,5,2);
  set(7, `운동량 변화량이 같은 충돌에서 평균 힘이 ${force} N이었습니다. 멈추는 시간을 ${factor}배로 늘리면 평균 힘은 기존의 몇 배인가요?`,
    [`1/${factor}배`, `${factor}배`, `${factor+1}배`, "변함없다", "0배"],0,
    ["충격량은 평균 힘 × 시간입니다.", "충격량이 같으면 힘과 시간은 반비례합니다."], `시간이 ${factor}배이면 평균 힘은 기존의 1/${factor}배입니다.`);
  const acidic=n(12,2,0)===0, p=acidic?n(13,6):n(13,6,8);
  set(8, `25°C에서 수용액의 pH는 ${p}입니다. 리트머스 종이로 확인할 성질은?`,
    ["파란 리트머스를 붉게 바꾼다", "붉은 리트머스를 파랗게 바꾼다", "항상 중성이다", "온도가 반드시 100°C이다", "물이 전혀 없다"],acidic?0:1,
    ["25°C에서 pH 7을 기준으로 산성과 염기성을 구분합니다.", "산성은 파란 종이를 붉게, 염기성은 붉은 종이를 파랗게 바꿉니다."], `pH ${p}인 이 수용액은 ${acidic?"산성으로 파란 리트머스를 붉게":"염기성으로 붉은 리트머스를 파랗게"} 바꿉니다.`);
  const demand=n(14,80,20), surplus=n(15,15,5);
  set(9, `두 시간의 발전량이 차례로 ${demand+surplus}, ${demand-surplus} kWh이고 매시간 ${demand} kWh가 필요합니다. 처음 저장량 0, 손실 0일 때 첫 시간에 저장할 최소 에너지는?`,
    [surplus,surplus+1,surplus+2,surplus+3,surplus+4].map(v=>`${v} kWh`),0,
    ["첫 시간의 남는 양을 둘째 시간의 부족분에 사용합니다.", `${demand+surplus}에서 ${demand}를 빼서 남는 양을 구하세요.`], `첫 시간에 ${surplus} kWh를 저장하면 둘째 시간의 부족분 ${surplus} kWh를 충족합니다.`);
  for (const q of questions) {
    const correct=q.choices["ABCDE".indexOf(q.answer)];
    for(let i=4;i>0;i--) { const j=n(q.number+i, i+1,0); [q.choices[i],q.choices[j]]=[q.choices[j],q.choices[i]]; }
    q.answer="ABCDE"[q.choices.indexOf(correct)];
  }
  return questions;
}
