export type CapacityMode = 'dc' | 'ac';
export type LandMode = 'mwh' | 'acreYear';
export type OmMode = 'technical' | 'allIn';

export type SolarInputs = {
  systemMwDc: number;
  panelCapexWdc: number;
  labourCapexWdc: number;
  bosCapexWdc: number;
  omMode: OmMode;
  omTechnicalKwYear: number;
  insuranceKwYear: number;
  propertyTaxKwYear: number;
  adminKwYear: number;
  securityKwYear: number;
  wacc: number;
  capacityMode: CapacityMode;
  capacityFactor: number;
  dcAcRatio: number;
  projectLife: number;
  degradation: number;
  curtailment: number;
  landMode: LandMode;
  landCostMwh: number;
  leaseRateAcreYear: number;
  acresPerMw: number;
  itcEnabled: boolean;
  eligibleBasis: number;
  itcPercent: number;
  monetization: number;
  realisticMonetization: boolean;
  paybackEnabled: boolean;
  paybackYears: number;
};

export type SolarResults = {
  capexWdc: number;
  omKwYear: number;
  annualGenerationYearOneMwh: number;
  averageGenerationMwh: number;
  usableGenerationMwh: number;
  averageOutputMw: number;
  grossCapex: number;
  eligibleCapex: number;
  itcFaceValue: number;
  itcCashValue: number;
  netCapex: number;
  crf: number;
  annualizedCapex: number;
  annualOm: number;
  annualLandCost: number;
  landLcoe: number;
  capexLcoe: number;
  omLcoe: number;
  totalLcoe: number;
  centsKwh: number;
  paybackLcoe: number | null;
  warnings: string[];
};

export const defaults: SolarInputs = {
  systemMwDc: 10,
  panelCapexWdc: 0.16,
  labourCapexWdc: 0.2,
  bosCapexWdc: 0.15,
  omMode: 'technical',
  omTechnicalKwYear: 10,
  insuranceKwYear: 2,
  propertyTaxKwYear: 0,
  adminKwYear: 1,
  securityKwYear: 0.5,
  wacc: 0.05,
  capacityMode: 'dc',
  capacityFactor: 0.26,
  dcAcRatio: 1.3,
  projectLife: 30,
  degradation: 0.005,
  curtailment: 0,
  landMode: 'mwh',
  landCostMwh: 3,
  leaseRateAcreYear: 750,
  acresPerMw: 6,
  itcEnabled: false,
  eligibleBasis: 1,
  itcPercent: 0.3,
  monetization: 1,
  realisticMonetization: false,
  paybackEnabled: false,
  paybackYears: 10,
};

export function crf(rate: number, years: number) {
  if (years <= 0) return 0;
  if (Math.abs(rate) < 0.0000001) return 1 / years;
  const factor = (1 + rate) ** years;
  return (rate * factor) / (factor - 1);
}

export function degradationFactor(rate: number, years: number) {
  if (years <= 0) return 0;
  let total = 0;
  for (let year = 1; year <= years; year += 1) {
    total += (1 - rate) ** (year - 1);
  }
  return total / years;
}

export function calculateSolarLcoe(input: SolarInputs): SolarResults {
  const capexWdc = input.panelCapexWdc + input.labourCapexWdc + input.bosCapexWdc;
  const omKwYear =
    input.omTechnicalKwYear +
    (input.omMode === 'allIn'
      ? input.insuranceKwYear + input.propertyTaxKwYear + input.adminKwYear + input.securityKwYear
      : 0);
  const cfDc = input.capacityMode === 'dc' ? input.capacityFactor : input.capacityFactor / input.dcAcRatio;
  const annualGenerationYearOneMwh = input.systemMwDc * 8760 * cfDc;
  const averageGenerationMwh = annualGenerationYearOneMwh * degradationFactor(input.degradation, input.projectLife);
  const usableGenerationMwh = averageGenerationMwh * (1 - input.curtailment);
  const averageOutputMw = usableGenerationMwh / 8760;
  const grossCapex = input.systemMwDc * 1_000_000 * capexWdc;
  const monetization = input.realisticMonetization ? 0.92 : input.monetization;
  const eligibleCapex = input.itcEnabled ? grossCapex * input.eligibleBasis : 0;
  const itcFaceValue = eligibleCapex * (input.itcEnabled ? input.itcPercent : 0);
  const itcCashValue = itcFaceValue * monetization;
  const netCapex = grossCapex - itcCashValue;
  const capitalRecovery = crf(input.wacc, input.projectLife);
  const annualizedCapex = netCapex * capitalRecovery;
  const annualOm = input.systemMwDc * 1000 * omKwYear;
  const annualLandCost =
    input.landMode === 'mwh'
      ? input.landCostMwh * usableGenerationMwh
      : input.leaseRateAcreYear * input.acresPerMw * input.systemMwDc;
  const landLcoe = annualLandCost / usableGenerationMwh;
  const capexLcoe = annualizedCapex / usableGenerationMwh;
  const omLcoe = annualOm / usableGenerationMwh;
  const totalLcoe = capexLcoe + omLcoe + landLcoe;
  const paybackLcoe = input.paybackEnabled
    ? (netCapex * crf(input.wacc, input.paybackYears)) / usableGenerationMwh + omLcoe + landLcoe
    : null;

  const warnings: string[] = [];
  if (cfDc < 0.05) warnings.push('Capacity factor is very low. LCOE may be dominated by fixed costs.');
  if (cfDc > 0.32) warnings.push('This is very high for DC-basis solar capacity factor. Check whether your input is actually AC capacity factor.');
  if (input.wacc < 0.02) warnings.push('Real WACC is below typical private project-finance assumptions. Use only for sensitivity.');
  if (omKwYear < 5) warnings.push('O&M may exclude real operating costs such as insurance, property tax, admin, land, or replacement reserves.');
  if (input.itcEnabled) warnings.push('Tax-credit eligibility and monetization require project-specific tax diligence.');

  return {
    capexWdc,
    omKwYear,
    annualGenerationYearOneMwh,
    averageGenerationMwh,
    usableGenerationMwh,
    averageOutputMw,
    grossCapex,
    eligibleCapex,
    itcFaceValue,
    itcCashValue,
    netCapex,
    crf: capitalRecovery,
    annualizedCapex,
    annualOm,
    annualLandCost,
    landLcoe,
    capexLcoe,
    omLcoe,
    totalLcoe,
    centsKwh: totalLcoe / 10,
    paybackLcoe,
    warnings,
  };
}

export function lineSeries(input: SolarInputs, key: 'wacc' | 'capacityFactor' | 'capex') {
  if (key === 'wacc') {
    return Array.from({ length: 17 }, (_, idx) => {
      const wacc = 0.02 + idx * 0.005;
      return { x: `${(wacc * 100).toFixed(1)}%`, value: calculateSolarLcoe({ ...input, wacc }).totalLcoe };
    });
  }
  if (key === 'capacityFactor') {
    return Array.from({ length: 17 }, (_, idx) => {
      const capacityFactor = 0.16 + idx * 0.01;
      return { x: `${(capacityFactor * 100).toFixed(0)}%`, value: calculateSolarLcoe({ ...input, capacityMode: 'dc', capacityFactor }).totalLcoe };
    });
  }
  return Array.from({ length: 21 }, (_, idx) => {
    const total = 0.25 + idx * 0.05;
    return {
      x: `$${total.toFixed(2)}`,
      value: calculateSolarLcoe({
        ...input,
        panelCapexWdc: total * 0.31,
        labourCapexWdc: total * 0.39,
        bosCapexWdc: total * 0.3,
      }).totalLcoe,
    };
  });
}

export function tornado(input: SolarInputs) {
  const base = calculateSolarLcoe(input).totalLcoe;
  const totalCapex = input.panelCapexWdc + input.labourCapexWdc + input.bosCapexWdc;
  const scaleCapex = (factor: number): Partial<SolarInputs> => ({
    panelCapexWdc: input.panelCapexWdc * factor,
    labourCapexWdc: input.labourCapexWdc * factor,
    bosCapexWdc: input.bosCapexWdc * factor,
  });
  void totalCapex;
  return [
    { variable: 'Capex', low: calculateSolarLcoe({ ...input, ...scaleCapex(0.8) }).totalLcoe, high: calculateSolarLcoe({ ...input, ...scaleCapex(1.2) }).totalLcoe, base },
    { variable: 'O&M', low: calculateSolarLcoe({ ...input, omTechnicalKwYear: input.omTechnicalKwYear * 0.5 }).totalLcoe, high: calculateSolarLcoe({ ...input, omTechnicalKwYear: input.omTechnicalKwYear * 1.5 }).totalLcoe, base },
    { variable: 'WACC', low: calculateSolarLcoe({ ...input, wacc: Math.max(0, input.wacc - 0.02) }).totalLcoe, high: calculateSolarLcoe({ ...input, wacc: input.wacc + 0.02 }).totalLcoe, base },
    { variable: 'Capacity factor', low: calculateSolarLcoe({ ...input, capacityFactor: Math.max(0.01, input.capacityFactor - 0.03) }).totalLcoe, high: calculateSolarLcoe({ ...input, capacityFactor: input.capacityFactor + 0.03 }).totalLcoe, base },
    { variable: 'Land', low: calculateSolarLcoe({ ...input, landMode: 'mwh', landCostMwh: Math.max(0, input.landCostMwh - 2) }).totalLcoe, high: calculateSolarLcoe({ ...input, landMode: 'mwh', landCostMwh: input.landCostMwh + 2 }).totalLcoe, base },
    { variable: 'Project life', low: calculateSolarLcoe({ ...input, projectLife: 35 }).totalLcoe, high: calculateSolarLcoe({ ...input, projectLife: 20 }).totalLcoe, base },
    { variable: 'ITC', low: calculateSolarLcoe({ ...input, itcEnabled: true }).totalLcoe, high: calculateSolarLcoe({ ...input, itcEnabled: false }).totalLcoe, base },
  ];
}
