import { calculateSolarLcoe, tornado, lineSeries, type SolarInputs } from './model';

function csvEscape(value: string | number) {
  const text = String(value);
  return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildCsv(input: SolarInputs) {
  const result = calculateSolarLcoe(input);
  const rows: Array<Array<string | number>> = [
    ['Solar PV LCOE scenario', new Date().toISOString()],
    [],
    ['Inputs'],
    ['System size', input.systemMwDc, 'MWdc'],
    ['Capex total', result.capexWdc, '$/Wdc'],
    ['Panels', input.panelCapexWdc, '$/Wdc'],
    ['Labour', input.labourCapexWdc, '$/Wdc'],
    ['Materials / BOS / other', input.bosCapexWdc, '$/Wdc'],
    ['O&M', result.omKwYear, '$/kWdc-year'],
    ['Real WACC', input.wacc],
    ['Capacity factor', input.capacityFactor],
    ['Capacity factor basis', input.capacityMode],
    ['DC/AC ratio', input.dcAcRatio],
    ['Project life', input.projectLife, 'years'],
    ['Degradation', input.degradation],
    ['Curtailment', input.curtailment],
    ['Land mode', input.landMode],
    ['Land direct', input.landCostMwh, '$/MWh'],
    ['ITC enabled', input.itcEnabled ? 'yes' : 'no'],
    ['ITC percent', input.itcPercent],
    ['Monetization', input.realisticMonetization ? 0.92 : input.monetization],
    [],
    ['Computed intermediates'],
    ['Gross capex', result.grossCapex],
    ['ITC face value', result.itcFaceValue],
    ['ITC cash value', result.itcCashValue],
    ['Net capex', result.netCapex],
    ['Annual generation year 1', result.annualGenerationYearOneMwh],
    ['Average annual generation', result.averageGenerationMwh],
    ['Usable annual generation', result.usableGenerationMwh],
    ['Average output', result.averageOutputMw],
    ['Capital recovery factor', result.crf],
    ['Annualized capex', result.annualizedCapex],
    ['Annual O&M', result.annualOm],
    ['Annual land cost', result.annualLandCost],
    ['Capex LCOE', result.capexLcoe],
    ['O&M LCOE', result.omLcoe],
    ['Land LCOE', result.landLcoe],
    ['Total LCOE', result.totalLcoe],
    [],
    ['Tornado sensitivity'],
    ['Variable', 'Low LCOE', 'High LCOE'],
    ...tornado(input).map((row) => [row.variable, row.low, row.high]),
    [],
    ['WACC line'],
    ['WACC', 'LCOE'],
    ...lineSeries(input, 'wacc').map((row) => [row.x, row.value]),
    [],
    ['Capacity factor line'],
    ['Capacity factor', 'LCOE'],
    ...lineSeries(input, 'capacityFactor').map((row) => [row.x, row.value]),
    [],
    ['Capex line'],
    ['Capex', 'LCOE'],
    ...lineSeries(input, 'capex').map((row) => [row.x, row.value]),
  ];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function downloadCsv(input: SolarInputs) {
  const blob = new Blob([buildCsv(input)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'solar-lcoe-scenario.csv';
  link.click();
  URL.revokeObjectURL(url);
}
