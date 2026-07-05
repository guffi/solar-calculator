import { describe, expect, it } from 'vitest';
import { calculateSolarLcoe, defaults } from './model';

describe('solar lcoe model', () => {
  it('matches the no-degradation base case', () => {
    const result = calculateSolarLcoe({ ...defaults, degradation: 0 });
    expect(result.annualGenerationYearOneMwh).toBeCloseTo(22776, 0);
    expect(result.grossCapex).toBeCloseTo(5_100_000, 0);
    expect(result.capexLcoe).toBeCloseTo(14.6, 1);
    expect(result.omLcoe).toBeCloseTo(4.4, 1);
    expect(result.totalLcoe).toBeCloseTo(22.0, 1);
  });

  it('applies a 30 percent ITC as capex reduction', () => {
    const result = calculateSolarLcoe({ ...defaults, degradation: 0, itcEnabled: true });
    expect(result.itcFaceValue).toBeCloseTo(1_530_000, 0);
    expect(result.netCapex).toBeCloseTo(3_570_000, 0);
    expect(result.capexLcoe).toBeCloseTo(10.2, 1);
    expect(result.totalLcoe).toBeCloseTo(17.6, 1);
  });

  it('shows a higher 10-year payback-style cost', () => {
    const result = calculateSolarLcoe({
      ...defaults,
      degradation: 0,
      wacc: 0.03,
      landCostMwh: 0,
      paybackEnabled: true,
      paybackYears: 10,
    });
    expect(result.totalLcoe).toBeCloseTo(15.8, 1);
    expect(result.paybackLcoe ?? 0).toBeCloseTo(30.7, 0);
  });
});
