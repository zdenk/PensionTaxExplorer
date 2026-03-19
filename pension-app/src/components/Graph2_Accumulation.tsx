/**
 * Graph 2 — Pension Accumulation & Fair Return
 * Two-phase line chart per §6 spec:
 *   Career: cumulative raw contributions + compounded equivalent rise together
 *   Retirement: cumulative pension received climbs toward break-even line
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ScenarioResult } from '../types';

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
  const { timeline, fairReturn, sscResult } = result;
  const fx = currency === 'EUR' ? eurExchangeRate : 1;
  const sym = currency === 'EUR' ? '€' : '';
  const sfx = currency === 'EUR' ? '' : ` ${countryCurrency}`;
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString()}${sfx}`;

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
    received: number | null;
    netReceived: number | null;
    netTakeHomePlusPension: number | null;
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
    if (p.received    !== null) ex.received    = p.received;
    if (p.netReceived !== null) ex.netReceived = p.netReceived;
    if (p.netTakeHomePlusPension !== null) ex.netTakeHomePlusPension = p.netTakeHomePlusPension;
  };

  // Zero-anchor at career start
  setOrMerge({ age: careerStartAge, contributions: 0, compounded: 0, incomeTax: 0, netTakeHome: 0, received: null, netReceived: null, netTakeHomePlusPension: null });

  for (const snap of timeline) {
    if (snap.phase === 'career') {
      // Shift display age by +1 so the last working year appears at retirementAge
      setOrMerge({
        age: snap.age + 1,
        contributions: (snap.cumulativePensionContributions ?? 0) / fx,
        compounded:    (snap.cumulativeContributionsCompounded ?? 0) / fx,
        incomeTax:     (snap.cumulativeIncomeTax ?? 0) / fx,
        netTakeHome:   (snap.cumulativeNetTakeHome ?? 0) / fx,
        received:      null,
        netReceived:   null,
        netTakeHomePlusPension: null,
      });
    } else {
      // Shift by +1 as well: snapshot at age X (= pension received during year X)
      // is displayed at X+1. This means the first retirement year shows at retirementAge+1.
      const netPensionSoFar = (snap.netCumulativePensionReceived ?? 0) / fx;
      setOrMerge({
        age: snap.age + 1,
        contributions: totalPaidIn / fx,
        compounded:    compoundedPeak / fx,
        incomeTax:     totalIncomeTaxPaid / fx,
        netTakeHome:   totalNetTakeHome / fx,
        received:      (snap.cumulativePensionReceived ?? 0) / fx,
        netReceived:   netPensionSoFar,
        netTakeHomePlusPension: totalNetTakeHome / fx + netPensionSoFar,
      });
    }
  }

  // Anchor the pension received line to 0 at retirementAge.
  // The career peak is already placed there by the shifted career snapshot;
  // we add received=0 so the line visually starts from zero at that age.
  const retireAnchor = ageMap.get(retirementAge);
  if (retireAnchor && retireAnchor.received === null) {
    retireAnchor.received = 0;
    retireAnchor.netReceived = 0;
    retireAnchor.netTakeHomePlusPension = totalNetTakeHome / fx;
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
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
        Pension Accumulation &amp; Fair Return
      </h3>

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
              stroke="#22c55e"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{
                value: `Break-even ${breakEvenAge}`,
                position: 'insideTopRight',
                fontSize: 9,
                fill: '#22c55e',
              }}
            />
          )}

          {/* Total paid in — yellow, flat during retirement */}
          <Line
            dataKey="contributions"
            name="Pension SSC Paid"
            stroke="#facc15"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Cumulative income tax — red, flat during retirement */}
          <Line
            dataKey="incomeTax"
            name="Income Tax Paid"
            stroke="#f87171"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Cumulative net take-home — green, flat during retirement */}
          <Line
            dataKey="netTakeHome"
            name="Net Take-Home"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Compounded value — violet dashed, flat during retirement */}
          <Line
            dataKey="compounded"
            name="Compounded Value"
            stroke="#a78bfa"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />

          {/* Cumulative gross pension received — dashed, retirement only */}
          <Line
            dataKey="received"
            name="Gross Pension Rcvd"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Cumulative net pension received after pension income tax — solid bright green */}
          <Line
            dataKey="netReceived"
            name="Net Pension Rcvd"
            stroke="#4ade80"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />

          {/* Net pension received stacked on top of career net take-home — dotted, starts at take-home level */}
          <Line
            dataKey="netTakeHomePlusPension"
            name="Take-Home + Net Pension"
            stroke="#86efac"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* ── Summary stat row ── */}
      <div className="mt-2 grid grid-cols-6 gap-2 text-xs">
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
        <div className="bg-slate-900/40 rounded-lg p-2 text-center">
          <p className="text-violet-400 font-mono font-semibold">{fmt(compoundedPeak / fx)}</p>
          <p className="text-slate-500 mt-0.5 leading-tight">Real compounded (+{gainPct}%)</p>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-2 text-center">
          <p className="text-sky-400 font-mono font-semibold">
            {fmt(fairReturn.monthlyAnnuity / fx)}
            <span className="text-xs font-normal text-slate-500">/mo</span>
          </p>
          <p className="text-slate-500 mt-0.5 leading-tight">
            {breakEvenAge !== null ? `Break-even age ${breakEvenAge}` : 'Fair return annuity'}
          </p>
        </div>
      </div>

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
  const netPay = Math.max(0, grossMonthly - taxResult.incomeTaxMonthly - sscResult.employeeTotal);
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

  // Net pay — divide by fx like all other slices
  slices.push({ name: 'Net Pay', value: netPay / fx, fill: '#22c55e' });

  const total = slices.reduce((s, d) => s + d.value, 0);

  // Legend rows
  const erPension = slices.filter(s => s.name.startsWith('ER:') && sscResult.components.find(c => `ER: ${c.label}` === s.name)?.fundsPension);
  const erOther   = slices.filter(s => s.name.startsWith('ER:') && !sscResult.components.find(c => `ER: ${c.label}` === s.name)?.fundsPension);
  const eePension = slices.filter(s => s.name.startsWith('EE:') && sscResult.components.find(c => `EE: ${c.label}` === s.name)?.fundsPension);
  const eeOther   = slices.filter(s => s.name.startsWith('EE:') && !sscResult.components.find(c => `EE: ${c.label}` === s.name)?.fundsPension);
  const itSlice   = slices.find(s => s.name === 'Income Tax');
  const npSlice   = slices.find(s => s.name === 'Net Pay');

  const pct = (v: number) => total > 0 ? `${Math.round(v / total * 100)}%` : '—';

  // Outer bracket ring: two segments — employer top-up vs gross
  const erTotalDisplay = slices.filter(s => s.name.startsWith('ER:')).reduce((s, d) => s + d.value, 0);
  const grossDisplay   = total - erTotalDisplay;
  const bracketData = [
    { name: 'Employer SSC\n(on top of gross)', value: erTotalDisplay },
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
        {isEmployer ? 'ER top-up' : 'Gross'}
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
                Employer SSC — on top of gross ({pct(erTotalDisplay)})
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
              <span className="text-green-400 truncate">Net Pay</span>
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
