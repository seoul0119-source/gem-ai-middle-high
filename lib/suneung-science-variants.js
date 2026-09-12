import { createHash } from "node:crypto";

export const SCIENCE_VARIANT_PREFIX = "science-v2:";
const LABELS = "ABCDE";
const UNIT_NAMES = { A: "암페어(A)", V: "볼트(V)", W: "와트(W)", Ω: "옴(Ω)", J: "줄(J)" };
const decimal = value => String(Number(value.toFixed(6)));

// Each draw has its own 32-bit hash. A single byte limited a question to 256
// variations, and reusing bytes coupled problem data to the answer order.
function seededNumber(seed, label, count, min = 0) {
  return min + createHash("sha256").update(JSON.stringify([String(seed), label])).digest().readUInt32BE(0) % count;
}

function numericChoices(correct, unit, step = 1) {
  const values = [correct, correct - step, correct + step, correct - 2 * step, correct + 2 * step];
  const distinct = [...new Set(values.filter(value => value >= 0).map(decimal))];
  for (let i = 3; distinct.length < 5; i += 1) {
    const value = decimal(correct + i * step);
    if (!distinct.includes(value)) distinct.push(value);
  }
  return distinct.slice(0, 5).map(value => `${value}${unit ? ` ${unit}` : ""}`);
}

// Only reviewed templates and calculated numbers enter a lesson. The signed
// course run is the seed, so requests and voice share the same answer key.
// This is a finite template bank, not an unlimited source of unique questions.
function currentScienceVariants(base, seed) {
  if (!seed) return base;
  const n = (label, count, min = 0) => seededNumber(seed, label, count, min);
  const questions = base.map(q => ({ ...q, choices: [...q.choices], hints: [...q.hints] }));
  const set = (i, stem, choices, correct, hints, explanation) => Object.assign(questions[i], {
    stem, choices: choices.map(String), answer: LABELS[correct], hints, explanation
  });
  const calculation = (i, stem, correct, unit, hints, explanation, step = 1) =>
    set(i, stem, numericChoices(correct, unit, step), 0, hints, explanation);

  // The opening question changes its actual measurement task and data, rather
  // than cycling through the same five unit names with reordered choices.
  const measurementType = n("measurement/type", 6);
  if (measurementType === 0) {
    const [quantity, small, large] = [["전류", "mA", "A"], ["전압", "mV", "V"], ["전력", "mW", "W"]][n("measurement/milli-unit", 3)];
    const value = n("measurement/milli-value", 9900, 100) * 10;
    const result = value / 1000;
    set(0, `측정기에 표시된 ${quantity}는 ${value} ${small}입니다. 이를 ${large} 단위로 바꾼 값은 얼마인가요?`,
      [result, result / 10, result * 10, result * 100, result * 1000].map(v => `${decimal(v)} ${UNIT_NAMES[large]}`), 0,
      ["접두어 밀리(m)는 원래 단위의 1000분의 1을 뜻합니다.", `${small}를 ${large}로 바꿀 때는 측정값을 1000으로 나눕니다.`],
      `${quantity}는 ${value} ÷ 1000 = ${decimal(result)} ${large}입니다.`);
  } else if (measurementType === 1) {
    const [quantity, large, small] = [["전기 저항", "kΩ", "Ω"], ["에너지", "kJ", "J"], ["전력", "kW", "W"]][n("measurement/kilo-unit", 3)];
    const value = n("measurement/kilo-value", 990, 10) / 10;
    const result = value * 1000;
    set(0, `실험 기록의 ${quantity}는 ${value} ${large}입니다. 이를 ${small} 단위로 바꾼 값은 얼마인가요?`,
      [result, result / 10, result / 100, result / 1000, result * 10].map(v => `${decimal(v)} ${UNIT_NAMES[small]}`), 0,
      ["접두어 킬로(k)는 원래 단위의 1000배를 뜻합니다.", `${large}를 ${small}로 바꿀 때는 측정값에 1000을 곱합니다.`],
      `${quantity}는 ${value} × 1000 = ${decimal(result)} ${small}입니다.`);
  } else if (measurementType === 2) {
    const center = n("measurement/mean", 890, 110);
    const gap = n("measurement/mean-gap", 20, 1);
    calculation(0, `같은 물체의 질량을 세 번 측정한 값이 ${center - gap} g, ${center + gap} g, ${center} g입니다. 세 측정값의 산술평균은 얼마인가요?`, center, "g",
      ["산술평균은 측정값의 합을 측정 횟수로 나눈 값입니다.", "세 질량을 모두 더한 뒤 3으로 나누세요."],
      `평균 질량은 (${center - gap} + ${center + gap} + ${center}) ÷ 3 = ${center} g입니다.`, gap);
  } else if (measurementType === 3) {
    const start = n("measurement/ruler-start", 300, 1) / 10;
    const length = n("measurement/ruler-length", 800, 10) / 10;
    const end = Number(decimal(start + length));
    calculation(0, `물체의 양 끝이 자의 ${start} cm 눈금과 ${end} cm 눈금에 놓여 있습니다. 물체의 길이는 얼마인가요?`, length, "cm",
      ["물체의 왼쪽 끝이 자의 0 눈금에 있는지 확인하세요.", "큰 눈금값에서 작은 눈금값을 빼면 두 끝 사이의 길이가 됩니다."],
      `길이는 ${end} - ${start} = ${decimal(length)} cm입니다.`, 0.1);
  } else if (measurementType === 4) {
    const minutes = n("measurement/minutes", 25, 1);
    const seconds = n("measurement/seconds", 59, 1);
    calculation(0, `측정한 시간은 ${minutes}분 ${seconds}초입니다. 초(s)만 사용해 나타낸 값은 얼마인가요?`, minutes * 60 + seconds, "s",
      ["1분은 60초입니다.", "분에 60을 곱한 뒤 나머지 초를 더하세요."],
      `시간은 ${minutes} × 60 + ${seconds} = ${minutes * 60 + seconds} s입니다.`, 10);
  } else {
    const each = n("measurement/ruler-division", 40, 1);
    const divisions = n("measurement/divisions", 15, 2);
    const span = each * divisions;
    calculation(0, `계기의 눈금 ${span} mL 구간이 같은 간격의 작은 칸 ${divisions}개로 나뉘어 있습니다. 작은 한 칸이 나타내는 부피는 얼마인가요?`, each, "mL",
      ["전체 구간의 부피를 같은 크기의 칸에 나눕니다.", `${span}을 ${divisions}로 나누어 한 칸의 크기를 구하세요.`],
      `한 칸은 ${span} ÷ ${divisions} = ${each} mL입니다.`);
  }

  const signalType = n("signal/type", 3);
  if (signalType === 0) {
    const [sensor, setting] = [["빛의 세기", "자동 조명"], ["온도", "온실"], ["압력", "공기 주입 장치"], ["소리", "소음 측정 장치"]][n("signal/sensor", 4)];
    set(1, `${setting}의 센서가 ${sensor} 정보를 읽습니다. 센서의 역할로 알맞은 것은 무엇인가요?`,
      [`${sensor} 정보를 전기 신호로 바꾼다`, "물체의 질량을 무조건 늘린다", "공기 중 산소를 모두 없앤다", "장치의 면적만 바꾼다", "정보를 저장하지 못하도록 지운다"], 0,
      ["기기가 주변 정보를 처리하려면 어떤 형태의 신호가 필요할까요?", "전자 회로는 전기 신호를 처리합니다."], `센서는 ${sensor} 정보를 회로가 처리할 전기 신호로 변환합니다.`);
  } else if (signalType === 1) {
    const interval = n("signal/interval", 19, 2);
    const count = n("signal/count", 90, 10);
    calculation(1, `측정 시작 후 ${interval}초마다 센서값을 한 번씩 저장합니다. 시작 순간에는 저장하지 않을 때 ${interval * count}초까지 저장한 값은 몇 개인가요?`, count, "개",
      ["전체 측정 시간을 저장 간격으로 나누세요.", "시작 순간은 제외하고 첫 저장 시점부터 마지막 저장 시점까지 셉니다."],
      `저장 횟수는 ${interval * count} ÷ ${interval} = ${count}회이므로 ${count}개입니다.`);
  } else {
    const bits = n("signal/bits", 7, 2);
    calculation(1, `한 자리마다 0 또는 1을 사용하는 ${bits}자리 디지털 신호가 있습니다. 0으로 시작하는 신호도 포함할 때 서로 다른 신호는 모두 몇 개인가요?`, 2 ** bits, "개",
      ["각 자리는 서로 독립적으로 두 가지 상태 중 하나를 가집니다.", `자리마다 가능한 수 2를 ${bits}번 곱하세요.`],
      `${bits}자리 신호의 가짓수는 2의 ${bits}제곱인 ${2 ** bits}개입니다.`, 2);
  }

  const ion = [["나트륨", 11, 1], ["마그네슘", 12, 2], ["알루미늄", 13, 3], ["플루오린", 9, -1], ["산소", 8, -2], ["염소", 17, -1]][n("ion/element", 6)];
  const [element, protons, charge] = ion;
  const chargeText = value => value > 0 ? `+${value}` : String(value);
  if (n("ion/type", 2) === 0) {
    const change = charge > 0 ? "잃었습니다" : "얻었습니다";
    const options = [...new Set([charge, 0, -charge, 1, 2, 3, -1, -2, -3])].slice(0, 5).map(chargeText);
    set(2, `중성 ${element} 원자가 전자 ${Math.abs(charge)}개를 ${change}. 생성된 이온의 전하는 얼마인가요?`, options, 0,
      ["전자는 음전하를 가집니다. 잃으면 양전하, 얻으면 음전하를 띱니다.", "이동한 전자 수와 전하의 크기를 연결하세요."],
      `${element} 원자가 전자 ${Math.abs(charge)}개를 ${charge > 0 ? "잃으면" : "얻으면"} 전하는 ${chargeText(charge)}입니다.`);
  } else {
    calculation(2, `${element} 이온은 양성자 ${protons}개를 가지며 전하가 ${chargeText(charge)}입니다. 이 이온의 전자는 몇 개인가요?`, protons - charge, "개",
      ["전하의 수치는 양성자 수에서 전자 수를 뺀 값입니다.", "양이온은 양성자보다 전자가 적고, 음이온은 전자가 많습니다."],
      `전자 수는 ${protons} - (${chargeText(charge)}) = ${protons - charge}개입니다.`);
  }

  const mass = n("momentum/mass", 40, 2), speed = n("momentum/speed", 30, 2), momentum = mass * speed;
  const momentumType = n("momentum/type", 3);
  if (momentumType === 0) {
    calculation(3, `질량 ${mass} kg인 수레가 ${speed} m/s로 움직입니다. 운동량의 크기는 얼마인가요?`, momentum, "kg·m/s",
      ["운동량의 크기는 질량 × 속력입니다.", `${mass}와 ${speed}를 곱하고 단위를 확인하세요.`], `운동량은 ${mass} × ${speed} = ${momentum} kg·m/s입니다.`, mass);
  } else if (momentumType === 1) {
    calculation(3, `수레의 질량은 ${mass} kg이고 운동량의 크기는 ${momentum} kg·m/s입니다. 수레의 속력은 얼마인가요?`, speed, "m/s",
      ["운동량의 크기는 질량 × 속력입니다.", "운동량을 질량으로 나누면 속력을 구할 수 있습니다."], `속력은 ${momentum} ÷ ${mass} = ${speed} m/s입니다.`);
  } else {
    calculation(3, `수레의 속력은 ${speed} m/s이고 운동량의 크기는 ${momentum} kg·m/s입니다. 수레의 질량은 얼마인가요?`, mass, "kg",
      ["운동량의 크기는 질량 × 속력입니다.", "운동량을 속력으로 나누면 질량을 구할 수 있습니다."], `질량은 ${momentum} ÷ ${speed} = ${mass} kg입니다.`);
  }

  const ph = n("acid/ph", 4, 1), gap = n("acid/gap", 6 - ph, 1), other = ph + gap;
  if (n("acid/type", 2) === 0) {
    const firstLower = n("acid/order", 2) === 0;
    const first = firstLower ? ph : other, second = firstLower ? other : ph;
    set(4, `같은 온도에서 갑의 pH는 ${first}, 을의 pH는 ${second}입니다. 두 산성 수용액 중 수소 이온 농도가 더 큰 것은?`,
      ["갑", "을", "농도가 같다", "둘 다 중성이다", "둘 다 염기성이다"], firstLower ? 0 : 1,
      ["pH가 낮을수록 수소 이온 농도가 높습니다.", `${first}와 ${second} 중 더 작은 수를 찾아보세요.`], `${firstLower ? "갑" : "을"}의 pH ${ph}가 더 낮으므로 수소 이온 농도가 더 큽니다.`);
  } else {
    calculation(4, `같은 온도에서 갑의 pH는 ${ph}, 을의 pH는 ${other}입니다. 갑의 수소 이온 농도는 을의 몇 배인가요?`, 10 ** gap, "배",
      ["pH가 1 낮아질 때마다 수소 이온 농도는 10배가 됩니다.", `pH 차이는 ${gap}입니다. 10을 이 차이만큼 거듭제곱하세요.`], `갑의 수소 이온 농도는 을의 10의 ${gap}제곱, 즉 ${10 ** gap}배입니다.`, 10);
  }

  // Use small oxygen mass gains so the iron data are physically attainable;
  // any unreacted iron is included in the measured solid.
  const before = n("oxidation/before", 80, 20), oxygen = n("oxidation/oxygen", Math.floor(before / 3), 1), after = before + oxygen;
  if (n("oxidation/type", 2) === 0) {
    calculation(5, `철 ${before} g의 일부가 산소와 반응하여 남은 철과 산화물의 전체 질량이 ${after} g이 되었습니다. 고체 손실이 없을 때 결합한 산소의 질량은?`, oxygen, "g",
      ["증가한 질량은 결합한 산소의 질량입니다.", `${after}에서 ${before}를 빼세요.`], `산소의 질량은 ${after} - ${before} = ${oxygen} g입니다.`);
  } else {
    calculation(5, `철 ${before} g 중 일부가 산소 ${oxygen} g과 결합했습니다. 물질 손실이 없을 때 반응 후 남은 철과 산화물의 전체 질량은?`, after, "g",
      ["화학 반응 전후에 전체 질량은 보존됩니다.", "처음 철의 질량과 결합한 산소의 질량을 더하세요."], `전체 질량은 ${before} + ${oxygen} = ${after} g입니다.`);
  }

  const input = n("efficiency/input", 19, 2) * 100, efficiency = n("efficiency/percent", 70, 20), output = input * efficiency / 100;
  if (n("efficiency/type", 2) === 0) {
    calculation(6, `장치에 ${input} J를 공급했더니 유용한 출력 에너지는 ${output} J였습니다. 에너지 효율은?`, efficiency, "%",
      ["효율 = 유용한 출력 ÷ 공급 에너지 × 100%입니다.", `${output} ÷ ${input} × 100을 계산하세요.`], `효율은 ${output} ÷ ${input} × 100 = ${efficiency}%입니다.`);
  } else {
    calculation(6, `에너지 효율이 ${efficiency}%인 장치에 ${input} J를 공급했습니다. 유용하게 출력되는 에너지는 얼마인가요?`, output, "J",
      ["유용한 출력 에너지는 공급 에너지에 효율을 곱한 값입니다.", "백분율을 100으로 나눈 뒤 공급 에너지에 곱하세요."], `유용한 출력은 ${input} × ${efficiency} ÷ 100 = ${output} J입니다.`, input / 100);
  }

  const force = n("impact/force", 40, 2) * 100, factor = n("impact/factor", 8, 2);
  if (n("impact/type", 2) === 0) {
    set(7, `운동량 변화량이 같은 충돌에서 평균 힘이 ${force} N이었습니다. 멈추는 시간을 ${factor}배로 늘리면 평균 힘은 기존의 몇 배인가요?`,
      [`1/${factor}배`, `${factor}배`, `${factor + 1}배`, "변함없다", "0배"], 0,
      ["충격량은 평균 힘 × 시간입니다.", "충격량이 같으면 힘과 시간은 반비례합니다."], `시간이 ${factor}배이면 평균 힘은 기존의 1/${factor}배입니다.`);
  } else {
    const newForce = force * factor;
    calculation(7, `완충 장치를 사용하기 전 평균 힘은 ${newForce} N이었습니다. 운동량 변화량은 같고 멈추는 시간만 ${factor}배가 되었다면 새 평균 힘의 크기는?`, force, "N",
      ["운동량 변화량이 같으면 평균 힘 × 시간이 일정합니다.", `이전 힘을 ${factor}로 나누세요.`], `새 평균 힘은 ${newForce} ÷ ${factor} = ${force} N입니다.`, 100);
  }

  const acidic = n("litmus/acidic", 2) === 0, p = acidic ? n("litmus/ph", 6, 1) : n("litmus/ph", 6, 8);
  if (n("litmus/type", 2) === 0) {
    set(8, `25°C에서 수용액의 pH는 ${p}입니다. 리트머스 종이로 확인할 성질은?`,
      ["파란 리트머스를 붉게 바꾼다", "붉은 리트머스를 파랗게 바꾼다", "항상 중성이다", "온도가 반드시 100°C이다", "물이 전혀 없다"], acidic ? 0 : 1,
      ["25°C에서 pH 7을 기준으로 산성과 염기성을 구분합니다.", "산성은 파란 종이를 붉게, 염기성은 붉은 종이를 파랗게 바꿉니다."], `pH ${p}인 이 수용액은 ${acidic ? "산성으로 파란 리트머스를 붉게" : "염기성으로 붉은 리트머스를 파랗게"} 바꿉니다.`);
  } else {
    const values = acidic ? [p, 7, 8, 10, 12] : [p, 7, 1, 3, 5];
    set(8, `25°C에서 수용액이 ${acidic ? "파란 리트머스를 붉게" : "붉은 리트머스를 파랗게"} 바꾸었습니다. 이 결과와 일치할 수 있는 pH는 어느 값인가요?`, values.map(value => `pH ${value}`), 0,
      ["리트머스 종이의 변화로 산성인지 염기성인지 먼저 판단하세요.", `이 수용액은 ${acidic ? "산성이므로 pH가 7보다 작습니다" : "염기성이므로 pH가 7보다 큽니다"}.`],
      `리트머스 변화는 ${acidic ? "산성" : "염기성"}을 뜻하며, 보기 중 pH ${p}가 이 조건에 맞습니다.`);
  }

  const demand = n("storage/demand", 180, 20), surplus = n("storage/surplus", 15, 5);
  if (n("storage/type", 2) === 0) {
    calculation(9, `두 시간의 발전량이 차례로 ${demand + surplus}, ${demand - surplus} kWh이고 매시간 ${demand} kWh가 필요합니다. 처음 저장량 0, 손실 0일 때 첫 시간에 저장할 최소 에너지는?`, surplus, "kWh",
      ["첫 시간의 남는 양을 둘째 시간의 부족분에 사용합니다.", `${demand + surplus}에서 ${demand}를 빼서 남는 양을 구하세요.`], `첫 시간에 ${surplus} kWh를 저장하면 둘째 시간의 부족분 ${surplus} kWh를 충족합니다.`);
  } else {
    const storageEfficiency = [50, 60, 75, 80][n("storage/efficiency", 4)];
    const available = surplus * 4, delivered = available * storageEfficiency / 100;
    calculation(9, `저장 장치에 남는 전기에너지 ${available} kWh를 넣었습니다. 저장과 방전을 합한 효율이 ${storageEfficiency}%일 때 나중에 꺼내 쓸 수 있는 에너지는?`, delivered, "kWh",
      ["꺼내 쓸 수 있는 에너지는 넣은 에너지에 전체 효율을 곱한 값입니다.", "효율을 백분율에서 소수로 바꿔 곱하세요."], `꺼내 쓰는 에너지는 ${available} × ${storageEfficiency} ÷ 100 = ${decimal(delivered)} kWh입니다.`);
  }

  for (const q of questions) {
    const correct = q.choices[LABELS.indexOf(q.answer)];
    for (let i = 4; i > 0; i -= 1) {
      const j = n(`choice/${q.number}/${i}`, i + 1);
      [q.choices[i], q.choices[j]] = [q.choices[j], q.choices[i]];
    }
    q.answer = LABELS[q.choices.indexOf(correct)];
  }
  return questions;
}

// Already issued runs retain their exact questions and answer keys across deploys.

// Only reviewed templates and calculated numbers enter a lesson. The signed
// course run is the seed, so requests and voice share the same answer key.
function legacyScienceVariants(base, seed) {
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

export function scienceVariants(base, seed) {
  return String(seed || "").startsWith(SCIENCE_VARIANT_PREFIX)
    ? currentScienceVariants(base, seed)
    : legacyScienceVariants(base, seed);
}
