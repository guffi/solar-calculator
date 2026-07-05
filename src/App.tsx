import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downloadCsv } from './export';
import { dollars, lcoe, moneyMillions, oneDecimal, pct, whole } from './format';
import { calculateSolarLcoe, defaults, lineSeries, tornado, type SolarInputs } from './model';
import { loadFromUrl, makeScenarioUrl } from './urlState';

type NumericKey = {
  [K in keyof SolarInputs]: SolarInputs[K] extends number ? K : never;
}[keyof SolarInputs];

function Field({
  label,
  value,
  min,
  max,
  step,
  unit,
  help,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  help: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span className="fieldTop">
        <span>{label}</span>
        <span className="unit">{unit}</span>
      </span>
      <span className="fieldControl">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <input
          className="number"
          type="number"
          value={Number.isInteger(value) ? value : Number(value.toFixed(4))}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
      <span className="help">{help}</span>
    </label>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <span className="toggle">
      {options.map((option) => (
        <button className={value === option.value ? 'active' : ''} key={option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </span>
  );
}

function Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="details">
      <summary>{title}</summary>
      <div className="detailsBody">{children}</div>
    </details>
  );
}

function DataTable({ rows }: { rows: Array<[string, string, string?]> }) {
  return (
    <table>
      <tbody>
        {rows.map(([label, value, note]) => (
          <tr key={label}>
            <th>{label}</th>
            <td>{value}</td>
            <td>{note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function App() {
  const [input, setInput] = useState<SolarInputs>(() => loadFromUrl());
  const [copied, setCopied] = useState(false);
  const result = useMemo(() => calculateSolarLcoe(input), [input]);

  const setNumber = (key: NumericKey, value: number) => {
    if (!Number.isFinite(value)) return;
    setInput((current) => ({ ...current, [key]: value }));
  };
  const setCapexTotal = (value: number) => {
    setInput((current) => ({ ...current, bosCapexWdc: Math.max(0, value - current.panelCapexWdc - current.labourCapexWdc) }));
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(makeScenarioUrl(input));
    window.history.replaceState(null, '', makeScenarioUrl(input));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const stack = [
    { name: 'Capital recovery', value: result.capexLcoe, color: '#2f6fab' },
    { name: 'O&M', value: result.omLcoe, color: '#b5772d' },
    { name: 'Land', value: result.landLcoe, color: '#658a48' },
  ];
  const assumptions: Array<[string, string, string?]> = [
    ['System size', `${oneDecimal.format(input.systemMwDc)} MWdc`, 'DC array nameplate capacity'],
    ['Capex total', `$${result.capexWdc.toFixed(2)}/Wdc`, 'Panels + labour + BOS/other'],
    ['O&M total', `$${oneDecimal.format(result.omKwYear)}/kWdc-year`, input.omMode === 'technical' ? 'Technical O&M only' : 'All-in OpEx mode'],
    ['Real WACC', pct(input.wacc), 'Costs are in today’s dollars'],
    ['Capacity factor', `${pct(input.capacityFactor)} ${input.capacityMode.toUpperCase()}`, 'DC basis is the default for $/Wdc capex'],
    ['DC/AC ratio', oneDecimal.format(input.dcAcRatio), input.capacityMode === 'ac' ? 'Used to convert AC CF to DC equivalent' : 'Shown for reference'],
    ['Project life', `${input.projectLife} years`, 'Standard LCOE recovery period'],
    ['Degradation', `${pct(input.degradation, 2)}/year`, 'Lifetime average generation is used'],
    ['Curtailment', pct(input.curtailment), 'Unused energy raises useful-energy LCOE'],
    ['Land lease', input.landMode === 'mwh' ? `$${oneDecimal.format(input.landCostMwh)}/MWh` : `${dollars.format(input.leaseRateAcreYear)}/acre-year`, 'Modeled separately from O&M'],
    ['ITC', input.itcEnabled ? `${pct(input.itcPercent, 0)} enabled` : 'Off', 'Tax credit monetization is shown separately'],
    ['Storage / grid export', 'Excluded', 'No storage, export revenue, or interconnection costs by default'],
  ];
  const computed: Array<[string, string, string?]> = [
    ['Gross capex', moneyMillions(result.grossCapex)],
    ['ITC face value', moneyMillions(result.itcFaceValue)],
    ['ITC cash value', moneyMillions(result.itcCashValue)],
    ['Net capex', moneyMillions(result.netCapex)],
    ['First-year generation', `${whole.format(result.annualGenerationYearOneMwh)} MWh/year`],
    ['Average generation after degradation', `${whole.format(result.averageGenerationMwh)} MWh/year`],
    ['Usable generation after curtailment', `${whole.format(result.usableGenerationMwh)} MWh/year`],
    ['Average output', `${oneDecimal.format(result.averageOutputMw)} MW`],
    ['Capital recovery factor', pct(result.crf, 2)],
    ['Annualized capex', dollars.format(result.annualizedCapex)],
    ['Annual O&M', dollars.format(result.annualOm)],
    ['Annual land cost', dollars.format(result.annualLandCost)],
    ['Capex LCOE', lcoe(result.capexLcoe)],
    ['O&M LCOE', lcoe(result.omLcoe)],
    ['Land LCOE', lcoe(result.landLcoe)],
    ['Total LCOE', lcoe(result.totalLcoe)],
  ];

  return (
    <main className="shell">
      <header>
        <div>
          <h1>Solar PV LCOE Calculator</h1>
          <p className="lede">
            Estimate real-dollar solar electricity cost for an off-grid or behind-the-meter industrial plant that consumes solar output directly.
            Storage, grid export revenue, and major interconnection costs are excluded by default.
          </p>
        </div>
        <div className="headerActions">
          <button onClick={copyLink}>{copied ? 'Copied' : 'Copy scenario link'}</button>
          <button onClick={() => downloadCsv(input)}>Export CSV</button>
          <button onClick={() => window.print()}>Print / save PDF</button>
        </div>
      </header>

      <section className="layout">
        <aside className="inputs">
          <section className="panel summaryPanel">
            <h2>Scenario summary</h2>
            <p>
              Assumes {oneDecimal.format(input.systemMwDc)} MWdc, ${result.capexWdc.toFixed(2)}/Wdc gross capex, {pct(input.capacityFactor)}{' '}
              {input.capacityMode.toUpperCase()} capacity factor, {pct(input.wacc)} real WACC, {input.projectLife}-year life, $
              {oneDecimal.format(result.omKwYear)}/kWdc-year O&M, {input.landMode === 'mwh' ? `$${oneDecimal.format(input.landCostMwh)}/MWh land lease` : 'acre-year land lease'}, no storage, no grid/export costs.
            </p>
            {input.itcEnabled ? <p>Includes {pct(input.itcPercent, 0)} federal ITC. Face value and monetized value are shown separately.</p> : null}
          </section>

          <section className="panel">
            <div className="sectionTitle">
              <h2>Primary inputs</h2>
              <button className="ghost" onClick={() => setInput(defaults)}>Reset</button>
            </div>
            <Field label="System size" value={input.systemMwDc} min={1} max={100} step={1} unit="MWdc" help="DC array nameplate capacity before inverter or AC conversion limits." onChange={(value) => setNumber('systemMwDc', value)} />
            <Field label="Gross capex" value={result.capexWdc} min={0.25} max={1.25} step={0.01} unit="$/Wdc" help="All-in installed capex per Wdc. Direct edits change BOS/other as the residual." onChange={setCapexTotal} />
            <Field label="O&M" value={input.omTechnicalKwYear} min={3} max={30} step={0.5} unit="$/kWdc-year" help="Technical annual operating cost. All-in OpEx can add insurance, tax, admin, and security." onChange={(value) => setNumber('omTechnicalKwYear', value)} />
            <Field label="Real WACC" value={input.wacc * 100} min={2} max={10} step={0.25} unit="%" help="Use real WACC because costs are shown in today’s dollars." onChange={(value) => setNumber('wacc', value / 100)} />
            <div className="modeLine">
              <span>Capacity factor basis</span>
              <Toggle value={input.capacityMode} options={[{ value: 'dc', label: 'DC' }, { value: 'ac', label: 'AC' }]} onChange={(capacityMode) => setInput((current) => ({ ...current, capacityMode }))} />
            </div>
            <Field label="Capacity factor" value={input.capacityFactor * 100} min={14} max={32} step={0.5} unit="%" help="If capex is in $/Wdc, DC capacity factor is the cleanest apples-to-apples input." onChange={(value) => setNumber('capacityFactor', value / 100)} />
            {input.capacityMode === 'ac' ? <Field label="DC/AC ratio" value={input.dcAcRatio} min={1} max={1.6} step={0.05} unit="ratio" help="Used when AC capacity factor is entered. 10 MWdc / 7.7 MWac is about 1.3." onChange={(value) => setNumber('dcAcRatio', value)} /> : null}
            <Field label="Project life" value={input.projectLife} min={10} max={40} step={1} unit="years" help="Standard solar LCOE often uses 25–35 years." onChange={(value) => setNumber('projectLife', value)} />
            <div className="modeLine">
              <span>Land mode</span>
              <Toggle value={input.landMode} options={[{ value: 'mwh', label: '$/MWh' }, { value: 'acreYear', label: '$/acre-year' }]} onChange={(landMode) => setInput((current) => ({ ...current, landMode }))} />
            </div>
            {input.landMode === 'mwh' ? (
              <Field label="Land lease" value={input.landCostMwh} min={0} max={8} step={0.25} unit="$/MWh" help="For West Texas or New Mexico, land may add roughly $1–5/MWh." onChange={(value) => setNumber('landCostMwh', value)} />
            ) : (
              <>
                <Field label="Lease rate" value={input.leaseRateAcreYear} min={100} max={2000} step={25} unit="$/acre-year" help="Annual land lease price." onChange={(value) => setNumber('leaseRateAcreYear', value)} />
                <Field label="Land intensity" value={input.acresPerMw} min={3} max={10} step={0.25} unit="acres/MWdc" help="Ground-mounted PV land use assumption." onChange={(value) => setNumber('acresPerMw', value)} />
              </>
            )}
            <div className="switchRow">
              <span>Federal ITC</span>
              <button className={input.itcEnabled ? 'switch on' : 'switch'} onClick={() => setInput((current) => ({ ...current, itcEnabled: !current.itcEnabled }))}>
                {input.itcEnabled ? '30% ITC on' : 'Off'}
              </button>
            </div>
          </section>

          <Details title="Capex breakdown">
            <Field label="Panels" value={input.panelCapexWdc} min={0.05} max={1} step={0.01} unit="$/Wdc" help="Module cost." onChange={(value) => setNumber('panelCapexWdc', value)} />
            <Field label="Labour" value={input.labourCapexWdc} min={0.02} max={1} step={0.01} unit="$/Wdc" help="Installation labour and EPC effort." onChange={(value) => setNumber('labourCapexWdc', value)} />
            <Field label="Materials / BOS / other" value={input.bosCapexWdc} min={0} max={1.5} step={0.01} unit="$/Wdc" help="Racking, wiring, inverters or power electronics, owner costs." onChange={(value) => setNumber('bosCapexWdc', value)} />
          </Details>

          <Details title="O&M boundary">
            <div className="modeLine">
              <span>O&M mode</span>
              <Toggle value={input.omMode} options={[{ value: 'technical', label: 'Technical' }, { value: 'allIn', label: 'All-in OpEx' }]} onChange={(omMode) => setInput((current) => ({ ...current, omMode }))} />
            </div>
            <Field label="Insurance" value={input.insuranceKwYear} min={0} max={10} step={0.25} unit="$/kW-year" help="Included only in all-in OpEx mode." onChange={(value) => setNumber('insuranceKwYear', value)} />
            <Field label="Property tax" value={input.propertyTaxKwYear} min={0} max={10} step={0.25} unit="$/kW-year" help="Included only in all-in OpEx mode." onChange={(value) => setNumber('propertyTaxKwYear', value)} />
            <Field label="Admin / asset management" value={input.adminKwYear} min={0} max={10} step={0.25} unit="$/kW-year" help="Included only in all-in OpEx mode." onChange={(value) => setNumber('adminKwYear', value)} />
            <Field label="Security / cameras" value={input.securityKwYear} min={0} max={10} step={0.25} unit="$/kW-year" help="Included only in all-in OpEx mode." onChange={(value) => setNumber('securityKwYear', value)} />
          </Details>

          <Details title="Advanced assumptions">
            <Field label="Degradation" value={input.degradation * 100} min={0} max={1} step={0.05} unit="%/year" help="Uses lifetime average generation, not just first-year generation." onChange={(value) => setNumber('degradation', value / 100)} />
            <Field label="Curtailment / unused energy" value={input.curtailment * 100} min={0} max={30} step={1} unit="%" help="Energy generated but not consumed or exported." onChange={(value) => setNumber('curtailment', value / 100)} />
            <Field label="Eligible ITC basis" value={input.eligibleBasis * 100} min={0} max={100} step={5} unit="%" help="Eligible capex basis for ITC." onChange={(value) => setNumber('eligibleBasis', value / 100)} />
            <Field label="ITC percent" value={input.itcPercent * 100} min={0} max={50} step={1} unit="%" help="30% if prevailing wage and apprenticeship requirements are met." onChange={(value) => setNumber('itcPercent', value / 100)} />
            <Field label="Monetization" value={input.monetization * 100} min={50} max={100} step={1} unit="%" help="Value realized if the credit is transferred or otherwise discounted." onChange={(value) => setNumber('monetization', value / 100)} />
            <div className="switchRow">
              <span>Realistic 92% monetization haircut</span>
              <button className={input.realisticMonetization ? 'switch on' : 'switch'} onClick={() => setInput((current) => ({ ...current, realisticMonetization: !current.realisticMonetization }))}>
                {input.realisticMonetization ? 'On' : 'Off'}
              </button>
            </div>
            <div className="switchRow">
              <span>Show 10-year payback-style cost</span>
              <button className={input.paybackEnabled ? 'switch on' : 'switch'} onClick={() => setInput((current) => ({ ...current, paybackEnabled: !current.paybackEnabled }))}>
                {input.paybackEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {input.paybackEnabled ? <Field label="Payback period" value={input.paybackYears} min={5} max={20} step={1} unit="years" help="Not standard LCOE. It forces capex recovery over a shorter period." onChange={(value) => setNumber('paybackYears', value)} /> : null}
          </Details>
        </aside>

        <section className="outputs">
          <section className="topResults">
            <section className="panel resultPanel">
              <p className="eyebrow">Solar LCOE</p>
              <p className="bigResult">
                <span>${oneDecimal.format(result.totalLcoe)}</span>
                <span className="bigUnit">/MWh</span>
              </p>
              <p className="subResult">{oneDecimal.format(result.centsKwh)}¢/kWh</p>
              {result.paybackLcoe ? <p className="payback">10-year payback-style cost: {lcoe(result.paybackLcoe)}. This is not standard solar LCOE.</p> : null}
            </section>

            <section className="panel metricsPanel">
              <div className="metricGrid">
                <span><b>{whole.format(result.usableGenerationMwh)}</b>MWh/year</span>
                <span><b>{oneDecimal.format(result.averageOutputMw)}</b>average MW</span>
                <span><b>{moneyMillions(result.grossCapex)}</b>gross capex</span>
                <span><b>{moneyMillions(result.netCapex)}</b>net capex</span>
                <span><b>{moneyMillions(result.itcFaceValue)}</b>ITC face value</span>
                <span><b>{moneyMillions(result.itcCashValue)}</b>ITC cash value</span>
              </div>
            </section>
          </section>

          {result.warnings.length ? (
            <section className="warnings">
              {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </section>
          ) : null}

          <section className="panel chartPanel">
            <h2>Cost stack</h2>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={stack}>
                <CartesianGrid vertical={false} stroke="#e3ebe7" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(value) => `$${value}`} width={52} />
                <ChartTooltip formatter={(value) => lcoe(Number(value))} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {stack.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="panel chartPanel">
            <h2>One-way sensitivity</h2>
            <ResponsiveContainer width="100%" height={285}>
              <BarChart data={tornado(input)} layout="vertical" margin={{ left: 42, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#e3ebe7" />
                <XAxis type="number" domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                <YAxis type="category" dataKey="variable" width={108} tickLine={false} axisLine={false} />
                <ChartTooltip formatter={(value) => lcoe(Number(value))} />
                <Bar dataKey="low" fill="#0f766e" radius={[0, 4, 4, 0]} />
                <Bar dataKey="high" fill="#b5772d" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="triple">
            {[
              ['LCOE vs WACC', 'wacc'],
              ['LCOE vs capacity factor', 'capacityFactor'],
              ['LCOE vs capex', 'capex'],
            ].map(([title, key]) => (
              <section className="panel chartPanel mini" key={key}>
                <h2>{title}</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={lineSeries(input, key as 'wacc' | 'capacityFactor' | 'capex')}>
                    <CartesianGrid vertical={false} stroke="#e3ebe7" />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} minTickGap={14} />
                    <YAxis tickFormatter={(value) => `$${Number(value).toFixed(0)}`} width={42} />
                    <ChartTooltip formatter={(value) => lcoe(Number(value))} />
                    <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </section>
            ))}
          </section>

          <section className="panel notes">
            <h2>Model boundaries</h2>
            <p>
              This simplified LCOE calculator includes capex, O&M, land lease, WACC, project life, degradation, curtailment, and optional ITC capex reduction. It excludes storage, grid import/export, major interconnection cost, transmission charges, backup power, tax depreciation, PTC, and detailed debt/equity/tax-equity structuring.
            </p>
            <p>
              Direct DC or behind-the-meter use should not be double-counted: the base model already excludes grid/export infrastructure. The main economic question is whether the plant can consume the usable solar profile when it is available.
            </p>
          </section>

          <section className="panel dataPanel">
            <h2>Assumptions</h2>
            <DataTable rows={assumptions} />
            <h2>Computed intermediates</h2>
            <DataTable rows={computed} />
            <h2>Formulas</h2>
            <p className="formula">
              Annual generation = MWdc × 8,760 × DC capacity factor. AC capacity factor is converted by dividing by the DC/AC ratio. Average generation applies annual degradation across project life. LCOE = annualized net capex / usable generation + O&M / usable generation + land cost per MWh.
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}
