/**
 * WageDistributionChart — lognormal wage distribution with selected-wage marker
 *
 * Renders a right-skewed log-normal density curve parameterised by:
 *   mean  = country.averageWage  (AW)
 *   median = country.medianWage  (falls back to 0.8 × AW when absent)
 *
 * The curve is split into two filled areas at the selected wage so the user
 * immediately sees what fraction of earners they are above.
 *
 * Reference lines: mode (yellow), median (emerald), mean/AW (amber), selected (sky)
 */

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Label,
} from 'recharts';
import type { CountryConfig } from '../types';

// ─── Math helpers ─────────────────────────────────────────────────────────────

/**
 * Abramowitz & Stegun (7.1.26) approximation of erf — max error < 1.5×10⁻⁷.
 */
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
    t;
  return sign * (1 - poly * Math.exp(-a * a));
}

/** Standard normal CDF — Φ(z) */
function normalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Log-normal PDF */
function lognormalPDF(x: number, mu: number, sigma: number): number {
  if (x <= 0 || sigma <= 0) return 0;
  const z = (Math.log(x) - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (x * sigma * Math.sqrt(2 * Math.PI));
}

/** Log-normal CDF = Φ((ln(x) − μ) / σ) */
function lognormalCDF(x: number, mu: number, sigma: number): number {
  if (x <= 0 || sigma <= 0) return 0;
  return normalCDF((Math.log(x) - mu) / sigma);
}

/**
 * Derive log-normal parameters from the arithmetic mean and median.
 * For X ~ LN(μ,σ²):  E[X] = exp(μ+σ²/2)  ·  Median[X] = exp(μ)
 * → μ = ln(median),  σ² = 2·ln(mean/median)
 */
function lognormalParams(
  mean: number,
  median: number,
): { mu: number; sigma: number; mode: number } {
  // Guard: median must be < mean for a right-skewed distribution
  const safeMedian = median > 0 && median < mean ? median : mean * 0.8;
  const mu = Math.log(safeMedian);
  const sigma2 = 2 * (Math.log(mean) - Math.log(safeMedian));
  const sigma = sigma2 > 0 ? Math.sqrt(sigma2) : 0.5;
  // mode = exp(μ − σ²)
  const mode = Math.exp(mu - sigma2);
  return { mu, sigma, mode };
}

/**
 * Fit a log-normal distribution to five empirical percentile points using
 * Ordinary Least Squares in log-space.
 *
 * For X ~ LN(μ,σ):  ln(P_x) = μ + σ·Φ⁻¹(x)
 * OLS gives:
 *   μ = mean(ln(wages))       [because z-values are symmetric → mean(z) = 0]
 *   σ = Σ(z_i·ln(wage_i)) / Σ(z_i²)
 *
 * This uses all five empirical points
 * (P10, P25, P50, P75, P90) so the fitted curve matches the real distribution
 * far better than the two-point mean/median approach, and gives a substantially
 * more accurate mode estimate.
 */
function fitLognormalOLS(
  p10: number, p25: number, p50: number, p75: number, p90: number,
): { mu: number; sigma: number; mode: number } {
  // Standard normal quantiles for P10, P25, P50, P75, P90
  const zs = [-1.28155, -0.67449, 0, 0.67449, 1.28155];
  const ws = [p10, p25, p50, p75, p90];
  const lnWs = ws.map(w => Math.log(Math.max(w, 1)));

  // μ = mean(ln(wages))  (Σz_i = 0 by symmetry)
  const mu = lnWs.reduce((s, v) => s + v, 0) / 5;

  // σ = Σ(z_i · ln(wage_i)) / Σ(z_i²)
  // Σz² = 2*(1.28155² + 0.67449²) = 2*(1.6424 + 0.4549) = 4.1946
  const sumZY = zs.reduce((s, z, i) => s + z * lnWs[i], 0);
  const sumZ2 = 4.1946;
  const sigma = Math.max(sumZY / sumZ2, 0.05);

  const mode = Math.exp(mu - sigma * sigma);
  return { mu, sigma, mode };
}

// ─── Chart data builder ───────────────────────────────────────────────────────

interface DistPoint {
  wage: number;       // local currency
  dBelow: number;     // density when wage ≤ selectedWage, else 0 (filled blue)
  dAbove: number;     // density when wage >  selectedWage, else 0 (filled gray)
}

const N_POINTS = 300;

function buildDistribution(
  mu: number,
  sigma: number,
  selectedWage: number,
  xMin: number,
  xMax: number,
): DistPoint[] {
  const step = (xMax - xMin) / N_POINTS;

  // Peak density (at mode = exp(μ − σ²)) — used for normalisation
  const modeX = Math.exp(mu - sigma * sigma);
  const peakDensity = lognormalPDF(modeX, mu, sigma);
  const scale = peakDensity > 0 ? 1 / peakDensity : 1;

  const points: DistPoint[] = [];
  for (let i = 0; i <= N_POINTS; i++) {
    const wage = xMin + i * step;
    const density = lognormalPDF(wage, mu, sigma) * scale; // normalised 0–1
    points.push({
      wage,
      dBelow: wage <= selectedWage ? density : 0,
      dAbove: wage > selectedWage ? density : 0,
    });
  }
  return points;
}

// ─── Tick-interval helper ───────────────────────────────────────────────────

/**
 * Returns a "nice" round interval such that ~targetCount evenly-spaced ticks
 * span the given range.  Works at any magnitude (EUR hundreds → CZK tens-of-thousands).
 */
function niceInterval(range: number, targetCount: number): number {
  if (range <= 0 || targetCount <= 0) return 1;
  const raw  = range / targetCount;
  const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm <= 1.5) return mag;
  if (norm <= 3.5) return 2 * mag;
  if (norm <= 7.5) return 5 * mag;
  return 10 * mag;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtWageShort(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${Math.round(value)}`;
}

function currencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€', CZK: 'Kč', PLN: 'zł', HUF: 'Ft', SEK: 'kr', DKK: 'kr',
  };
  return symbols[currency] ?? currency;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function DistTooltip({
  active,
  payload,
  currency,
  mu,
  sigma,
}: {
  active?: boolean;
  payload?: Array<{ payload: DistPoint }>;
  currency: string;
  mu: number;
  sigma: number;
}) {
  if (!active || !payload?.length) return null;
  const { wage } = payload[0].payload;
  const pct = lognormalCDF(wage, mu, sigma);
  return (
    <div className="bg-slate-800 border border-slate-600 text-xs px-2 py-1 rounded shadow-lg">
      <div className="text-slate-200 font-mono">
        {Math.round(wage).toLocaleString('de-CH')} {currency}
      </div>
      <div className="text-slate-400">
        {(pct * 100).toFixed(0)}th percentile
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  country: CountryConfig;
  /** Monthly gross wage in local currency (the currently selected wage). */
  selectedWageLocal: number;
  /** Current app currency toggle — drives whether labels/axis show EUR or local. */
  currency: 'EUR' | 'local';
  eurExchangeRate: number;
}

export function WageDistributionChart({ country, selectedWageLocal, currency, eurExchangeRate }: Props) {
  // Scale factor: 1 for local display, 1/rate for EUR display.
  // All local-currency values are multiplied by this before charting.
  const fx = currency === 'EUR' && country.currency !== 'EUR' ? 1 / eurExchangeRate : 1;
  const displaySym = currency === 'EUR' && country.currency !== 'EUR' ? '€' : currencySymbol(country.currency);

  const aw         = country.averageWage  * fx;
  const medianWage = (country.medianWage  ?? country.averageWage * 0.8) * fx;
  const minWage    = (country.minimumWage ?? country.averageWage * 0.02) * fx;

  // OLS fitting is done in local currency for numerical stability, then we
  // derive scaled mu (sigma is scale-invariant) for display.
  const { mu: muLocal, sigma, mode: modeLocal } = country.wagePercentiles
    ? fitLognormalOLS(
        country.wagePercentiles.p10,
        country.wagePercentiles.p25,
        country.medianWage ?? country.averageWage * 0.8,
        country.wagePercentiles.p75,
        country.wagePercentiles.p90,
      )
    : lognormalParams(country.averageWage, country.medianWage ?? country.averageWage * 0.8);

  // Scaling a lognormal: if Y = c*X then mu_Y = mu_X + ln(c)
  const mu   = muLocal + Math.log(Math.max(fx, 1e-12));
  const mode = modeLocal * fx;

  const selectedWageDisplay = selectedWageLocal * fx;
  // Right edge: always show at least 1.6× the selected wage plus enough to
  // see 2.2× the mean — whichever is larger.  This keeps the chart tight
  // when the selected wage is low but expands naturally for high earners.
  const xMax = Math.max(selectedWageDisplay * 1.6, aw * 2.2);

  const data = buildDistribution(mu, sigma, selectedWageDisplay, minWage, xMax);

  const selectedPct = lognormalCDF(selectedWageDisplay, mu, sigma);
  const sym = displaySym;

  const xTickInterval = niceInterval(xMax - minWage, 5);
  const xTicks: number[] = [];
  for (let v = Math.ceil(minWage / xTickInterval) * xTickInterval; v <= xMax; v += xTickInterval) xTicks.push(v);

  const fmtTick = (v: number) => fmtWageShort(v);

  return (
    <div className="mb-3">
      {/* Header row */}
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          Wage Distribution
        </span>
        <span className="text-xs text-slate-500">
          Selected wage is in the&nbsp;
          <span className="text-sky-400 font-semibold">
            {(selectedPct * 100).toFixed(0)}th percentile
          </span>
        </span>
      </div>
      {/* Disclaimer */}
      <p className="text-[10px] text-slate-600 italic mb-1">
        {country.wagePercentiles
          ? 'Approximate only \u2014 lognormal curve fitted to P10/P25/P50/P75/P90 (Eurostat SES); actual distribution varies.'
          : 'Approximate only \u2014 lognormal curve fitted to median \u0026 mean wage; actual distribution varies by country.'}
      </p>

      <div className="relative">
        <span className="absolute top-0 left-0 text-[8px] text-slate-400 leading-none z-10">
          Min
        </span>
        <ResponsiveContainer width="100%" height={160}>
        <ComposedChart
          data={data}
          margin={{ top: 52, right: 8, bottom: 0, left: 0 }}
        >
          {/* dBelow — sky blue fill (below selected wage) */}
          <Area
            type="monotone"
            dataKey="dBelow"
            stroke="none"
            fill="#0ea5e9"
            fillOpacity={0.35}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
            legendType="none"
          />
          {/* dAbove — slate fill (above selected wage) */}
          <Area
            type="monotone"
            dataKey="dAbove"
            stroke="none"
            fill="#475569"
            fillOpacity={0.3}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
            legendType="none"
          />

          {/* X axis — wage in local currency */}
          <XAxis
            dataKey="wage"
            type="number"
            domain={[minWage, xMax]}
            ticks={xTicks}
            tickFormatter={fmtTick}
            tick={{ fontSize: 9, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            scale="linear"
          />

          {/* Y axis — hidden, density is relative */}
          <YAxis hide domain={[0, 1.15]} />

          {/* Guide line at zero */}
          <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />

          {/* ─── Minimum wage ─────────────────────────────────────────────── */}
          {/* Label is rendered as an absolute overlay at top-left; only the line remains here */}
          <ReferenceLine
            x={minWage}
            stroke="#94a3b8"
            strokeDasharray="2 2"
            strokeWidth={1.5}
          />

          {/* ─── Mode ─────────────────────────────────────────────────────── */}
          <ReferenceLine
            x={mode}
            stroke="#facc15"
            strokeDasharray="3 3"
            strokeWidth={1.5}
          >
            <Label
              value="Mode"
              position="top"
              dy={-24}
              fontSize={8}
              fill="#facc15"
            />
          </ReferenceLine>

          {/* ─── Median ───────────────────────────────────────────────────── */}
          <ReferenceLine
            x={medianWage}
            stroke="#34d399"
            strokeDasharray="3 3"
            strokeWidth={1.5}
          >
            <Label
              value="Median"
              position="top"
              dy={-12}
              fontSize={8}
              fill="#34d399"
            />
          </ReferenceLine>

          {/* ─── Mean (AW) ────────────────────────────────────────────────── */}
          <ReferenceLine
            x={aw}
            stroke="#fb923c"
            strokeDasharray="3 3"
            strokeWidth={1.5}
          >
            <Label
              value="Mean"
              position="top"
              dy={0}
              fontSize={8}
              fill="#fb923c"
            />
          </ReferenceLine>

          {/* ─── Selected wage ────────────────────────────────────────────── */}
          <ReferenceLine
            x={selectedWageDisplay}
            stroke="#38bdf8"
            strokeWidth={2}
          >
            <Label
              value={`You · ${fmtWageShort(selectedWageDisplay)}${sym}`}
              position="top"
              dy={-18}
              fontSize={8.5}
              fill="#38bdf8"
              fontWeight="bold"
            />
          </ReferenceLine>

          <Tooltip
            content={
              <DistTooltip currency={displaySym} mu={mu} sigma={sigma} />
            }
            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {/* Legend strip */}
      <div className="flex gap-3 text-[10px] text-slate-500 mt-1 pl-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-sky-500/40" />
          Below you
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-2 rounded-sm bg-slate-500/40" />
          Above you
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t border-dashed border-slate-400" />
          Min wage
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t border-dashed border-yellow-400" />
          Mode
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t border-dashed border-emerald-400" />
          Median
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t border-dashed border-orange-400" />
          Mean (AW)
        </span>
      </div>
    </div>
  );
}
