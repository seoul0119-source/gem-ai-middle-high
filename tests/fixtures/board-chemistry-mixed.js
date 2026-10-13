// Original, fictional multi-unit worksheet for the scene-1 → scene-2 regression.
// No learner records, copyrighted exam text or personal information.
// Answer audit (zero-based indices: 1,2,0,3,1,2,0,3,1,2):
// 1. 35×0.75 + 37×0.25 = 35.5 (the supplied isotope masses are approximations).
// 2. O²⁻, F⁻, Na⁺, Mg²⁺ each have 10 electrons; largest Z gives smallest radius.
// 3. Dissolved NaCl supplies mobile ions; glucose remains mainly neutral molecules.
//    Do not claim perfectly zero conductivity for an aqueous glucose solution.
// 4. CO₂ is linear and nonpolar; bent H₂O is polar. Both have polar bonds.
// 5. n(CO₂) = 8.8 g / (44 g/mol) = 0.20 mol.
// 6. N₂ + 3H₂ → 2NH₃; excess H₂ and complete conversion give 2.0 mol NH₃.
// 7. Conserved solute: 0.50×20.0/250 = 0.040 mol/L; 250 mL is FINAL volume.
// 8. Strong monoprotic HCl and NaOH react 1:1; equal concentrations need 20.0 mL.
// 9. Neutral H₂SO₄: 2(+1) + x + 4(−2) = 0, so x = +6.
// 10. Complete combustion gives 0.20 mol C and 0.60 mol H atoms, hence CH₃.
//     This is the empirical formula; C₂H₆ is not the simplest integer ratio.
export const mixedChemistryMaterial = {
 title:'화학Ⅰ 여러 단원 개념 확인',
 questions:[
  {
   prompt:'염소의 동위원소 ³⁵Cl과 ³⁷Cl의 상대 원자 질량을 각각 35와 37로 가정한다. 두 동위원소의 원자 수 비율이 각각 75%와 25%일 때, 이 시료의 평균 상대 원자 질량은?',
   choices:['35.0','35.5','36.0','36.5'],answerIndex:1,
   hints:['각 동위원소가 전체 원자 수에서 차지하는 비율을 확인해 보세요.','각 질량에 해당 비율을 곱한 뒤 합하는 방법을 생각해 보세요.'],
   explanation:'평균 상대 원자 질량은 각 동위원소의 상대 질량을 원자 수 비율로 가중 평균한 값입니다. 35×0.75+37×0.25=35.5입니다.'
  },
  {
   prompt:'O, F, Na, Mg의 원자 번호는 각각 8, 9, 11, 12이다. 전자 수가 같은 O²⁻, F⁻, Na⁺, Mg²⁺ 중 이온 반지름이 가장 작은 것은?',
   choices:['O²⁻','F⁻','Mg²⁺','Na⁺'],answerIndex:2,
   hints:['각 이온의 전자 수를 원자 번호와 전하로 확인해 보세요.','전자 수가 같을 때 원자핵의 양성자 수 차이가 인력에 미치는 영향을 생각해 보세요.'],
   explanation:'네 이온은 모두 전자가 10개입니다. 같은 전자 수의 이온에서는 핵전하가 클수록 전자를 더 강하게 끌어당겨 반지름이 작습니다. 원자 번호가 가장 큰 Mg²⁺가 가장 작습니다.'
  },
  {
   prompt:'25 ℃에서 각각 0.10 mol/L인 NaCl 수용액과 포도당 수용액을 비교한다. 전기 전도성의 차이를 설명한 것으로 가장 적절한 것은?',
   choices:['NaCl은 물에서 이동 가능한 이온을 만들지만, 포도당은 주로 중성 분자로 존재한다.','NaCl과 포도당은 모두 물에서 같은 수의 이온을 만든다.','포도당만 물에서 이동 가능한 이온을 많이 만든다.','NaCl 수용액에서는 전자가 금속처럼 자유롭게 이동한다.'],answerIndex:0,
   hints:['물질이 물에 녹았을 때 어떤 입자로 존재하는지 구별해 보세요.','용액에서 전하를 옮기는 입자가 무엇인지 생각해 보세요.'],
   explanation:'NaCl은 물에 녹아 Na⁺와 Cl⁻로 존재하며 이동 가능한 이온이 전하를 운반합니다. 포도당은 주로 중성 분자로 존재하므로 같은 농도의 NaCl 수용액보다 전기 전도성이 매우 작습니다. 포도당 수용액의 전도성이 완전히 0이라는 뜻은 아닙니다.'
  },
  {
   prompt:'CO₂는 직선형 분자이고 H₂O는 굽은형 분자이다. C=O 결합과 O–H 결합은 모두 극성 결합일 때, 두 분자의 극성을 바르게 설명한 것은?',
   choices:['CO₂와 H₂O 모두 무극성 분자이다.','CO₂는 극성 분자이고 H₂O는 무극성 분자이다.','CO₂와 H₂O 모두 극성 분자이다.','CO₂는 무극성 분자이고 H₂O는 극성 분자이다.'],answerIndex:3,
   hints:['결합의 극성과 분자 전체의 극성은 구별해서 판단해 보세요.','분자의 모양에 따라 결합 쌍극자가 서로 상쇄되는지 생각해 보세요.'],
   explanation:'직선형 CO₂에서는 크기가 같고 방향이 반대인 두 결합 쌍극자가 상쇄되어 무극성 분자입니다. 굽은형 H₂O에서는 결합 쌍극자가 상쇄되지 않아 극성 분자입니다.'
  },
  {
   prompt:'CO₂의 몰 질량이 44 g/mol일 때, CO₂ 8.8 g의 물질의 양은?',
   choices:['0.10 mol','0.20 mol','2.0 mol','5.0 mol'],answerIndex:1,
   hints:['시료의 질량과 몰 질량의 단위를 비교해 보세요.','같은 물질에 대해 질량과 물질의 양을 연결하는 식을 사용해 보세요.'],
   explanation:'같은 CO₂ 시료에 대해 물질의 양 n=m/M입니다. 시료 질량 m=8.8 g, CO₂의 몰 질량 M=44 g/mol이므로 n=8.8÷44=0.20 mol입니다.'
  },
  {
   prompt:'반응식 N₂+3H₂→2NH₃에 따라 N₂ 1.0 mol이 충분한 양의 H₂와 반응한다. N₂가 모두 반응하고 다른 반응은 없다고 가정할 때 생성되는 NH₃의 물질의 양은?',
   choices:['0.50 mol','1.0 mol','2.0 mol','3.0 mol'],answerIndex:2,
   hints:['균형 잡힌 반응식의 계수가 어떤 양의 비를 뜻하는지 생각해 보세요.','반응하는 질소와 생성되는 암모니아의 계수를 비교해 보세요.'],
   explanation:'반응식의 계수는 반응하거나 생성되는 물질의 몰비를 나타냅니다. N₂:NH₃=1:2이므로 N₂ 1.0 mol이 완전히 반응하면 NH₃ 2.0 mol이 생성됩니다.'
  },
  {
   prompt:'0.50 mol/L NaCl 수용액 20.0 mL에 물을 넣어 최종 용액의 부피를 250 mL로 만들었다. 용질의 손실이나 화학 반응이 없을 때 희석 후 NaCl의 몰 농도는?',
   choices:['0.040 mol/L','0.10 mol/L','0.25 mol/L','6.25 mol/L'],answerIndex:0,
   hints:['희석 전후에 보존되는 용질의 양이 무엇인지 생각해 보세요.','물의 첨가 부피와 희석 후 용액 전체의 부피를 구별해 보세요.'],
   explanation:'용질의 손실이나 반응이 없으므로 NaCl의 물질의 양이 보존됩니다. 같은 부피 단위를 사용하면 c₁V₁=c₂V₂이므로 c₂=0.50×20.0÷250=0.040 mol/L입니다. 250 mL는 물의 첨가량이 아니라 최종 용액 부피입니다.'
  },
  {
   prompt:'0.10 mol/L HCl 수용액 20.0 mL를 0.10 mol/L NaOH 수용액으로 완전히 중화하려 한다. HCl과 NaOH는 완전히 해리하며 H⁺와 OH⁻가 1:1로 반응한다고 할 때 필요한 NaOH 수용액의 부피는?',
   choices:['5.0 mL','10.0 mL','40.0 mL','20.0 mL'],answerIndex:3,
   hints:['중화에 필요한 H⁺와 OH⁻의 물질의 양을 비교해 보세요.','농도와 부피로 물질의 양을 구할 때 단위를 맞추어 보세요.'],
   explanation:'H⁺의 물질의 양은 0.10 mol/L×0.0200 L=0.0020 mol입니다. 같은 양의 OH⁻가 필요하므로 NaOH 수용액 부피는 0.0020 mol÷0.10 mol/L=0.0200 L, 즉 20.0 mL입니다.'
  },
  {
   prompt:'중성 분자 H₂SO₄에서 H의 산화수를 +1, O의 산화수를 −2로 정할 때 S의 산화수는?',
   choices:['+4','+6','−2','+2'],answerIndex:1,
   hints:['중성 분자에서 모든 원자의 산화수 합이 얼마인지 생각해 보세요.','각 원소의 원자 수를 산화수에 곱하여 식을 세워 보세요.'],
   explanation:'S의 산화수를 x라 하면 중성 분자에서 2×(+1)+x+4×(−2)=0입니다. 따라서 x=+6입니다.'
  },
  {
   prompt:'탄소와 수소로만 이루어진 물질을 충분한 산소에서 완전 연소시켜 CO₂ 0.20 mol과 H₂O 0.30 mol을 얻었다. 생성물의 손실이 없을 때 이 물질의 실험식은? 실험식은 원자 수의 가장 간단한 정수비를 나타낸다.',
   choices:['CH','CH₂','CH₃','C₂H₆'],answerIndex:2,
   hints:['생성물의 분자 수와 각 원소의 원자 수를 구별해 보세요.','구한 탄소와 수소의 물질의 양을 가장 간단한 정수비로 바꾸어 보세요.'],
   explanation:'탄소 원자의 물질의 양은 CO₂의 양과 같은 0.20 mol이고, 수소 원자는 H₂O 한 분자당 2개이므로 2×0.30=0.60 mol입니다. C:H=0.20:0.60=1:3이므로 실험식은 CH₃입니다. C₂H₆는 가장 간단한 정수비가 아닙니다.'
  }
 ]
};
