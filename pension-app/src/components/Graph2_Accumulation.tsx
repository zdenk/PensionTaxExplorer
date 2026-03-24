/**
 * Graph 2 — Pension Accumulation & Fair Return
 * Two-phase line chart per §6 spec:
 *   Career: cumulative raw contributions + compounded equivalent rise together
 *   Retirement: cumulative pension received climbs toward break-even line
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ScenarioResult } from '../types';

// ─── Visibility groups ────────────────────────────────────────────────────────
type LineGroup = 'accumulation' | 'taxes' | 'takeHome' | 'benefits' | 'statePension' | 'combined';

const LINE_GROUPS: { id: LineGroup; label: string; color: string }[] = [
  { id: 'accumulation', label: 'Accumulation',   color: '#fd16b8' },
  { id: 'taxes',        label: 'Taxes',          color: '#f87171' },
  { id: 'takeHome',     label: 'Take-Home',      color: '#22c55e' },
  { id: 'benefits',     label: 'Take-Home + Benefits', color: '#86efac' },
  { id: 'statePension', label: 'State pension',  color: '#4ade80' },
  { id: 'combined',     label: 'State + DPS',    color: '#7c3aed' },
];

interface Props {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
  retirementAge: number;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function AccumTooltip({
  active,
  payload,
  label,
  isRetirement,
  fmt,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: number;
  isRetirement: (age: number) => boolean;
  fmt: (n: number) => string;
}) {
  if (!active || !payload?.length || label === undefined) return null;
  const retired = isRetirement(label);
  const visible = payload.filter(e => e.value !== null && e.value !== undefined);
  if (!visible.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-slate-300 mb-1.5">
        Age {label}{retired ? ' · retired' : ''}
      </p>
      {visible.map((e, i) => (
        <div key={i} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="text-slate-100 font-mono">{fmt(e.value!)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Graph2_Accumulation({
  result,
  currency,
  countryCurrency,
  eurExchangeRate,
  retirementAge,
}: Props) {
  const [visible, setVisible] = useState<Set<LineGroup>>(
    new Set<LineGroup>(['accumulation', 'taxes', 'takeHome', 'benefits', 'statePension', 'combined'])
  );
  const show = (g: LineGroup) => visible.has(g);
  const toggle = (g: LineGroup) =>
    setVisible(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  const { timeline, fairReturn, sscResult } = result;
  const fx = currency === 'EUR' ? eurExchangeRate : 1;
  const sym = currency === 'EUR' ? '€' : '';
  const sfx = currency === 'EUR' ? '' : ` ${countryCurrency}`;
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString()}${sfx}`;

  // Net state pension (after pension income tax if any)
  const netMonthlyStatePension = result.pensionResult.netMonthlyPension ?? result.pensionResult.monthlyPension;

  // Whether this country levies income tax on pension income
  const hasPensionTax = (result.pensionResult.pensionIncomeTax ?? 0) > 0;

  // Total nominal contributions at retirement (flat reference for retirement phase)
  const totalPaidIn =
    timeline.find(s => s.phase === 'retirement')
      ?.cumulativePensionContributionsAtRetirement ?? 0;

  // Peak compounded value from last career snapshot
  const lastCareerSnap = [...timeline].reverse().find(s => s.phase === 'career');
  const compoundedPeak = lastCareerSnap?.cumulativeContributionsCompounded ?? fairReturn.accumulatedPot;

  // Total income tax paid over career (flat during retirement)
  const totalIncomeTaxPaid = lastCareerSnap?.cumulativeIncomeTax ?? 0;
  // Total net take-home over career (flat during retirement)
  const totalNetTakeHome = lastCareerSnap?.cumulativeNetTakeHome ?? 0;
  // Derive career start age from the first timeline entry
  const careerStartAge = timeline[0]?.age ?? 25;

  // Total money paid in all SSC (employee + employer) and income tax over career.
  // For OSVČ/Paušální daň modes, employerTotal is 0 (all self-paid — correct).
  const careerYears = retirementAge - careerStartAge;
  const isOSVC = sscResult.employerTotal === 0 && sscResult.totalEmployerCost === result.resolvedWage.grossLocal;
  const totalAllTaxesAndSSC = totalIncomeTaxPaid + (sscResult.employeeTotal + sscResult.employerTotal) * 12 * careerYears;

  const isRetirement = (age: number) => age >= retirementAge;

  // Build chart data.
  // Both career and retirement snapshots are shifted by +1 on the age axis:
  // a snapshot at age X represents activity DURING year X, displayed at end-of-year X+1.
  // This makes the accumulation peak at retirementAge and pension received start from
  // retirementAge+1, with an explicit 0-anchor at retirementAge for the received line.
  type ChartPoint = {
    age: number;
    contributions: number;
    compounded: number;
    incomeTax: number;
    netTakeHome: number;
    /** Cumulative net take-home including fringe/meal benefits (light green) */
    netTakeHomeWithBenefits: number | null;
    netReceived: number | null;
    netTakeHomePlusPension: number | null;
    dpsCompounded: number | null;
    /** Cumulative GROSS pension received — retirement only, zero-anchored; dashed line */
    grossReceived: number | null;
    /** Cumulative income tax + pension income tax (stacked) — null when country has no pension tax */
    pensionTaxPaid: number | null;
    /** Cumulative (net state pension + DPS annuity) — retirement only, zero-anchored */
    netTotalReceived: number | null;
    /** Career net take-home baseline + netTotalReceived — dotted, retirement only */
    netTakeHomePlusTotalPension: number | null;
    /** Benefits baseline + net state pension — dotted, retirement only */
    netBenefitsPlusPension: number | null;
    /** Benefits baseline + net state + DPS — dotted, retirement only */
    netBenefitsPlusTotalPension: number | null;
  };

  const ageMap = new Map<number, ChartPoint>();
  const setOrMerge = (p: ChartPoint) => {
    const ex = ageMap.get(p.age);
    if (!ex) { ageMap.set(p.age, { ...p }); return; }
    // Merge: prefer higher numeric values (career peak) and non-null received
    if (p.contributions > ex.contributions) ex.contributions = p.contributions;
    if (p.compounded    > ex.compounded)    ex.compounded    = p.compounded;
    if (p.incomeTax     > ex.incomeTax)     ex.incomeTax     = p.incomeTax;
    if (p.netTakeHome   > ex.netTakeHome)   ex.netTakeHome   = p.netTakeHome;
    if (p.netTakeHomeWithBenefits !== null && (ex.netTakeHomeWithBenefits === null || p.netTakeHomeWithBenefits > ex.netTakeHomeWithBenefits))
      ex.netTakeHomeWithBenefits = p.netTakeHomeWithBenefits;
    if (p.netReceived !== null) ex.netReceived = p.netReceived;
    if (p.netTakeHomePlusPension !== null) ex.netTakeHomePlusPension = p.netTakeHomePlusPension;
    if (p.dpsCompounded !== null && (ex.dpsCompounded === null || p.dpsCompounded > ex.dpsCompounded))
      ex.dpsCompounded = p.dpsCompounded;
    if (p.grossReceived   !== null) ex.grossReceived   = p.grossReceived;
    if (p.pensionTaxPaid  !== null) ex.pensionTaxPaid  = p.pensionTaxPaid;
    if (p.netTotalReceived !== null) ex.netTotalReceived = p.netTotalReceived;
    if (p.netTakeHomePlusTotalPension !== null) ex.netTakeHomePlusTotalPension = p.netTakeHomePlusTotalPension;
    if (p.netBenefitsPlusPension !== null) ex.netBenefitsPlusPension = p.netBenefitsPlusPension;
    if (p.netBenefitsPlusTotalPension !== null) ex.netBenefitsPlusTotalPension = p.netBenefitsPlusTotalPension;
  };

  // CZ DPS / benefit data — must be declared before the zero-anchor setOrMerge call
  const czBr = result.czBenefitResult;
  const hasDps = (czBr?.pensionContribMonthly ?? 0) > 0;
  // Monthly net-pay benefits (fringe + meal) — flows directly into take-home
  const czNetBenefitMonthly = (czBr?.totalNetAdd ?? 0) / fx;
  const hasBenefitNetAdd = !isOSVC && czNetBenefitMonthly > 0;
  // Total cumulative benefit added over the full career
  const totalNetTakeHomeWithBenefits = totalNetTakeHome / fx + czNetBenefitMonthly * 12 * careerYears;
  // Peak DPS pot — sourced from the timeline's last career snapshot so the chart
  // line is guaranteed to match the career series and stay flat through retirement.
  // (czBr.dpsPotAtRetirement can differ when the return-rate slider overrides the
  //  country default used by TimelineBuilder, causing a spurious drop at retirement.)
  const dpsPotPeak = hasDps
    ? (lastCareerSnap?.cumulativeDpsCompounded ?? czBr?.dpsPotAtRetirement ?? 0) / fx
    : 0;
  const dpsMonthlyPension = (czBr?.dpsMonthlyPension ?? 0) / fx;

  // Pre-divide career totals once — used repeatedly in the retirement loop.
  const netTakeHomeLocal   = totalNetTakeHome   / fx;
  const totalIncomeTaxLocal = totalIncomeTaxPaid / fx;

  // Zero-anchor at career start
  setOrMerge({ age: careerStartAge, contributions: 0, compounded: 0, incomeTax: 0, netTakeHome: 0, netTakeHomeWithBenefits: hasBenefitNetAdd ? 0 : null, netReceived: null, netTakeHomePlusPension: null, dpsCompounded: null, grossReceived: null, pensionTaxPaid: null, netTotalReceived: null, netTakeHomePlusTotalPension: null, netBenefitsPlusPension: null, netBenefitsPlusTotalPension: null });

  for (const snap of timeline) {
    if (snap.phase === 'career') {
      // Shift display age by +1 so the last working year appears at retirementAge
      // yearsCompleted = how many years of benefits accrued at this display point
      const yearsCompleted = snap.age - careerStartAge + 1;
      const cumulBenefitHere = hasBenefitNetAdd ? czNetBenefitMonthly * 12 * yearsCompleted : null;
      setOrMerge({
        age: snap.age + 1,
        contributions: (snap.cumulativePensionContributions ?? 0) / fx,
        compounded:    (snap.cumulativeContributionsCompounded ?? 0) / fx,
        incomeTax:     (snap.cumulativeIncomeTax ?? 0) / fx,
        netTakeHome:   (snap.cumulativeNetTakeHome ?? 0) / fx,
        netTakeHomeWithBenefits: hasBenefitNetAdd
          ? (snap.cumulativeNetTakeHome ?? 0) / fx + cumulBenefitHere!
          : null,
        netReceived:   null,
        netTakeHomePlusPension: null,
        dpsCompounded: hasDps ? (snap.cumulativeDpsCompounded ?? 0) / fx : null,
        grossReceived: null,
        pensionTaxPaid: null,
        netTotalReceived: null,
        netTakeHomePlusTotalPension: null,
        netBenefitsPlusPension: null,
        netBenefitsPlusTotalPension: null,
      });
    } else {
      // Shift by +1: snapshot at age X (pension received during year X) displayed at X+1.
      const grossPensionSoFar = (snap.cumulativePensionReceived ?? 0) / fx;
      const netPensionSoFar   = (snap.netCumulativePensionReceived ?? 0) / fx;
      // Stack pension income tax on top of career income tax so the dashed retirement
      // continuation starts where the flat career line ends.
      const pensionTaxStacked = hasPensionTax
        ? totalIncomeTaxLocal + (grossPensionSoFar - netPensionSoFar)
        : null;
      const yearsRetired  = snap.age - retirementAge + 1;
      const dpsCumulative = hasDps ? dpsMonthlyPension * 12 * yearsRetired : 0;
      const netTotalSoFar = netPensionSoFar + dpsCumulative;
      setOrMerge({
        age: snap.age + 1,
        contributions:  totalPaidIn / fx,
        compounded:     compoundedPeak / fx,
        incomeTax:      totalIncomeTaxLocal,
        netTakeHome:    netTakeHomeLocal,
        netTakeHomeWithBenefits: hasBenefitNetAdd ? totalNetTakeHomeWithBenefits : null,
        netReceived:    netPensionSoFar,
        netTakeHomePlusPension: netTakeHomeLocal + netPensionSoFar,
        dpsCompounded:  hasDps ? dpsPotPeak : null,
        grossReceived:  grossPensionSoFar,
        pensionTaxPaid: pensionTaxStacked,
        netTotalReceived: netTotalSoFar,
        netTakeHomePlusTotalPension: netTakeHomeLocal + netTotalSoFar,
        netBenefitsPlusPension: hasBenefitNetAdd ? totalNetTakeHomeWithBenefits + netPensionSoFar : null,
        netBenefitsPlusTotalPension: hasBenefitNetAdd ? totalNetTakeHomeWithBenefits + netTotalSoFar : null,
      });
    }
  }

  // Anchor the pension received / gross lines to 0 at retirementAge.
  // The career peak is already placed at retirementAge by the shifted career snapshot;
  // grossReceived is null there, so this runs exactly once.
  const retireAnchor = ageMap.get(retirementAge);
  if (retireAnchor && retireAnchor.grossReceived === null) {
    retireAnchor.netReceived  = 0;
    retireAnchor.grossReceived = 0;
    retireAnchor.pensionTaxPaid = hasPensionTax ? totalIncomeTaxLocal : null;
    retireAnchor.netTakeHomePlusPension = netTakeHomeLocal;
    retireAnchor.netTotalReceived = 0;
    retireAnchor.netTakeHomePlusTotalPension = netTakeHomeLocal;
    if (hasBenefitNetAdd) {
      retireAnchor.netBenefitsPlusPension = totalNetTakeHomeWithBenefits;
      retireAnchor.netBenefitsPlusTotalPension = totalNetTakeHomeWithBenefits;
    }
  }

  const data = Array.from(ageMap.values()).sort((a, b) => a.age - b.age);

  const breakEvenAge = fairReturn.breakEvenAge;
  const gainPct = totalPaidIn > 0
    ? Math.round((compoundedPeak / totalPaidIn - 1) * 100)
    : 0;

  const yFmt = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${Math.round(v / 1_000)}k`;
    return String(Math.round(v));
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
        <h3 className="text-xs text-slate-500 uppercase tracking-wide">
          Pension Accumulation &amp; Fair Return
        </h3>
        {/* Line group selector */}
        <div className="flex flex-wrap gap-1">
          {LINE_GROUPS.filter(g => g.id !== 'benefits' || hasBenefitNetAdd).map(g => {
            const on = visible.has(g.id);
            return (
              <button
                key={g.id}
                onClick={() => toggle(g.id)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  on
                    ? 'border-slate-500 text-slate-200 bg-slate-700'
                    : 'border-slate-700 text-slate-600 bg-slate-800/60 line-through'
                }`}
                style={on ? { borderColor: g.color, color: g.color } : {}}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
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
            tickFormatter={yFmt}
            width={40}
          />
          <Tooltip
            content={(props) => (
              <AccumTooltip
                active={props.active}
                payload={props.payload as any[]}
                label={props.label as number | undefined}
                isRetirement={isRetirement}
                fmt={fmt}
              />
            )}
          />

          {/* Retirement age separator */}
          <ReferenceLine
            x={retirementAge}
            stroke="#38bdf8"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{
              value: `Retire ${retirementAge}`,
              position: 'insideTopLeft',
              fontSize: 9,
              fill: '#38bdf8',
            }}
          />

          {/* Break-even marker */}
          {breakEvenAge !== null && (
            <ReferenceLine
              x={breakEvenAge}
              stroke="#34d399"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{
                value: `State pension break-even: age ${breakEvenAge}`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: '#34d399',
              }}
            />
          )}

          {/* ── Accumulation group ── */}
          {show('accumulation') && (
            <Line
              dataKey="contributions"
              name="Pension SSC Paid"
              stroke="#facc15"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {show('accumulation') && (
            <Line
              dataKey="compounded"
              name={`Actuarial-equivalent pot (${(fairReturn.returnRate * 100).toFixed(1)}% real)`}
              stroke="#f800ec"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {show('accumulation') && hasDps && (
            <Line
              dataKey="dpsCompounded"
              name="DPS Pot (3rd Pillar)"
              stroke="#7c3aed"
              strokeWidth={1.5}
              strokeDasharray="6 2"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {/* ── Taxes group ── */}
          {show('taxes') && (
            <Line
              dataKey="incomeTax"
              name="Income Tax Paid (career)"
              stroke="#f87171"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {show('taxes') && hasPensionTax && (
            <Line
              dataKey="pensionTaxPaid"
              name="Income Tax incl. Pension Tax"
              stroke="#f87171"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {/* ── Take-Home group ──
               When +Benefits is active, show the combined take-home+benefits line
               (solid light green) instead of the base take-home line.
               Dotted retirement lines switch to the benefits-baseline variant too. */}
          {show('takeHome') && (!hasBenefitNetAdd || !show('benefits')) && (
            <Line
              dataKey="netTakeHome"
              name="Net Take-Home"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {show('takeHome') && hasBenefitNetAdd && show('benefits') && (
            <Line
              dataKey="netTakeHomeWithBenefits"
              name="Take-Home + Benefits"
              stroke="#86efac"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          )}
          {/* Dotted post-retirement lines: benefits variant when benefits is on */}
          {show('statePension') && show('takeHome') && hasBenefitNetAdd && show('benefits') && (
            <Line
              dataKey="netBenefitsPlusPension"
              name="(Benefits) + Net State Pension"
              stroke="#86efac"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {show('combined') && show('takeHome') && hasBenefitNetAdd && show('benefits') && (
            <Line
              dataKey="netBenefitsPlusTotalPension"
              name="(Benefits) + Net State + DPS"
              stroke="#a78bfa"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {/* ── State pension group ── */}
          {show('statePension') && hasPensionTax && (
            <Line
              dataKey="grossReceived"
              name="Gross State Pension"
              stroke="#f472b6"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {show('statePension') && (
            <Line
              dataKey="netReceived"
              name={hasPensionTax ? 'Net State Pension (after tax)' : 'State Pension'}
              stroke="#4ade80"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {/* Dotted post-retirement: base take-home variant (only when benefits is off) */}
          {show('statePension') && show('takeHome') && !(hasBenefitNetAdd && show('benefits')) && (
            <Line
              dataKey="netTakeHomePlusPension"
              name="Take-Home + Net State Pension"
              stroke="#86efac"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {/* ── Combined State + DPS group ── */}
          {show('combined') && (
            <Line
              dataKey="netTotalReceived"
              name="State + DPS (cumulative)"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          {show('combined') && show('takeHome') && !(hasBenefitNetAdd && show('benefits')) && (
            <Line
              dataKey="netTakeHomePlusTotalPension"
              name="Take-Home + Net State + DPS"
              stroke="#a78bfa"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* ── Summary stat row ── */}
      {/* Row 1: career cash-flow stats */}
      <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-900/40 rounded-lg p-2 text-center">
          <p className="text-green-400 font-mono font-semibold">{fmt(totalNetTakeHome / fx)}</p>
          <p className="text-slate-500 mt-0.5 leading-tight">Net take-home</p>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-2 text-center">
          <p className="text-rose-400 font-mono font-semibold">{fmt(totalAllTaxesAndSSC / fx)}</p>
          <p className="text-slate-500 mt-0.5 leading-tight">
            {isOSVC ? 'All taxes & SSC self-paid' : 'All taxes & SSC incl. employer'}
          </p>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-2 text-center">
          <p className="text-yellow-400 font-mono font-semibold">{fmt(totalPaidIn / fx)}</p>
          <p className="text-slate-500 mt-0.5 leading-tight">Pension SSC paid</p>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-2 text-center">
          <p className="text-red-400 font-mono font-semibold">{fmt(totalIncomeTaxPaid / fx)}</p>
          <p className="text-slate-500 mt-0.5 leading-tight">Income tax paid</p>
        </div>
      </div>

      {/* Row 2: pension return comparison — clearly separated */}
      <div className="mt-1.5 rounded-lg border border-slate-700/60 bg-slate-900/20 p-2">
        <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1.5 px-0.5">Pension return comparison — same SSC contributions</p>
        <div className={`grid gap-2 text-xs ${hasDps ? 'grid-cols-4' : 'grid-cols-3'}`}>

          {/* Compounded pot — violet, matching the dashed violet line */}
          <div className="bg-violet-950/30 border border-violet-700/40 rounded-lg p-2 text-center">
            <p className="text-violet-400 font-mono font-semibold">{fmt(compoundedPeak / fx)}</p>
            <p className="text-slate-500 mt-0.5 leading-tight">Actuarial-equivalent pot</p>
            <p className="text-[10px] text-slate-600 leading-tight">+{gainPct}% on SSC paid · {(fairReturn.returnRate * 100).toFixed(1)}% real (see note ↓)</p>
          </div>

          {/* Fair return annuity — violet, clearly distinguishable */}
          <div className="bg-violet-950/30 border border-violet-600/50 rounded-lg p-2 text-center">
            <p className="text-violet-300 font-mono font-semibold">
              {fmt(fairReturn.monthlyAnnuity / fx)}
              <span className="text-xs font-normal text-slate-500">/mo</span>
            </p>
            <p className="text-slate-400 mt-0.5 leading-tight font-medium">Actuarial-equivalent annuity</p>
            <p className="text-[10px] text-slate-600 leading-tight">If SSC invested at {(fairReturn.returnRate * 100).toFixed(1)}% real net-of-fees</p>
          </div>

          {/* Actual state pension — green, matching the net pension received line */}
          <div className="bg-emerald-950/30 border border-emerald-700/50 rounded-lg p-2 text-center">
            <p className="text-emerald-300 font-mono font-semibold">
              {fmt(netMonthlyStatePension / fx)}
              <span className="text-xs font-normal text-slate-500">/mo</span>
            </p>
            <p className="text-slate-400 mt-0.5 leading-tight font-medium">State pension (net)</p>
            <p className="text-[10px] leading-tight">
              {breakEvenAge !== null
                ? <span className="text-amber-400">Break-even age {breakEvenAge}</span>
                : <span className="text-slate-600">No break-even within lifespan</span>
              }
            </p>
          </div>

          {/* DPS — only when active */}
          {hasDps && (
            <div className="bg-violet-950/30 border border-violet-700/40 rounded-lg p-2 text-center">
              <p className="text-violet-200 font-mono font-semibold">
                {fmt(dpsMonthlyPension)}
                <span className="text-xs font-normal text-slate-500">/mo</span>
              </p>
              <p className="text-slate-400 mt-0.5 leading-tight font-medium">DPS 3rd pillar</p>
              <p className="text-[10px] text-slate-600 leading-tight">pot: {fmt(dpsPotPeak)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Comparison caveat ── */}
      <p className="mt-2 text-[10px] text-slate-600 leading-snug px-0.5">
        <span className="text-slate-500 font-medium">Note on actuarial-equivalent comparison: </span>
        The funded-equivalent column shows what you <em>could</em> accumulate if pension SSC were invested at {(fairReturn.returnRate * 100).toFixed(1)}&nbsp;% real net-of-fees (adjust via Career Assumptions ▲).
        PAYG systems provide value this comparison does not capture: redistribution to low earners, longevity pooling, survivor benefits, and credits for non-contributory periods (parental leave, unemployment, etc.).
        A gap between the state pension and the actuarial-equivalent estimate reflects the cost of those social-insurance features, not only system inefficiency.
      </p>

    </div>
  );
}

// ─── Pie chart sub-component ─────────────────────────────────────────────────

const ER_PENSION_COLORS  = ['#ccab65', '#d8974d', '#e9b45a', '#fce4a7'];
const ER_OTHER_COLORS    = ['#6b7280', '#9ca3af', '#cbd5e1', '#475569', '#94a3b8'];
const EE_PENSION_COLORS  = ['#facc15', '#fde047', '#fef08a'];
const EE_OTHER_COLORS    = ['#f97316', '#fb923c', '#fdba74', '#fed7aa'];

export function WagePieChart({
  result,
  currency,
  countryCurrency,
  eurExchangeRate,
}: {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
}) {
  const { sscResult, taxResult } = result;
  const fx = currency === 'EUR' ? eurExchangeRate : 1;
  const sym = currency === 'EUR' ? '€' : '';
  const sfx = currency === 'EUR' ? '' : ` ${countryCurrency}`;
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString()}${sfx}`;

  const grossMonthly = taxResult.grossMonthly;
  const netCashPay = Math.max(0, grossMonthly - taxResult.incomeTaxMonthly - sscResult.employeeTotal);

  // CZ benefits
  const czBr = result.czBenefitResult;
  const netBenefitAmount = (czBr?.totalNetAdd ?? 0);       // fringe + meal → employee net
  const dpsAmount        = (czBr?.pensionContribMonthly ?? 0); // DPS → locked

  // OSVČ/PD: no employer SSC, total cost = gross
  const isOSVC = sscResult.employerTotal === 0 && sscResult.totalEmployerCost === grossMonthly;

  type PieSlice = { name: string; value: number; fill: string };
  const slices: PieSlice[] = [];

  // Employer SSC components (pension = yellowish, other = gray)
  let erPIdx = 0, erOIdx = 0;
  for (const comp of sscResult.components) {
    if (comp.employerAmount > 0) {
      const fill = comp.fundsPension
        ? ER_PENSION_COLORS[erPIdx++ % ER_PENSION_COLORS.length]
        : ER_OTHER_COLORS[erOIdx++ % ER_OTHER_COLORS.length];
      slices.push({ name: `ER: ${comp.label}`, value: comp.employerAmount / fx, fill });
    }
  }

  // CZ benefit slices — shown ADJACENT to employer SSC (they are employer costs, just tax-exempt)
  // Placed here before EE slices so the donut visually groups all employer costs together.
  if (!isOSVC) {
    if (netBenefitAmount > 0) {
      slices.push({ name: 'Fringe/Meal Benefits', value: netBenefitAmount / fx, fill: '#38bdf8' });
    }
    if (dpsAmount > 0) {
      slices.push({ name: 'DPS Contribution', value: dpsAmount / fx, fill: '#7c3aed' });
    }
  }

  // Employee SSC components (pension = yellow, other = orange)
  let eePIdx = 0, eeOIdx = 0;
  for (const comp of sscResult.components) {
    if (comp.employeeAmount > 0) {
      const fill = comp.fundsPension
        ? EE_PENSION_COLORS[eePIdx++ % EE_PENSION_COLORS.length]
        : EE_OTHER_COLORS[eeOIdx++ % EE_OTHER_COLORS.length];
      slices.push({ name: `EE: ${comp.label}`, value: comp.employeeAmount / fx, fill });
    }
  }

  // Income tax
  if (taxResult.incomeTaxMonthly > 0) {
    slices.push({ name: 'Income Tax', value: taxResult.incomeTaxMonthly / fx, fill: '#ef4444' });
  }

  // Net cash pay — divide by fx like all other slices
  slices.push({ name: 'Net Pay (Cash)', value: netCashPay / fx, fill: '#22c55e' });

  const total = slices.reduce((s, d) => s + d.value, 0);

  // Legend rows
  const erPension = slices.filter(s => s.name.startsWith('ER:') && sscResult.components.find(c => `ER: ${c.label}` === s.name)?.fundsPension);
  const erOther   = slices.filter(s => s.name.startsWith('ER:') && !sscResult.components.find(c => `ER: ${c.label}` === s.name)?.fundsPension);
  const eePension = slices.filter(s => s.name.startsWith('EE:') && sscResult.components.find(c => `EE: ${c.label}` === s.name)?.fundsPension);
  const eeOther   = slices.filter(s => s.name.startsWith('EE:') && !sscResult.components.find(c => `EE: ${c.label}` === s.name)?.fundsPension);
  const itSlice   = slices.find(s => s.name === 'Income Tax');
  const npSlice   = slices.find(s => s.name === 'Net Pay (Cash)');
  const benefitSlice = slices.find(s => s.name === 'Fringe/Meal Benefits');
  const dpsSlice     = slices.find(s => s.name === 'DPS Contribution');

  const pct = (v: number) => total > 0 ? `${Math.round(v / total * 100)}%` : '—';

  // Outer bracket ring: employer overhead + gross
  const erTotalDisplay = slices.filter(s => s.name.startsWith('ER:') || s.name === 'Fringe/Meal Benefits' || s.name === 'DPS Contribution')
    .reduce((s, d) => s + d.value, 0);
  const grossDisplay   = total - erTotalDisplay;
  const bracketData = [
    { name: 'Employer Cost\n(on top of gross)', value: erTotalDisplay },
    { name: 'Gross', value: grossDisplay },
  ];

  // Custom label for the bracket ring — placed along the arc midpoint
  const RADIAN = Math.PI / 180;
  const renderBracketLabel = ({
    cx, cy, midAngle, outerRadius, name, value,
  }: { cx: number; cy: number; midAngle: number; outerRadius: number; name: string; value: number }) => {
    if (value === 0) return null;
    const isEmployer = name.startsWith('Employer');
    const r = outerRadius + 14;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x} y={y}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={8}
        fill={isEmployer ? '#94a3b8' : '#64748b'}
        fontWeight={600}
      >
        {isEmployer ? 'ER cost' : 'Gross'}
      </text>
    );
  };

  return (
    <div className="mt-4">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
        {isOSVC ? 'Monthly Profit Breakdown (self-paid)' : 'Monthly Wage Breakdown (total employer cost)'}
      </h3>
      <div className="flex gap-4 items-start">
        {/* Pie */}
        <div className="shrink-0">
          <PieChart width={200} height={200}>
            {/* Inner donut — detailed breakdown */}
            <Pie
              data={slices}
              dataKey="value"
              cx={100}
              cy={100}
              innerRadius={36}
              outerRadius={68}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0.5}
              stroke="#1e293b"
              isAnimationActive={false}
            >
              {slices.map((s, i) => (
                <Cell key={i} fill={s.fill} />
              ))}
            </Pie>

            {/* Outer bracket ring — employer top-up vs gross */}
            <Pie
              data={bracketData}
              dataKey="value"
              cx={100}
              cy={100}
              innerRadius={72}
              outerRadius={77}
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
              isAnimationActive={false}
              label={renderBracketLabel}
              labelLine={false}
            >
              {/* Employer top-up: dashed-effect via a slightly transparent fill + white-dashed inner edge */}
              <Cell fill="rgba(148,163,184,0.18)" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
              {/* Gross: solid subtle fill */}
              <Cell fill="rgba(100,116,139,0.10)" stroke="#475569" strokeWidth={1} />
            </Pie>

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as PieSlice;
                return (
                  <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-2 py-1.5 text-xs shadow-xl">
                    <p style={{ color: d.fill ?? '#94a3b8' }} className="font-semibold mb-0.5">{d.name}</p>
                    <p className="text-slate-100 font-mono">{fmt(d.value)}</p>
                    <p className="text-slate-400">{pct(d.value)}</p>
                  </div>
                );
              }}
            />
          </PieChart>
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-y-1 text-xs self-center">
          {/* Employer top-up group — hidden in OSVČ/PD mode (erTotalDisplay === 0, section is meaningless) */}
          {!isOSVC && (
            <>
              <div className="text-slate-500 uppercase tracking-wide text-[10px] pb-0.5 border-b border-dashed border-slate-700">
                Employer Cost (on top of gross) — {pct(erTotalDisplay)}
              </div>
              {[...erOther, ...erPension].map((s) => {
                const isPension = erPension.includes(s);
                return (
                  <div key={s.name} className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.fill }} />
                    <span className={isPension ? 'text-amber-300 truncate' : 'text-slate-400 truncate'}>
                      {s.name.replace('ER: ', '')}{isPension ? ' ★' : ''}
                    </span>
                    <span className="ml-auto font-mono text-slate-300 pl-1">{pct(s.value)}</span>
                  </div>
                );
              })}
              {/* Benefits are employer costs — tax-exempt but real outflows */}
              {benefitSlice && (
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: benefitSlice.fill }} />
                  <span className="text-sky-300 truncate">Fringe/Meal Benefits <span className="text-[10px] text-sky-600">tax-exempt</span></span>
                  <span className="ml-auto font-mono text-slate-300 pl-1">{pct(benefitSlice.value)}</span>
                </div>
              )}
              {dpsSlice && (
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: dpsSlice.fill }} />
                  <span className="text-violet-400 truncate">DPS Contribution <span className="text-[10px] text-violet-600">tax-exempt</span></span>
                  <span className="ml-auto font-mono text-slate-300 pl-1">{pct(dpsSlice.value)}</span>
                </div>
              )}
            </>
          )}

          {/* Gross / Profit group */}
          <div className="text-slate-500 uppercase tracking-wide text-[10px] pb-0.5 border-b border-slate-700 mt-1">
            {isOSVC ? 'Profit' : 'Gross'} — {pct(grossDisplay)}
          </div>
          {[...eeOther, ...eePension].map((s) => {
            const isPension = eePension.includes(s);
            return (
              <div key={s.name} className="flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.fill }} />
                <span className={isPension ? 'text-yellow-300 truncate' : 'text-orange-300 truncate'}>
                  {s.name.replace('EE: ', '')}{isPension ? ' ★' : ''}
                </span>
                <span className="ml-auto font-mono text-slate-300 pl-1">{pct(s.value)}</span>
              </div>
            );
          })}
          {itSlice && (
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: itSlice.fill }} />
              <span className="text-red-400 truncate">Income Tax</span>
              <span className="ml-auto font-mono text-slate-300 pl-1">{pct(itSlice.value)}</span>
            </div>
          )}
          {npSlice && (
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: npSlice.fill }} />
              <span className="text-green-400 truncate">Net Pay (Cash)</span>
              <span className="ml-auto font-mono text-slate-300 pl-1">{pct(npSlice.value)}</span>
            </div>
          )}
          <div className="mt-1 text-slate-600 text-[10px]">
            {isOSVC ? 'Monthly profit' : 'Total cost'}: {fmt(total)} /mo · ★ pension-funded
          </div>
        </div>
      </div>
    </div>
  );
}
