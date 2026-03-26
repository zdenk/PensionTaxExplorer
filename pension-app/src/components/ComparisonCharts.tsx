/**
 * ComparisonCharts — rendered below the country cards when
 * wageMode is 'fixed_gross_eur' or 'fixed_employer_cost_eur' and 2+ countries are selected.
 *
 * Four panels (user-selectable via sidebar):
 *  A. Monthly Cost Breakdown  — horizontal stacked bar, one row per country
 *  B. Monthly Pension Output  — grouped bar chart, one group per metric, bars per country
 *  C. Pension Accumulation    — multi-line chart, colour = country, dash = metric
 *  D. Replacement Rate Curve  — all-country RR curves overlaid on one chart
 */

import { useState, useMemo, useRef, useEffect } from 'react';
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
import type { CountryConfig, ScenarioResult, WageMode, CareerDefaults, AppState } from '../types';
import { FLAG, ALL_COUNTRIES, COUNTRY_MAP } from '../data/countryRegistry';
import { PensionEngine } from '../engines/PensionEngine';
import { computeScenario, computePensionTax } from '../utils/computeScenario';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CountryScenario {
  code: string;
  country: CountryConfig;
  result: ScenarioResult;
}

// ─── Comparison view registry ─────────────────────────────────────────────────

export type ComparisonViewId = 'cost' | 'pension' | 'accumulation' | 'rr-curve';

const COMPARISON_VIEWS: { id: ComparisonViewId; label: string }[] = [
  { id: 'cost',         label: 'Monthly Cost Breakdown (€)' },
  { id: 'pension',      label: 'Monthly Pension Output (€)' },
  { id: 'accumulation', label: 'Pension Accumulation Over Career (€)' },
  { id: 'rr-curve',    label: 'Replacement Rate Curve' },
];

interface Props {
  entries: CountryScenario[];
  wageMode: WageMode;
  careerOverrides: Partial<CareerDefaults>;
  appState: AppState;
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

const fmtEurFull = (n: number) =>
  `€${Math.round(n).toLocaleString('en-GB')}`;

const fmtAxisK = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000   ? `${Math.round(v / 1_000)}k`
  : String(Math.round(v));

// ─── Shared tooltip ───────────────────────────────────────────────────────────

function EurTooltip({
  active, payload, label, labelPrefix = '', fmt = fmtEur,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string | number;
  labelPrefix?: string;
  fmt?: (n: number) => string;
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
          <span className="text-slate-100 font-mono">{fmt(e.value)}</span>
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
              <EurTooltip active={p.active} payload={p.payload as never[]} fmt={fmtEurFull} />
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
            <span className="text-slate-400 font-mono">Total cost {fmtEurFull(d.totalCost)}</span>
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
              <EurTooltip active={p.active} payload={p.payload as never[]} fmt={fmtEurFull} />
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
  // Age axis: zero-anchor at each country's career start + all snapshot ages shifted by +1.
  // Shifting by +1 means each snapshot at age X (= activity during year X) is displayed at
  // end-of-year X+1, so the final career year peaks exactly AT retirementAge on the x-axis
  // and the pension-received line starts from zero at that same age.
  const allAges = Array.from(
    new Set(entries.flatMap(({ result }) => [
      result.timeline[0]?.age ?? 25,            // zero-anchor at career start
      ...result.timeline.map((s) => s.age + 1), // end-of-year display positions
    ])),
  ).sort((a, b) => a - b);

  // For each age build one flat row: { age, CZ_contributions, CZ_compounded, CZ_received, … }
  const data = allAges.map((age) => {
    const row: Record<string, number | null> = { age };
    entries.forEach(({ code, country, result }) => {
      const fx = country.eurExchangeRate;
      // Each snapshot at age X is shown at X+1, so look for the snap at age-1
      const snap = result.timeline.find((s) => s.age === age - 1);

      const totalPaidAtRetirement =
        result.timeline.find((s) => s.phase === 'retirement')
          ?.cumulativePensionContributionsAtRetirement ?? 0;
      const compoundedPeak =
        [...result.timeline].reverse().find((s) => s.phase === 'career')
          ?.cumulativeContributionsCompounded ?? result.fairReturn.accumulatedPot;
      const firstRetireAge = result.timeline.find((s) => s.phase === 'retirement')?.age;
      const careerStartAge = result.timeline[0]?.age ?? 25;

      if (age === careerStartAge) {
        // Zero-anchor: contributions and compounded start from 0, received not yet active
        row[`${code}_contributions`] = 0;
        row[`${code}_compounded`]    = 0;
        row[`${code}_received`]      = null;
      } else if (snap?.phase === 'career') {
        row[`${code}_contributions`] = toEur(snap.cumulativePensionContributions ?? 0, fx);
        row[`${code}_compounded`]    = toEur(snap.cumulativeContributionsCompounded ?? 0, fx);
        // At retirementAge the last career year peaks here; anchor the received line at 0
        row[`${code}_received`] = age === firstRetireAge ? 0 : null;
      } else if (snap?.phase === 'retirement') {
        row[`${code}_contributions`] = toEur(totalPaidAtRetirement, fx);
        row[`${code}_compounded`]    = toEur(compoundedPeak, fx);
        row[`${code}_received`]      = toEur(snap.cumulativePensionReceived ?? 0, fx);
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

// ─── D. Replacement Rate Curve (comparison) ───────────────────────────────────

function ComparisonRRCurveChart({
  entries,
  careerOverrides,
}: {
  entries: CountryScenario[];
  careerOverrides: Partial<CareerDefaults>;
}) {
  const [rrMode, setRrMode] = useState<'gross' | 'net' | 'both'>('both');

  const LOW  = 0.5;
  const HIGH = 4.0;
  const STEP = 0.05;
  const multipliers = Array.from(
    { length: Math.round((HIGH - LOW) / STEP) + 1 },
    (_, i) => +(LOW + i * STEP).toFixed(2),
  );

  // Which countries tax pension income?
  const taxedCountryCodes = new Set(
    entries
      .filter(({ country }) => !!country.pensionTax && country.pensionTax.method !== 'none')
      .map(({ code }) => code),
  );

  // Build data: one row per multiplier, gross + (optional) net RR per country
  const data = multipliers.map((m) => {
    const row: Record<string, number | null> = { multiplier: m };
    entries.forEach(({ code, country }) => {
      const retirementAge  = careerOverrides.retirementAge  ?? country.defaults.retirementAge;
      const careerStartAge = careerOverrides.careerStartAge ?? country.defaults.careerStartAge;
      const careerYears    = retirementAge - careerStartAge;
      const grossMonthly   = country.averageWage * m;
      const pr = PensionEngine.calculate(country, grossMonthly, careerYears, retirementAge);
      row[code] = grossMonthly > 0 ? +((pr.monthlyPension / grossMonthly) * 100).toFixed(1) : 0;
      if (taxedCountryCodes.has(code)) {
        const tax = computePensionTax(country, pr.monthlyPension);
        row[`${code}_net`] = grossMonthly > 0
          ? +(((pr.monthlyPension - tax) / grossMonthly) * 100).toFixed(1)
          : 0;
      }
    });
    return row;
  });

  const allRR = data.flatMap((row) =>
    entries.flatMap(({ code }) => {
      const vals: number[] = [(row[code] as number) ?? 0];
      if (taxedCountryCodes.has(code)) vals.push((row[`${code}_net`] as number) ?? 0);
      return vals;
    }),
  );
  const yMax  = Math.ceil(Math.max(...allRR) / 10) * 10 + 10;

  // Current wage multiplier per country (for reference lines)
  const currentMultipliers = entries.map(({ code, country, result }, idx) => ({
    code,
    idx,
    multiplier: +(
      result.resolvedWage.impliedMultiplier ??
      (country.averageWage > 0 ? result.resolvedWage.grossLocal / country.averageWage : 1)
    ).toFixed(4),
  }));

  return (
    <Panel title="Replacement Rate Curve">
      {/* Gross / Net toggle — only shown when at least one country taxes pension income */}
      {taxedCountryCodes.size > 0 && (
        <div className="flex items-center gap-1 mb-3">
          {(['gross', 'both', 'net'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setRrMode(mode)}
              className={[
                'px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors',
                rrMode === mode
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
              ].join(' ')}
            >
              {mode === 'gross' ? 'Gross' : mode === 'net' ? 'Net' : 'Both'}
            </button>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="multiplier"
            type="number"
            domain={[LOW, HIGH]}
            ticks={[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]}
            tickFormatter={(v: number) => `${v}×`}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#334155' }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            width={38}
          />
          <Tooltip
            content={(p) => {
              if (!p.active || !p.payload?.length) return null;
              const visible = (p.payload as { name: string; value: number; color: string; dataKey?: string }[])
                .filter((e) => {
                  if (e.value === undefined || e.value === null) return false;
                  const isNet = (e.dataKey as string)?.endsWith('_net');
                  if (rrMode === 'gross' && isNet) return false;
                  if (rrMode === 'net' && !isNet && taxedCountryCodes.has(e.dataKey as string)) return false;
                  return true;
                });
              if (!visible.length) return null;
              return (
                <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                  <p className="font-semibold text-slate-300 mb-1.5">{p.label}× AW</p>
                  {visible.map((e, i) => {
                    const isNet = (e.dataKey as string)?.endsWith('_net');
                    const label = isNet
                      ? e.name.replace(' Net', '') + ' Net RR'
                      : e.name.replace(' Gross', '') + ' Gross RR';
                    return (
                      <div key={i} className="flex justify-between gap-4 mb-0.5">
                        <span style={{ color: e.color }}>{label}</span>
                        <span className="text-slate-100 font-mono">{(e.value as number).toFixed(1)} %</span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          {/* OECD adequacy benchmarks */}
          <ReferenceLine y={70} stroke="#4ade80" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '70%', position: 'insideTopRight', fontSize: 9, fill: '#4ade80', dy: -2 }} />
          <ReferenceLine y={50} stroke="#facc15" strokeDasharray="4 3" strokeWidth={1}
            label={{ value: '50%', position: 'insideTopRight', fontSize: 9, fill: '#facc15', dy: -2 }} />

          {/* Current wage reference lines — one per country */}
          {currentMultipliers.map(({ code, idx, multiplier }) => (
            <ReferenceLine
              key={`ref-${code}`}
              x={multiplier}
              stroke={countryColor(code, idx)}
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

          {/* One solid line per country (gross RR) */}
          {rrMode !== 'net' && entries.map(({ code, country }, idx) => (
            <Line
              key={code}
              dataKey={code}
              name={`${FLAG[code] ?? ''} ${country.name} Gross`}
              stroke={countryColor(code, idx)}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}

          {/* Dashed line per taxed country (net RR) */}
          {rrMode !== 'gross' && entries
            .filter(({ code }) => taxedCountryCodes.has(code))
            .map(({ code, country }) => {
              const idx = entries.findIndex((e) => e.code === code);
              return (
                <Line
                  key={`${code}_net`}
                  dataKey={`${code}_net`}
                  name={`${FLAG[code] ?? ''} ${country.name} Net`}
                  stroke={countryColor(code, idx)}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              );
            })}

          {/* For 'net' mode: still show gross line for countries without pension tax */}
          {rrMode === 'net' && entries
            .filter(({ code }) => !taxedCountryCodes.has(code))
            .map(({ code, country }) => {
              const idx = entries.findIndex((e) => e.code === code);
              return (
                <Line
                  key={`${code}_gross_fallback`}
                  dataKey={code}
                  name={`${FLAG[code] ?? ''} ${country.name} Gross`}
                  stroke={countryColor(code, idx)}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              );
            })}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        {entries.map(({ code, country }, idx) => {
          const isTaxed = taxedCountryCodes.has(code);
          const showGross = rrMode === 'gross' || rrMode === 'both' || !isTaxed;
          const showNet   = isTaxed && (rrMode === 'net' || rrMode === 'both');
          return (
            <span key={code} className="flex items-center gap-3 text-xs">
              {showGross && (
                <span className="flex items-center gap-1">
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
                  {rrMode === 'both' && isTaxed && <span className="text-slate-500">Gross</span>}
                </span>
              )}
              {showNet && (
                <span className="flex items-center gap-1">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 20,
                      height: 2,
                      backgroundImage: `repeating-linear-gradient(90deg, ${countryColor(code, idx)} 0, ${countryColor(code, idx)} 5px, transparent 5px, transparent 8px)`,
                    }}
                  />
                  {rrMode === 'net' && <span className="text-slate-300">{FLAG[code] ?? ''} {country.name}</span>}
                  {rrMode === 'both' && isTaxed && <span className="text-slate-500">Net</span>}
                </span>
              )}
            </span>
          );
        })}
        <span className="text-slate-600 text-xs self-center ml-2">· Career length per country defaults</span>
      </div>
    </Panel>
  );
}

// ─── Comparison sidebar navigator ─────────────────────────────────────────────

// ─── Comparison sidebar navigator ────────────────────────────────────────────────
//
// Mirrors the SectionNav in CountryGrid: sticky float that follows the user
// while scrolling through the comparison charts.

const NAV_WIDTH = '11rem'; // enough for the longest label

function ComparisonNav({
  visible,
  onToggle,
  effectiveCodes,
  allScenarios,
  isOverride,
  onRemove,
  onAdd,
  onReset,
}: {
  visible: Set<ComparisonViewId>;
  onToggle: (id: ComparisonViewId) => void;
  effectiveCodes: string[];
  allScenarios: Record<string, CountryScenario>;
  isOverride: boolean;
  onRemove: (code: string) => void;
  onAdd: (code: string) => void;
  onReset: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const addable = Object.values(allScenarios)
    .filter(s => !effectiveCodes.includes(s.code))
    .sort((a, b) => a.country.name.localeCompare(b.country.name));

  return (
    <div className="flex flex-col gap-0.5 bg-slate-900/95 backdrop-blur-sm border border-slate-700/70 rounded-lg p-1.5 shadow-2xl">

      {/* ── Views section ────────────────────────────────── */}
      <p className="text-[9px] text-slate-500 uppercase tracking-widest px-1 pb-1 mb-0.5 border-b border-slate-800">
        Views
      </p>

      {COMPARISON_VIEWS.map(({ id, label }) => {
        const on = visible.has(id);
        return (
          <div key={id} className="flex items-center gap-0.5">
            <button
              onClick={() => onToggle(id)}
              title={on ? `Hide: ${label}` : `Show: ${label}`}
              className={`flex-1 px-2 py-1 text-[11px] rounded text-left leading-tight transition-all border ${
                on
                  ? 'bg-sky-900/50 border-sky-700/50 text-sky-300'
                  : 'bg-transparent border-transparent text-slate-600 hover:text-slate-400 hover:bg-slate-800/40'
              }`}
            >
              {label}
            </button>
            {on && (
              <button
                onClick={() => onToggle(id)}
                title={`Hide: ${label}`}
                className="text-slate-400 hover:text-red-400 hover:bg-red-900/30 text-[11px] px-1 py-0.5 rounded leading-none transition-colors"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {/* ── Countries section ────────────────────────────── */}
      <div className="h-px bg-slate-800 my-1" />
      <div className="flex items-center justify-between px-1 pb-0.5 mb-0.5">
        <p className="text-[9px] text-slate-500 uppercase tracking-widest">
          Countries
        </p>
        {isOverride && (
          <button
            onClick={onReset}
            title="Reset to global country selection"
            className="text-[9px] text-amber-500/70 hover:text-amber-400 transition-colors"
          >
            ↺ reset
          </button>
        )}
      </div>

      {/* Active country pills */}
      {effectiveCodes.map(code => (
        <button
          key={code}
          onClick={() => onRemove(code)}
          title={`Remove ${COUNTRY_MAP[code]?.name ?? code}`}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded text-left leading-tight transition-all border bg-slate-800/60 border-slate-600/50 text-slate-300 hover:border-red-400/50 hover:text-red-400 group"
        >
          <span>{FLAG[code] ?? ''}</span>
          <span className="flex-1 truncate">{COUNTRY_MAP[code]?.name ?? code}</span>
          <span className="text-slate-500 group-hover:text-red-400 text-[10px] shrink-0">×</span>
        </button>
      ))}

      {/* Add country dropdown — opens to the right of the panel */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className="w-full flex items-center justify-between px-2 py-1 text-[11px] rounded border border-dashed border-slate-700 text-slate-600 hover:text-sky-400 hover:border-sky-700/60 transition-all"
        >
          <span>+ Add</span>
          <span className="text-[9px]">{menuOpen ? '▲' : '▼'}</span>
        </button>
        {menuOpen && (
          <div className="absolute top-0 left-full ml-1.5 z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-40 max-h-64 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">All countries shown</p>
            ) : addable.map(({ code, country }) => (
              <button
                key={code}
                onClick={() => { onAdd(code); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
              >
                <span>{FLAG[code] ?? ''}</span>
                <span>{country.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ComparisonCharts({ entries, wageMode, careerOverrides, appState }: Props) {
  const [visible, setVisible] = useState<Set<ComparisonViewId>>(
    () => new Set<ComparisonViewId>(['cost', 'pension', 'accumulation', 'rr-curve']),
  );
  const [localCodes, setLocalCodes] = useState<string[] | null>(null);

  // Compute scenarios for all OECD EU countries (powers the override country picker)
  const allScenarios = useMemo(() => {
    const out: Record<string, CountryScenario> = {};
    for (const c of ALL_COUNTRIES) {
      try {
        out[c.code] = {
          code: c.code,
          country: c,
          result: computeScenario(
            c,
            appState.wageMode,
            appState.careerOverrides,
            appState.awSource,
            null,
            undefined,
            appState.fairReturnRate,
          ),
        };
      } catch { /* skip */ }
    }
    return out;
  }, [appState.wageMode, appState.careerOverrides, appState.awSource, appState.fairReturnRate]);

  // Effective entries: local override takes precedence over the prop
  const effectiveCodes   = localCodes ?? entries.map(e => e.code);
  const effectiveEntries = effectiveCodes
    .map(code => allScenarios[code])
    .filter((e): e is CountryScenario => !!e);

  // ── Early exit guard ───────────────────────────────────────────────
  if (wageMode.type === 'multiplier') return null;

  const wageModeLabel =
    wageMode.type === 'fixed_gross_eur'
      ? `Fixed Gross €${wageMode.value.toLocaleString()}`
      : `Fixed Employer Cost €${wageMode.value.toLocaleString()}`;

  const toggle = (id: ComparisonViewId) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const show = (id: ComparisonViewId) => visible.has(id);

  const handleRemove = (code: string) =>
    setLocalCodes(prev => {
      const base = prev ?? entries.map(e => e.code);
      return base.filter(c => c !== code);
    });

  const handleAdd = (code: string) =>
    setLocalCodes(prev => {
      const base = prev ?? entries.map(e => e.code);
      return base.includes(code) ? base : [...base, code];
    });

  const handleReset = () => setLocalCodes(null);

  return (
    <div id="section-comparison" className="mt-8">

      {/* ─ Top divider row — mirrors SectionRow header ────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest whitespace-nowrap shrink-0">
          Cross-country Comparison
        </span>
        <div className="flex-1 h-px bg-slate-700/50" />
        <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 font-mono shrink-0">
          {wageModeLabel}
        </span>
      </div>

      {/* ─ Sidebar + charts flex row ─────────────────────────────────── */}
      <div className="flex gap-4">

        {/* Nav wrapper — self-stretch so the sticky inner div stays within
            this section's height and never leaks into content below.       */}
        <div
          className="hidden md:block shrink-0 self-stretch"
          style={{ width: NAV_WIDTH }}
        >
          <div style={{ position: 'sticky', top: '1rem' }}>
            <ComparisonNav
              visible={visible}
              onToggle={toggle}
              effectiveCodes={effectiveCodes}
              allScenarios={allScenarios}
              isOverride={localCodes !== null}
              onRemove={handleRemove}
              onAdd={handleAdd}
              onReset={handleReset}
            />
          </div>
        </div>

        {/* Chart stack */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {effectiveEntries.length >= 2 ? (
            <>
              {show('cost') && <CostBreakdownChart entries={effectiveEntries} />}
              {show('pension') && <PensionOutputChart entries={effectiveEntries} />}
              {show('accumulation') && <AccumulationChart entries={effectiveEntries} />}
              {show('rr-curve') && (
                <ComparisonRRCurveChart entries={effectiveEntries} careerOverrides={careerOverrides} />
              )}
              {visible.size === 0 && (
                <div className="text-sm text-slate-500 italic py-6 text-center">
                  Select a view from the sidebar to display charts.
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-slate-500 italic py-8">
              Add at least 2 countries in the sidebar to compare.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
