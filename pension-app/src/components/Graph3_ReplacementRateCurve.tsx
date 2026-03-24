/**
 * Graph 3 — Replacement Rate Curve + Taxation by Wage Level
 *
 * Two toggled views sharing the same X-axis (AW multiplier):
 *
 * View A — Replacement Rate:
 *   • Gross RR — monthlyPension / grossMonthly
 *   • Net RR   — (monthlyPension − pensionIncomeTax) / grossMonthly
 *                (shown only when the country taxes pension income)
 *   Reference lines: 50 % and 70 % adequacy benchmarks, current wage
 *
 * View B — Taxation:
 *   • Effective PIT rate   — income tax / gross (during working life)
 *   • Marginal PIT rate    — marginal bracket rate
 *   • Employee SSC rate    — employee SSC / gross
 *   • Total burden         — (PIT + employee SSC) / gross
 *   • Combined burden       — (PIT + employee SSC + employer SSC) / gross
 *   • Pension tax rate     — pension income tax / monthly pension
 *                            (shown only when the country taxes pension income)
 */

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { CountryConfig, CareerDefaults, ScenarioResult, WageMode } from '../types';
import { PensionEngine } from '../engines/PensionEngine';
import { TaxEngine } from '../engines/TaxEngine';
import { SSCEngine } from '../engines/SSCEngine';
import { computePensionTax } from '../utils/computeScenario';

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_LOW  = 0.5;
const BASE_HIGH = 4.0;
const STEP      = 0.25;

/**
 * Build a sorted de-duped list of AW multipliers for the curve.
 * Extends uppward to include `extraPoint` when it falls outside the base range.
 */
function buildMultipliers(extraPoint?: number): number[] {
  const high =
    extraPoint !== undefined && extraPoint > BASE_HIGH
      ? Math.ceil(extraPoint / STEP) * STEP
      : BASE_HIGH;
  const low =
    extraPoint !== undefined && extraPoint < BASE_LOW
      ? Math.floor(extraPoint / STEP) * STEP
      : BASE_LOW;

  const steps = Math.round((high - low) / STEP);
  const pts = Array.from({ length: steps + 1 }, (_, i) => +(low + i * STEP).toFixed(2));

  // Insert the exact extra point so ReferenceLine snaps perfectly
  if (
    extraPoint !== undefined &&
    !pts.some((p) => Math.abs(p - extraPoint) < 0.001)
  ) {
    pts.push(extraPoint);
    pts.sort((a, b) => a - b);
  }

  return pts;
}

// ─── Data builder ─────────────────────────────────────────────────────────────

interface CurvePoint {
  multiplier: number;
  grossRR: number;        // %
  netRR: number | null;   // % — null when no pension tax (avoids second line)
}

function buildCurve(
  country: CountryConfig,
  careerYears: number,
  retirementAge: number,
  hasPensionTax: boolean,
  multipliers: number[],
): CurvePoint[] {
  return multipliers.map((m) => {
    const grossMonthly = country.averageWage * m;
    const pr = PensionEngine.calculate(country, grossMonthly, careerYears, retirementAge);
    const grossRR = grossMonthly > 0 ? (pr.monthlyPension / grossMonthly) * 100 : 0;

    let netRR: number | null = null;
    if (hasPensionTax) {
      const tax = computePensionTax(country, pr.monthlyPension);
      netRR = grossMonthly > 0 ? ((pr.monthlyPension - tax) / grossMonthly) * 100 : 0;
    }

    return {
      multiplier: m,
      grossRR: +grossRR.toFixed(1),
      netRR: netRR !== null ? +netRR.toFixed(1) : null,
    };
  });
}

// ─── Tax curve data builder ───────────────────────────────────────────────────

interface TaxPoint {
  multiplier: number;
  effectivePIT: number;     // % of gross
  marginalPIT: number;      // % (bracket rate)
  employeeSSC: number;      // % of gross
  employerSSC: number;      // % of gross (paid on top of gross)
  totalBurden: number;      // (PIT + employee SSC) / gross %
  combinedBurden: number;   // (PIT + employee SSC + employer SSC) / gross %
  pensionTaxRate: number | null; // pension income tax / gross pension % (null = no tax)
}

function buildTaxCurve(
  country: CountryConfig,
  careerYears: number,
  retirementAge: number,
  hasPensionTax: boolean,
  multipliers: number[],
): TaxPoint[] {
  return multipliers.map((m) => {
    const grossMonthly = country.averageWage * m;
    const tax = TaxEngine.calculate(country, grossMonthly);
    const ssc = SSCEngine.calculate(country, grossMonthly);

    const effectivePIT   = grossMonthly > 0 ? (tax.incomeTaxMonthly / grossMonthly) * 100 : 0;
    const marginalPIT    = tax.marginalTaxRate * 100;
    const employeeSSC    = grossMonthly > 0 ? (ssc.employeeTotal / grossMonthly) * 100 : 0;
    const employerSSC    = grossMonthly > 0 ? (ssc.employerTotal / grossMonthly) * 100 : 0;
    const totalBurden    = effectivePIT + employeeSSC;
    const combinedBurden = effectivePIT + employeeSSC + employerSSC;

    let pensionTaxRate: number | null = null;
    if (hasPensionTax) {
      const pr        = PensionEngine.calculate(country, grossMonthly, careerYears, retirementAge);
      const pensionTax = computePensionTax(country, pr.monthlyPension);
      pensionTaxRate  = pr.monthlyPension > 0 ? (pensionTax / pr.monthlyPension) * 100 : 0;
    }

    return {
      multiplier: m,
      effectivePIT:   +effectivePIT.toFixed(1),
      marginalPIT:    +marginalPIT.toFixed(1),
      employeeSSC:    +employeeSSC.toFixed(1),
      employerSSC:    +employerSSC.toFixed(1),
      totalBurden:    +totalBurden.toFixed(1),
      combinedBurden: +combinedBurden.toFixed(1),
      pensionTaxRate: pensionTaxRate !== null ? +pensionTaxRate.toFixed(1) : null,
    };
  });
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function CurveTooltip({
  active,
  payload,
  label,
  hasPensionTax,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: number;
  hasPensionTax: boolean;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  const visible = payload.filter((e) => e.value !== null && e.value !== undefined);
  if (!visible.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-300 mb-1.5">{label}× AW</p>
      {visible.map((e, i) => (
        <div key={i} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="text-slate-100 font-mono">{(e.value as number).toFixed(1)} %</span>
        </div>
      ))}
      {!hasPensionTax && (
        <p className="text-slate-500 mt-1 text-[10px]">Pension income exempt from tax</p>
      )}
    </div>
  );
}

function TaxTooltip({
  active,
  payload,
  label,
  hasPensionTax,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: number;
  hasPensionTax: boolean;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  const visible = payload.filter(
    (e) => e.value !== null && e.value !== undefined && e.dataKey !== 'pensionTaxRate' || (hasPensionTax && e.dataKey === 'pensionTaxRate' && e.value !== null)
  );
  if (!visible.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-300 mb-1.5">{label}× AW</p>
      {visible.map((e, i) => (
        <div key={i} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="text-slate-100 font-mono">{(e.value as number).toFixed(1)} %</span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  country: CountryConfig;
  result: ScenarioResult;
  careerOverrides: Partial<CareerDefaults>;
  wageMode: WageMode;
}

export function Graph3_ReplacementRateCurve({ country, result, careerOverrides, wageMode }: Props) {
  const retirementAge =
    careerOverrides.retirementAge ?? country.defaults.retirementAge;
  const careerStartAge =
    careerOverrides.careerStartAge ?? country.defaults.careerStartAge;
  const careerYears = retirementAge - careerStartAge;

  const hasPensionTax =
    !!country.pensionTax && country.pensionTax.method !== 'none';

  // Toggle state
  const [activeView, setActiveView] = useState<'rr' | 'tax'>('rr');

  // Current scenario multiplier — always defined for all wage modes
  const currentMultiplier = +(
    result.resolvedWage.impliedMultiplier ??
    (country.averageWage > 0
      ? result.resolvedWage.grossLocal / country.averageWage
      : 1)
  ).toFixed(4);

  // In fixed-wage modes we always show the marker; extend the curve range to include it
  const isFixed = wageMode.type !== 'multiplier';
  const multipliers = buildMultipliers(isFixed ? currentMultiplier : undefined);

  // Replacement rate data
  const rrData: CurvePoint[] = buildCurve(country, careerYears, retirementAge, hasPensionTax, multipliers);

  // Taxation data
  const taxData: TaxPoint[] = buildTaxCurve(country, careerYears, retirementAge, hasPensionTax, multipliers);

  // Y-axis domain for RR chart
  const allRR = rrData.flatMap((d) => [d.grossRR, d.netRR ?? d.grossRR]);
  const rrYMax = Math.ceil(Math.max(...allRR) / 10) * 10 + 10;
  const rrYMin = Math.max(0, Math.floor(Math.min(...allRR) / 10) * 10 - 5);

  // Y-axis domain for Tax chart
  const allTax = taxData.flatMap((d) => [
    d.effectivePIT, d.marginalPIT, d.employeeSSC, d.employerSSC, d.totalBurden, d.combinedBurden,
    ...(d.pensionTaxRate !== null ? [d.pensionTaxRate] : []),
  ]);
  const taxYMax = Math.ceil(Math.max(...allTax, 5) / 5) * 5 + 5;
  const taxYMin = 0;

  // X-axis shared config
  const xLow  = multipliers[0];
  const xHigh = multipliers[multipliers.length - 1];
  const xFmt  = (v: number) => `${v}×`;
  const baseTicks = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter((t) => t <= xHigh);
  const xTicks = xHigh > 4 && !baseTicks.includes(xHigh) ? [...baseTicks, +xHigh.toFixed(2)] : baseTicks;

  // Shared sub-components
  const sharedXAxis = (
    <XAxis
      dataKey="multiplier"
      type="number"
      domain={[xLow, xHigh]}
      ticks={xTicks}
      tickFormatter={xFmt}
      tick={{ fontSize: 10, fill: '#64748b' }}
      axisLine={{ stroke: '#334155' }}
      tickLine={false}
    />
  );

  const currentWageRefLine = (
    <ReferenceLine
      x={currentMultiplier}
      stroke="#e2e8f0"
      strokeDasharray="3 3"
      strokeWidth={1.5}
      label={{
        value: `${currentMultiplier.toFixed(2)}\u00d7`,
        position: 'top',
        fontSize: 9,
        fill: '#e2e8f0',
        fontWeight: isFixed ? 600 : 400,
      }}
    />
  );

  return (
    <div className="mt-4">
      {/* ── Header row with title + toggles ── */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] text-slate-500 uppercase tracking-wide">
          {activeView === 'rr'
            ? `Replacement Rate by Wage Level (${xLow}× – ${xHigh.toFixed(xHigh % 1 === 0 ? 0 : 2)}× AW)`
            : `Taxation by Wage Level (${xLow}× – ${xHigh.toFixed(xHigh % 1 === 0 ? 0 : 2)}× AW)`}
        </h4>
        {/* Toggle pills */}
        <div className="flex rounded overflow-hidden border border-slate-700 text-[10px] shrink-0 ml-2">
          <button
            onClick={() => setActiveView('rr')}
            className={`px-2 py-0.5 transition-colors ${
              activeView === 'rr'
                ? 'bg-sky-700/60 text-sky-200'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            Replacement Rate
          </button>
          <button
            onClick={() => setActiveView('tax')}
            className={`px-2 py-0.5 transition-colors border-l border-slate-700 ${
              activeView === 'tax'
                ? 'bg-violet-700/60 text-violet-200'
                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
            }`}
          >
            Taxation
          </button>
        </div>
      </div>

      {/* ── Replacement Rate chart ── */}
      {activeView === 'rr' && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5" style={{ background: '#38bdf8' }} />
              Gross RR
            </span>
            {hasPensionTax && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-5 h-0.5"
                  style={{
                    background: '#f97316',
                    backgroundImage: 'repeating-linear-gradient(90deg, #f97316 0, #f97316 4px, transparent 4px, transparent 7px)',
                    height: '2px',
                  }}
                />
                Net RR
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={rrData} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              {sharedXAxis}
              <YAxis
                domain={[rrYMin, rrYMax]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<CurveTooltip hasPensionTax={hasPensionTax} />} />

              {/* OECD adequacy benchmarks */}
              <ReferenceLine
                y={70}
                stroke="#4ade80"
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{ value: '70%', position: 'insideTopRight', fontSize: 9, fill: '#4ade80', dy: -2 }}
              />
              <ReferenceLine
                y={50}
                stroke="#facc15"
                strokeDasharray="4 3"
                strokeWidth={1}
                label={{ value: '50%', position: 'insideTopRight', fontSize: 9, fill: '#facc15', dy: -2 }}
              />
              {currentWageRefLine}

              <Line
                type="monotone" dataKey="grossRR" name="Gross RR"
                stroke="#38bdf8" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: '#38bdf8' }} isAnimationActive={false}
              />
              {hasPensionTax && (
                <Line
                  type="monotone" dataKey="netRR" name="Net RR"
                  stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3"
                  dot={false} activeDot={{ r: 3, fill: '#f97316' }} isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* ── Taxation chart ── */}
      {activeView === 'tax' && (
        <>
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5" style={{ background: '#38bdf8' }} />
              Eff. PIT
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-5 h-0.5"
                style={{
                  background: '#38bdf8',
                  backgroundImage: 'repeating-linear-gradient(90deg, #38bdf8 0, #38bdf8 4px, transparent 4px, transparent 7px)',
                  height: '2px',
                }}
              />
              Marginal PIT
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5" style={{ background: '#34d399' }} />
              Employee SSC
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5" style={{ background: '#fb923c' }} />
              Employer SSC
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5" style={{ background: '#a78bfa' }} />
              Total Burden
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-5 h-0.5" style={{ background: '#f43f5e' }} />
              Combined Burden
            </span>
            {hasPensionTax && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-5 h-0.5"
                  style={{
                    background: '#f87171',
                    backgroundImage: 'repeating-linear-gradient(90deg, #f87171 0, #f87171 4px, transparent 4px, transparent 7px)',
                    height: '2px',
                  }}
                />
                Pension Tax Rate
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={taxData} margin={{ top: 14, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              {sharedXAxis}
              <YAxis
                domain={[taxYMin, taxYMax]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<TaxTooltip hasPensionTax={hasPensionTax} />} />
              {currentWageRefLine}

              {/* Effective PIT */}
              <Line
                type="monotone" dataKey="effectivePIT" name="Eff. PIT"
                stroke="#38bdf8" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: '#38bdf8' }} isAnimationActive={false}
              />
              {/* Marginal PIT — step (bracket boundaries are discontinuous jumps) */}
              <Line
                type="stepAfter" dataKey="marginalPIT" name="Marginal PIT"
                stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="5 3"
                dot={false} activeDot={{ r: 3, fill: '#38bdf8' }} isAnimationActive={false}
              />
              {/* Employee SSC */}
              <Line
                type="monotone" dataKey="employeeSSC" name="Employee SSC"
                stroke="#34d399" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: '#34d399' }} isAnimationActive={false}
              />
              {/* Employer SSC */}
              <Line
                type="monotone" dataKey="employerSSC" name="Employer SSC"
                stroke="#fb923c" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: '#fb923c' }} isAnimationActive={false}
              />
              {/* Total burden (PIT + employee SSC) */}
              <Line
                type="monotone" dataKey="totalBurden" name="Total Burden"
                stroke="#a78bfa" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: '#a78bfa' }} isAnimationActive={false}
              />
              {/* Combined burden (PIT + employee SSC + employer SSC) */}
              <Line
                type="monotone" dataKey="combinedBurden" name="Combined Burden"
                stroke="#f43f5e" strokeWidth={1.5} dot={false}
                activeDot={{ r: 3, fill: '#f43f5e' }} isAnimationActive={false}
              />
              {/* Pension tax rate — only when applicable */}
              {hasPensionTax && (
                <Line
                  type="monotone" dataKey="pensionTaxRate" name="Pension Tax Rate"
                  stroke="#f87171" strokeWidth={1.5} strokeDasharray="5 3"
                  dot={false} activeDot={{ r: 3, fill: '#f87171' }} isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[9px] text-slate-600 italic mt-0.5">
            Eff. PIT &amp; SSC rates relative to gross wage · Employer SSC expressed as % of gross · Pension Tax Rate on gross monthly pension
          </p>
        </>
      )}
    </div>
  );
}
