import { defaults, type SolarInputs } from './model';

const map: Record<keyof SolarInputs, string> = {
  systemMwDc: 'size_mwdc',
  panelCapexWdc: 'panel_wdc',
  labourCapexWdc: 'labour_wdc',
  bosCapexWdc: 'bos_wdc',
  omMode: 'om_mode',
  omTechnicalKwYear: 'om_kwyr',
  insuranceKwYear: 'insurance_kwyr',
  propertyTaxKwYear: 'property_tax_kwyr',
  adminKwYear: 'admin_kwyr',
  securityKwYear: 'security_kwyr',
  wacc: 'wacc_real',
  capacityMode: 'cf_mode',
  capacityFactor: 'cf',
  dcAcRatio: 'dc_ac',
  projectLife: 'life',
  degradation: 'degradation',
  curtailment: 'curtailment',
  landMode: 'land_mode',
  landCostMwh: 'land_mwh',
  leaseRateAcreYear: 'lease_acre_yr',
  acresPerMw: 'acres_mw',
  itcEnabled: 'itc',
  eligibleBasis: 'eligible_basis',
  itcPercent: 'itc_pct',
  monetization: 'monetization',
  realisticMonetization: 'realistic_monetization',
  paybackEnabled: 'payback',
  paybackYears: 'payback_years',
};

export function loadFromUrl(): SolarInputs {
  const params = new URLSearchParams(window.location.search);
  const next = { ...defaults };
  for (const key of Object.keys(map) as Array<keyof SolarInputs>) {
    const raw = params.get(map[key]);
    if (raw == null) continue;
    const current = defaults[key];
    if (typeof current === 'boolean') {
      (next[key] as boolean) = raw === '1' || raw === 'true';
    } else if (typeof current === 'number') {
      const numeric = Number(raw);
      if (Number.isFinite(numeric)) (next[key] as number) = numeric;
    } else {
      (next[key] as string) = raw;
    }
  }
  return { ...next, landMode: 'mwh' };
}

export function makeScenarioUrl(input: SolarInputs) {
  const params = new URLSearchParams();
  for (const key of Object.keys(map) as Array<keyof SolarInputs>) {
    const value = input[key];
    params.set(map[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}
