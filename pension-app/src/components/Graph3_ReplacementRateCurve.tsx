/**
 * Graph 3 — Replacement Rate Curve
 *
 * Shows how the gross (and net) pension replacement rate evolves as the
 * assumed lifetime wage ranges from 0.5 × AW to 4 × AW.
 *
 * X-axis : wage level expressed as a multiple of the country average wage
 * Y-axis : replacement rate (%)
 * Lines  :
 *   • Gross RR — monthlyPension / grossMonthly
 *   • Net RR   — (monthlyPension − pensionIncomeTax) / grossMonthly
 *                (shown only when the country taxes pension income)
 * Reference lines:
 *   • Vertical   — current scenario wage multiplier
 *   • Horizontal — 50 % and 70 % adequacy benchmarks
 */

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
import type { CountryConfig, CareerDefaults, ScenarioResult, WageMode, ReductionThreshold, DBConfig } from '../types';
import { PensionEngine } from '../engines/PensionEngine';
import { computePensionTax } from '../utils/computeScenario';

/** Extract DB-style reduction thresholds from any pension system config. */
export function getReductionThresholds(country: CountryConfig): ReductionThreshold[] {
  const ps = country.pensionSystem;
  if (ps.type === 'DB') return ps.reductionThresholds;
  if (ps.type === 'MIXED' && ps.pillar1.type === 'DB')
    return (ps.pillar1 as DBConfig).reductionThresholds;
  return [];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_LOW  = 0.5;
const BASE_HIGH = 4.0;
const STEP      = 0.01;

/**
 * Build a sorted de-duped list of AW multipliers for the curve.
 * Extends upward/downward to include `extraPoint` when it falls outside the base range.
 * `baseLow` overrides BASE_LOW (used to start from minimum wage).
 */
function buildMultipliers(extraPoint?: number, baseLow: number = BASE_LOW): number[] {
  const high =
    extraPoint !== undefined && extraPoint > BASE_HIGH
      ? Math.ceil(extraPoint / STEP) * STEP
      : BASE_HIGH;

  // Snap low to the STEP grid so generated points always land on standard AW
  // multiples and the last point reliably hits `high` (e.g. 4.0×).
  const snappedLow =
    extraPoint !== undefined && extraPoint < baseLow
      ? Math.floor(extraPoint / STEP) * STEP
      : Math.ceil(baseLow / STEP) * STEP;

  const steps = Math.max(0, Math.round((high - snappedLow) / STEP));
  const pts = Array.from({ length: steps + 1 }, (_, i) => +(snappedLow + i * STEP).toFixed(2));

  // Prepend the exact minimum-wage point when it falls below the first step tick
  if (baseLow < snappedLow - 0.001 && !pts.some((p) => Math.abs(p - baseLow) < 0.001)) {
    pts.unshift(+baseLow.toFixed(4));
  }

  // Insert the exact extra point so the scenario ReferenceLine snaps perfectly
  if (extraPoint !== undefined && !pts.some((p) => Math.abs(p - extraPoint) < 0.001)) {
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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

  // Current scenario multiplier — always defined for all wage modes
  const currentMultiplier = +(
    result.resolvedWage.impliedMultiplier ??
    (country.averageWage > 0
      ? result.resolvedWage.grossLocal / country.averageWage
      : 1)
  ).toFixed(4);

  // Minimum wage as AW multiplier — start the curve here instead of BASE_LOW
  const minWageMultiplier =
    country.minimumWage && country.averageWage > 0
      ? +(country.minimumWage / country.averageWage).toFixed(4)
      : BASE_LOW;

  // Reduction thresholds — DB systems only (e.g. CZ)
  const reductionThresholds = getReductionThresholds(country);
  const thresholdMultipliers = reductionThresholds.map(
    t => +(t.upTo / country.averageWage).toFixed(4)
  );

  // In fixed-wage modes we always show the marker; extend the curve range to include it
  const isFixed = wageMode.type !== 'multiplier';
  const multipliers = buildMultipliers(isFixed ? currentMultiplier : undefined, minWageMultiplier);

  // Insert exact threshold multipliers so the curve passes through each breakpoint
  for (const tm of thresholdMultipliers) {
    if (Number.isFinite(tm) && !multipliers.some(p => Math.abs(p - tm) < 0.001)) {
      multipliers.push(tm);
    }
  }
  multipliers.sort((a, b) => a - b);

  const data: CurvePoint[] = buildCurve(country, careerYears, retirementAge, hasPensionTax, multipliers);

  // Y-axis domain — add a bit of headroom
  const allRR = data.flatMap((d) => [d.grossRR, d.netRR ?? d.grossRR]);
  const yMax = Math.ceil(Math.max(...allRR) / 10) * 10 + 10;
  const yMin = Math.max(0, Math.floor(Math.min(...allRR) / 10) * 10 - 5);

  // X-axis: numeric type so ReferenceLine x works at any position
  const xLow  = multipliers[0];
  const xHigh = multipliers[multipliers.length - 1];
  const xFmt  = (v: number) => `${v}×`;
  // Base ticks every 0.5x, filtered to visible range; prepend xLow tick if it's not close to a base tick
  const baseTicks = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].filter((t) => t >= xLow && t <= xHigh);
  const hasMinWageTick = baseTicks.some((t) => Math.abs(t - xLow) < 0.05);
  const withMinWage = hasMinWageTick ? baseTicks : [+xLow.toFixed(2), ...baseTicks];
  const xTicks = xHigh > 4 && !withMinWage.includes(xHigh) ? [...withMinWage, +xHigh.toFixed(2)] : withMinWage;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] text-slate-500 uppercase tracking-wide">
          Replacement Rate by Wage Level ({country.minimumWage ? 'min wage' : `${xLow}×`} – {xHigh.toFixed(xHigh % 1 === 0 ? 0 : 2)}× AW)
        </h4>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-5 h-0.5"
              style={{ background: '#38bdf8' }}
            />
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
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={data}
          margin={{ top: 14, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1e293b"
            vertical={false}
          />
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
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            content={
              <CurveTooltip hasPensionTax={hasPensionTax} />
            }
          />

          {/* OECD adequacy benchmarks */}
          <ReferenceLine
            y={70}
            stroke="#4ade80"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: '70%',
              position: 'insideTopRight',
              fontSize: 9,
              fill: '#4ade80',
              dy: -2,
            }}
          />
          <ReferenceLine
            y={50}
            stroke="#facc15"
            strokeDasharray="4 3"
            strokeWidth={1}
            label={{
              value: '50%',
              position: 'insideTopRight',
              fontSize: 9,
              fill: '#facc15',
              dy: -2,
            }}
          />

          {/* Current scenario wage level — always visible */}
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

          {/* Pension formula reduction thresholds (DB systems) */}
          {reductionThresholds.map((t, i) => {
            const xVal = thresholdMultipliers[i];
            if (xVal > xHigh + 0.001) return null;
            // RR at this exact threshold point (already in `data` since we inserted it)
            const pt = data.find(d => Math.abs(d.multiplier - xVal) < 0.001);
            const rrLabel = pt ? `${pt.grossRR.toFixed(1)}%` : '';
            const isRight = xVal > (xLow + xHigh) / 2;
            return (
              <ReferenceLine
                key={`rt${i}`}
                x={xVal}
                stroke="#f59e0b"
                strokeDasharray="3 2"
                strokeWidth={1}
                label={{
                  value: rrLabel,
                  position: isRight ? 'insideTopLeft' : 'insideTopRight',
                  fontSize: 8,
                  fill: '#f59e0b',
                  dy: 2,
                }}
              />
            );
          })}

          {/* Gross replacement rate */}
          <Line
            type="monotone"
            dataKey="grossRR"
            name="Gross RR"
            stroke="#38bdf8"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#38bdf8' }}
            isAnimationActive={false}
          />

          {/* Net replacement rate (if pension is taxed) */}
          {hasPensionTax && (
            <Line
              type="monotone"
              dataKey="netRR"
              name="Net RR"
              stroke="#f97316"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 3, fill: '#f97316' }}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
