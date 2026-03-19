/**
 * ComparisonCharts — rendered below the country cards when
 * wageMode is 'fixed_gross_eur' or 'fixed_employer_cost_eur' and 2+ countries are selected.
 *
 * Three panels:
 *  A. Monthly Cost Breakdown  — horizontal stacked bar, one row per country
 *  B. Monthly Pension Output  — grouped bar chart, one group per metric, bars per country
 *  C. Pension Accumulation    — multi-line chart, colour = country, dash = metric
 */

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { CountryConfig, ScenarioResult, WageMode } from '../types';
import { FLAG } from '../data/countryRegistry';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CountryScenario {
  code: string;
  country: CountryConfig;
  result: ScenarioResult;
}

interface Props {
  entries: CountryScenario[];
  wageMode: WageMode;
}

// ─── Country colour palette ───────────────────────────────────────────────────

export const COUNTRY_COLORS: Record<string, string> = {
  AT: '#f97316', BE: '#ec4899', CZ: '#38bdf8', DE: '#eab308',
  DK: '#8b5cf6', EE: '#10b981', ES: '#ef4444', FI: '#06b6d4',
  FR: '#60a5fa', GR: '#6366f1', HU: '#f43f5e', IE: '#22c55e',
  IT: '#84cc16', LT: '#a855f7', LU: '#e879f9', LV: '#d97706',
  NL: '#0ea5e9', PL: '#dc2626', PT: '#16a34a', SE: '#2563eb',
  SI: '#7c3aed', SK: '#14b8a6',
};

const FALLBACK_COLORS = ['#94a3b8', '#475569', '#334155'];

function countryColor(code: string, idx: number): string {
  return COUNTRY_COLORS[code] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ─── Metric dash patterns (colour = country, dash = metric) ──────────────────

const DASH_CONTRIBUTIONS = undefined;    // solid
const DASH_COMPOUNDED    = '6 3';        // long-dash
const DASH_RECEIVED      = '3 3';        // dotted

// ─── Cost-breakdown colour constants (mirrors Graph1_CareerTimeline) ──────────

const CC = {
  netPay:    '#22c55e',
  eePension: '#facc15',
  eeOther:   '#fb923c',
  tax:       '#f87171',
  erPension: '#94a3b8',
  erOther:   '#cbd5e1',
};

const COST_LEGEND = [
  { color: CC.netPay,    label: 'Net Pay' },
  { color: CC.eePension, label: 'Ee Pension SSC' },
  { color: CC.eeOther,   label: 'Ee Other SSC' },
  { color: CC.tax,       label: 'Income Tax' },
  { color: CC.erPension, label: 'Er Pension SSC' },
  { color: CC.erOther,   label: 'Er Other SSC' },
];

// ─── Formatter helpers ────────────────────────────────────────────────────────

function toEur(local: number, rate: number) {
  return local / rate;
}

const fmtEur = (n: number) =>
  n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `€${Math.round(n / 1_000)}k`
  : `€${Math.round(n)}`;

const fmtAxisK = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${Math.round(v / 1_000)}k`
  : String(Math.round(v));

// ─── Shared tooltip ───────────────────────────────────────────────────────────

function EurTooltip({
  active, payload, label, labelPrefix = '',
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string | number;
  labelPrefix?: string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter(
    (e) => e.value !== null && e.value !== undefined && Math.abs(e.value) > 0.01,
  );
  if (!visible.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label !== undefined && (
        <p className="font-semibold text-slate-300 mb-1.5">
          {labelPrefix}{label}
        </p>
      )}
      {visible.map((e, i) => (
        <div key={i} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: e.fill ?? e.color ?? '#94a3b8' }}>{e.name}</span>
          <span className="text-slate-100 font-mono">{fmtEur(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ─── A. Monthly Cost Breakdown ────────────────────────────────────────────────

function CostBreakdownChart({ entries }: { entries: CountryScenario[] }) {
  const data = entries.map(({ code, country, result }) => {
    const { sscResult, taxResult } = result;
    const fx = country.eurExchangeRate;
    const gross = result.resolvedWage.grossLocal;
    const eeSscTotal = sscResult.employeeTotal;
    return {
      name: `${FLAG[code] ?? ''} ${country.name}`,
      netPay:    toEur(gross - taxResult.incomeTaxMonthly - eeSscTotal, fx),
      eePension: toEur(sscResult.employeePensionPortion, fx),
      eeOther:   toEur(Math.max(0, eeSscTotal - sscResult.employeePensionPortion), fx),
      tax:       toEur(taxResult.incomeTaxMonthly, fx),
      erPension: toEur(sscResult.employerPensionPortion, fx),
      erOther:   toEur(Math.max(0, sscResult.employerTotal - sscResult.employerPensionPortion), fx),
      totalCost: toEur(sscResult.totalEmployerCost, fx),
    };
  });

  const xMax = Math.max(...data.map((d) => d.totalCost)) * 1.14;
  const chartH = data.length * 46 + 16;

  return (
    <Panel title="Monthly Cost Breakdown (€)">
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 4, bottom: 0, left: 4 }}
          barSize={24}
        >
          <XAxis type="number" hide domain={[0, xMax]} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            width={108}
          />
          <Tooltip
            content={(p) => (
              <EurTooltip active={p.active} payload={p.payload as never[]} />
            )}
            cursor={{ fill: '#1e293b' }}
          />

          <Bar dataKey="netPay"    stackId="s" fill={CC.netPay}    name="Net Pay"        isAnimationActive={false} />
          <Bar dataKey="eePension" stackId="s" fill={CC.eePension} name="Ee Pension SSC" isAnimationActive={false} />
          <Bar dataKey="eeOther"   stackId="s" fill={CC.eeOther}   name="Ee Other SSC"   isAnimationActive={false} />
          <Bar dataKey="tax"       stackId="s" fill={CC.tax}       name="Income Tax"     isAnimationActive={false} />
          <Bar dataKey="erPension" stackId="s" fill={CC.erPension} name="Er Pension SSC" isAnimationActive={false} />
          <Bar dataKey="erOther"   stackId="s" fill={CC.erOther}   name="Er Other SSC"   isAnimationActive={false} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Total employer cost labels rendered separately as a table row */}
      <div className="mt-2 flex flex-col gap-0.5">
        {data.map((d) => (
          <div key={d.name} className="flex justify-between text-xs px-1">
            <span className="text-slate-500">{d.name}</span>
            <span className="text-slate-400 font-mono">Total cost {fmtEur(d.totalCost)}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {COST_LEGEND.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-xs text-slate-500">
            <span
              style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color }}
            />
            {label}
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ─── B. Monthly Pension Output ────────────────────────────────────────────────

function PensionOutputChart({ entries }: { entries: CountryScenario[] }) {
  // Data: each row = one country; bars per metric
  const data = entries.map(({ code, country, result }, idx) => {
    const fx = country.eurExchangeRate;
    const { pensionResult, fairReturn } = result;
    return {
      name:         `${FLAG[code] ?? ''} ${country.name}`,
      code,
      color:        countryColor(code, idx),
      statePension: toEur(pensionResult.monthlyPension, fx),
      netPension:   toEur(pensionResult.netMonthlyPension ?? pensionResult.monthlyPension, fx),
      fairReturn:   toEur(fairReturn.monthlyAnnuity, fx),
      replRate:     pensionResult.replacementRate,
    };
  });

  const xMax = Math.max(...data.map((d) => Math.max(d.statePension, d.fairReturn))) * 1.14;
  const chartH = data.length * 64 + 20;

  const hasPensionTax = entries.some(
    (e) => (e.result.pensionResult.pensionIncomeTax ?? 0) > 0,
  );

  return (
    <Panel title="Monthly Pension Output (€)">
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 4, bottom: 0, left: 4 }}
          barSize={14}
          barGap={3}
          barCategoryGap="28%"
        >
          <XAxis type="number" hide domain={[0, xMax]} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            width={108}
          />
          <Tooltip
            content={(p) => (
              <EurTooltip active={p.active} payload={p.payload as never[]} />
            )}
            cursor={{ fill: '#1e293b' }}
          />

          {/* State pension bar — solid country colour */}
          <Bar dataKey="statePension" name="State Pension" isAnimationActive={false} radius={[0, 2, 2, 0]}>
            {data.map((entry) => (
              <Cell key={entry.code} fill={entry.color} />
            ))}
          </Bar>

          {/* Net pension (after pension income tax) — 55% opacity of country colour */}
          {hasPensionTax && (
            <Bar dataKey="netPension" name="Net Pension (after tax)" isAnimationActive={false} radius={[0, 2, 2, 0]}>
              {data.map((entry) => (
                <Cell key={entry.code} fill={entry.color} fillOpacity={0.55} />
              ))}
            </Bar>
          )}

          {/* Fair return annuity — dashed border, same colour at 35% opacity */}
          <Bar dataKey="fairReturn" name="Fair Return Annuity" isAnimationActive={false} radius={[0, 2, 2, 0]}>
            {data.map((entry) => (
              <Cell key={entry.code} fill={entry.color} fillOpacity={0.33} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Replacement rates */}
      <div className="mt-2 flex flex-col gap-0.5">
        {data.map((d) => (
          <div key={d.name} className="flex justify-between text-xs px-1">
            <span className="text-slate-500">{d.name}</span>
            <span className="font-mono" style={{ color: d.color }}>
              Replacement rate {Math.round(d.replRate * 100)}%
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
        {entries.map(({ code, country }, idx) => (
          <span key={code} className="flex items-center gap-1.5 text-xs">
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                background: countryColor(code, idx),
              }}
            />
            <span className="text-slate-400">{FLAG[code] ?? ''} {country.name}</span>
          </span>
        ))}
        <span className="text-slate-600 text-xs self-center">&nbsp;·&nbsp;</span>
        <span className="text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Solid</span> = State pension &nbsp;
          <span className="text-slate-600">Dim</span> = Fair Return Annuity
        </span>
        {hasPensionTax && (
          <span className="text-xs text-slate-500">
            <span className="font-semibold text-slate-400">Mid</span> = Net pension (after pension tax)
          </span>
        )}
      </div>
    </Panel>
  );
}

// ─── C. Pension Accumulation ──────────────────────────────────────────────────

function AccumulationChart({ entries }: { entries: CountryScenario[] }) {
  // Build unified age axis from all timelines
  const allAges = Array.from(
    new Set(entries.flatMap(({ result }) => result.timeline.map((s) => s.age))),
  ).sort((a, b) => a - b);

  // For each age build one flat row: { age, CZ_contributions, CZ_compounded, CZ_received, … }
  const data = allAges.map((age) => {
    const row: Record<string, number | null> = { age };
    entries.forEach(({ code, country, result }) => {
      const fx = country.eurExchangeRate;
      const snap = result.timeline.find((s) => s.age === age);

      const totalPaidAtRetirement =
        result.timeline.find((s) => s.phase === 'retirement')
          ?.cumulativePensionContributionsAtRetirement ?? 0;
      const compoundedPeak =
        [...result.timeline].reverse().find((s) => s.phase === 'career')
          ?.cumulativeContributionsCompounded ?? result.fairReturn.accumulatedPot;

      if (snap) {
        row[`${code}_contributions`] =
          snap.phase === 'career'
            ? toEur(snap.cumulativePensionContributions ?? 0, fx)
            : toEur(totalPaidAtRetirement, fx);

        row[`${code}_compounded`] =
          snap.phase === 'career'
            ? toEur(snap.cumulativeContributionsCompounded ?? 0, fx)
            : toEur(compoundedPeak, fx);

        row[`${code}_received`] =
          snap.phase === 'retirement'
            ? toEur(snap.cumulativePensionReceived ?? 0, fx)
            : null;
      } else {
        row[`${code}_contributions`] = null;
        row[`${code}_compounded`]    = null;
        row[`${code}_received`]      = null;
      }
    });
    return row;
  });

  // Unique retirement ages (for reference lines)
  const retirementAges = Array.from(
    new Set(
      entries
        .map(({ result }) => result.timeline.find((s) => s.phase === 'retirement')?.age)
        .filter((a): a is number => a !== undefined),
    ),
  );

  return (
    <Panel title="Pension Accumulation Over Career (€)">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="age"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            tickFormatter={fmtAxisK}
            width={42}
          />
          <Tooltip
            content={(p) => (
              <EurTooltip
                active={p.active}
                payload={p.payload as never[]}
                label={p.label as number}
                labelPrefix="Age "
              />
            )}
          />

          {/* Retirement age reference lines */}
          {retirementAges.map((age) => (
            <ReferenceLine
              key={age}
              x={age}
              stroke="#38bdf8"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{ value: `Ret. ${age}`, position: 'insideTopLeft', fontSize: 9, fill: '#38bdf8' }}
            />
          ))}

          {/* One line per country × metric */}
          {entries.map(({ code, country }, idx) => {
            const color = countryColor(code, idx);
            const flag  = FLAG[code] ?? code;
            return [
              /* Pension SSC Paid — solid */
              <Line
                key={`${code}_contributions`}
                dataKey={`${code}_contributions`}
                name={`${flag} ${country.name} · SSC Paid`}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={DASH_CONTRIBUTIONS}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />,
              /* Compounded Value — long-dash */
              <Line
                key={`${code}_compounded`}
                dataKey={`${code}_compounded`}
                name={`${flag} ${country.name} · Compounded`}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={DASH_COMPOUNDED}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />,
              /* Pension Received — dotted, retirement phase only */
              <Line
                key={`${code}_received`}
                dataKey={`${code}_received`}
                name={`${flag} ${country.name} · Pension Rcvd`}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={DASH_RECEIVED}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />,
            ];
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend: country colours + metric dash patterns */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {/* Country colours */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entries.map(({ code, country }, idx) => (
            <span key={code} className="flex items-center gap-1.5 text-xs">
              <span
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 3,
                  background: countryColor(code, idx),
                  borderRadius: 2,
                }}
              />
              <span className="text-slate-300">{FLAG[code] ?? ''} {country.name}</span>
            </span>
          ))}
        </div>

        {/* Metric dash styles */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-l border-slate-700 pl-4">
          {[
            { dash: '',     label: 'SSC Paid (solid)' },
            { dash: '6 3',  label: 'Compounded (dashed)' },
            { dash: '3 3',  label: 'Pension Received (dotted)' },
          ].map(({ dash, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <svg width="22" height="8" style={{ flexShrink: 0 }}>
                <line
                  x1="0" y1="4" x2="22" y2="4"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray={dash || undefined}
                />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ComparisonCharts({ entries, wageMode }: Props) {
  // Only show for fixed-amount wage modes with 2+ countries
  if (entries.length < 2) return null;
  if (wageMode.type === 'multiplier') return null;

  const wageModeLabel =
    wageMode.type === 'fixed_gross_eur'
      ? `Fixed Gross €${wageMode.value.toLocaleString()}`
      : `Fixed Employer Cost €${wageMode.value.toLocaleString()}`;

  return (
    <section className="mt-6 border-t border-slate-700/60 pt-6">
      {/* Section header */}
      <div className="mb-4 flex items-center gap-3 px-0.5">
        <h2 className="text-sm font-semibold text-sky-400 uppercase tracking-wide">
          Cross-Country Comparison
        </h2>
        <span className="text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 font-mono">
          {wageModeLabel}
        </span>
        <span className="text-xs text-slate-600">
          {entries.length} countries · all values in €
        </span>
      </div>

      {/* Top row: cost breakdown + pension output side-by-side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CostBreakdownChart entries={entries} />
        <PensionOutputChart entries={entries} />
      </div>

      {/* Full-width accumulation chart */}
      <div className="mt-4">
        <AccumulationChart entries={entries} />
      </div>
    </section>
  );
}
