/**
 * Graph 1 — Monthly Wage & Pension Snapshot
 * Two horizontal stacked bars showing the current monthly breakdown:
 *   Row 1: Total Employer Cost split into components
 *   Row 2: Pension comparison — state pension vs fair-return annuity (same scale)
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  ReferenceLine,
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

function SnapshotTooltip({
  active,
  payload,
  fmt,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  fmt: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter(e => e.value && Math.abs(e.value) > 0.01);
  if (!visible.length) return null;
  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      {visible.map((e, i) => (
        <div key={i} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: e.fill ?? e.color }}>{e.name}</span>
          <span className="text-slate-100 font-mono">{fmt(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { color: '#22c55e', label: 'Net Pay' },
  { color: '#facc15', label: 'Ee Pension SSC' },
  { color: '#fb923c', label: 'Ee Other SSC' },
  { color: '#f87171', label: 'Income Tax' },
  { color: '#94a3b8', label: 'Er Pension SSC' },
  { color: '#cbd5e1', label: 'Er Other SSC' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function Graph1_CareerTimeline({
  result,
  currency,
  countryCurrency,
  eurExchangeRate,
}: Props) {
  const { sscResult, taxResult, pensionResult, fairReturn } = result;
  const gross = result.resolvedWage.grossLocal;
  const fx  = currency === 'EUR' ? eurExchangeRate : 1;
  const sym = currency === 'EUR' ? '€' : '';
  const sfx = currency === 'EUR' ? '' : ` ${countryCurrency}`;
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString()}${sfx}`;

  const netPay    = (gross - taxResult.incomeTaxMonthly - sscResult.employeeTotal) / fx;
  const eePension = sscResult.employeePensionPortion / fx;
  const eeOther   = Math.max(0, sscResult.employeeTotal - sscResult.employeePensionPortion) / fx;
  const tax       = taxResult.incomeTaxMonthly / fx;
  const erPension = sscResult.employerPensionPortion / fx;
  const erOther   = Math.max(0, sscResult.employerTotal - sscResult.employerPensionPortion) / fx;

  const hasP2   = (pensionResult.pillar2Monthly ?? 0) > 0;
  const p1       = pensionResult.pillar1Monthly / fx;
  const p2       = hasP2 ? (pensionResult.pillar2Monthly ?? 0) / fx : 0;
  const total    = pensionResult.monthlyPension / fx;
  const fair     = fairReturn.monthlyAnnuity / fx;
  const pTax     = (pensionResult.pensionIncomeTax ?? 0) / fx;
  const netTotal = total - pTax;   // what the retiree actually keeps monthly

  // Shared x-axis domain: employer cost is always the widest bar
  const xMax = sscResult.totalEmployerCost / fx;

  // All rows in one dataset — unused keys are 0 so stacks don't appear
  const data = [
    {
      name: 'Employer Cost',
      netPay, eePension, eeOther, tax, erPension, erOther,
      p1: 0, p2: 0, pTax: 0, fair: 0,
    },
    {
      name: 'State Pension',
      netPay: 0, eePension: 0, eeOther: 0, tax: 0, erPension: 0, erOther: 0,
      p1, p2: hasP2 ? p2 : 0, pTax, fair: 0,
    },
    {
      name: 'Fair Return',
      netPay: 0, eePension: 0, eeOther: 0, tax: 0, erPension: 0, erOther: 0,
      p1: 0, p2: 0, pTax: 0, fair,
    },
  ];

  // Height: 3 rows × ~34px each + padding
  const chartHeight = 3 * 36 + 8;

  return (
    <div className="mt-4">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">
        Monthly Snapshot
      </h3>

      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 48, bottom: 0, left: 80 }}
          barSize={22}
          barGap={0}
        >
          <XAxis type="number" hide domain={[0, xMax * 1.01]} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickLine={false}
            width={76}
          />
          <Tooltip
            content={(props) => (
              <SnapshotTooltip active={props.active} payload={props.payload as any[]} fmt={v => fmt(v)} />
            )}
            cursor={{ fill: '#1e293b' }}
          />

          {/* ── Gross wage reference line ── */}
          <ReferenceLine
            x={gross / fx}
            stroke="#f87171"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value: `Gross ${fmt(gross / fx)}`,
              position: 'insideTopRight',
              fontSize: 9,
              fill: '#f87171',
              dy: -4,
            }}
          />

          {/* ── Net take-home reference line ── */}
          <ReferenceLine
            x={netPay}
            stroke="#22c55e"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            label={{
              value: `Net ${fmt(netPay)}`,
              position: 'insideTopLeft',
              fontSize: 9,
              fill: '#22c55e',
              dy: -4,
            }}
          />

          {/* ── Employer cost segments ── */}
          <Bar dataKey="netPay"    stackId="s" fill="#22c55e" name="Net Pay"        isAnimationActive={false} />
          <Bar dataKey="eePension" stackId="s" fill="#facc15" name="Ee Pension SSC" isAnimationActive={false} />
          <Bar dataKey="eeOther"   stackId="s" fill="#fb923c" name="Ee Other SSC"   isAnimationActive={false} />
          <Bar dataKey="tax"       stackId="s" fill="#f87171" name="Income Tax"     isAnimationActive={false} />
          <Bar dataKey="erPension" stackId="s" fill="#94a3b8" name="Er Pension SSC" isAnimationActive={false} />
          <Bar dataKey="erOther"   stackId="s" fill="#cbd5e1" name="Er Other SSC"   isAnimationActive={false} radius={[0, 2, 2, 0]}>
            <LabelList
              valueAccessor={(_: unknown, index: number) =>
                index === 0 ? fmt(sscResult.totalEmployerCost / fx) : ''
              }
              position="right"
              style={{ fill: '#64748b', fontSize: 10 }}
            />
          </Bar>

          {/* ── Pension pillar segments ── */}
          <Bar dataKey="p1" stackId="s" fill="#38bdf8" name={hasP2 ? 'Pillar 1' : 'State Pension'} isAnimationActive={false} radius={hasP2 || pTax > 0 ? [0,0,0,0] : [0,2,2,0]}>
            {!hasP2 && pTax === 0 && (
              <LabelList
                valueAccessor={(_: unknown, index: number) =>
                  index === 1 ? fmt(p1) : ''
                }
                position="right"
                style={{ fill: '#64748b', fontSize: 10 }}
              />
            )}
          </Bar>
          {hasP2 && (
            <Bar dataKey="p2" stackId="s" fill="#fb923c" name="Pillar 2 DC" isAnimationActive={false} radius={pTax > 0 ? [0,0,0,0] : [0,2,2,0]}>
              {pTax === 0 && (
                <LabelList
                  valueAccessor={(_: unknown, index: number) =>
                    index === 1 ? fmt(total) : ''
                  }
                  position="right"
                  style={{ fill: '#64748b', fontSize: 10 }}
                />
              )}
            </Bar>
          )}

          {/* ── Pension income tax segment (only for countries that tax pension income) ── */}
          {pTax > 0 && (
            <Bar dataKey="pTax" stackId="s" fill="#dc2626" name="Pension Tax" isAnimationActive={false} radius={[0,2,2,0]}>
              <LabelList
                valueAccessor={(_: unknown, index: number) =>
                  index === 1 ? `Net ${fmt(netTotal)}` : ''
                }
                position="right"
                style={{ fill: '#64748b', fontSize: 10 }}
              />
            </Bar>
          )}

          {/* ── Fair return segment ── */}
          <Bar dataKey="fair" stackId="s" fill="#a78bfa" name="Fair Return" isAnimationActive={false} radius={[0,2,2,0]}>
            <LabelList
              valueAccessor={(_: unknown, index: number) =>
                index === 2 ? fmt(fair) : ''
              }
              position="right"
              style={{ fill: '#64748b', fontSize: 10 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1 text-xs text-slate-500">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color }} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#38bdf8' }} />
          {hasP2 ? 'Pillar 1' : 'State Pension'}
        </span>
        {hasP2 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#fb923c' }} />
            Pillar 2 DC
          </span>
        )}
        {pTax > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dc2626' }} />
            Pension Tax
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#a78bfa' }} />
          Fair Return
        </span>
      </div>
    </div>
  );
}
