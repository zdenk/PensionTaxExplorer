/**
 * WageBreakdownTable — full wage waterfall (§5 spec)
 *
 * Stack (top = total employer cost, to bottom = net take-home):
 *   Total Employer Cost        ← primary anchor, bold
 *   ─ Employer SSC components  ← grey (invisible overhead)
 *   ══ GROSS WAGE boundary ══  ← dashed separator
 *   ─ Employee SSC components  ← yellow / amber
 *   ─ Income Tax               ← red
 *   Net Take-Home              ← green, bold
 */

import type { ScenarioResult } from '../types';
import { displayAmount, formatPct } from '../utils/formatCurrency';

interface Props {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
}

interface Row {
  label: string;
  amount: number;
  pctOfGross?: number;
  style: 'primary' | 'separator' | 'er-ssc' | 'ee-ssc' | 'tax' | 'net' | 'sub';
  indent?: boolean;
}

function buildRows(result: ScenarioResult, isOSVC: boolean, isPausalniDan: boolean): Row[] {
  const gross = result.resolvedWage.grossLocal;
  const { sscResult, taxResult } = result;
  const netTakeHome = gross - taxResult.incomeTaxMonthly - sscResult.employeeTotal;

  const rows: Row[] = [];

  // ─── Total employer cost (or Monthly Profit for OSVČ) ──────────────────────
  rows.push({
    label: isOSVC ? 'Monthly Profit' : 'Total Employer Cost',
    amount: sscResult.totalEmployerCost,
    pctOfGross: gross > 0 ? sscResult.totalEmployerCost / gross : 0,
    style: 'primary',
  });

  // ─── Employer SSC per component (hidden in OSVČ mode — employerAmount = 0) ──
  for (const comp of sscResult.components.filter(c => c.employerAmount > 0)) {
    rows.push({
      label: `  Er: ${comp.label}`,
      amount: comp.employerAmount,
      pctOfGross: gross > 0 ? comp.employerAmount / gross : 0,
      style: 'er-ssc',
      indent: true,
    });
  }

  // ─── Gross wage boundary ─────────────────────────────────────────────────
  rows.push({
    label: isOSVC ? '── Profit Before SSC & Tax ──' : '── Contract Gross Salary ──',
    amount: gross,
    style: 'separator',
  });

  // ─── Employee SSC per component (= all SSC in OSVČ mode) ─────────────────
  for (const comp of sscResult.components.filter(c => c.employeeAmount > 0)) {
    rows.push({
      label: `  ${isOSVC ? '' : 'Ee: '}${comp.label}`,
      amount: comp.employeeAmount,
      pctOfGross: gross > 0 ? comp.employeeAmount / gross : 0,
      style: 'ee-ssc',
      indent: true,
    });
  }

  // ─── Income tax ──────────────────────────────────────────────────────────
  rows.push({
    label: isPausalniDan ? 'Income Tax Advance (Paús. daň)' : 'Income Tax (PIT)',
    amount: taxResult.incomeTaxMonthly,
    pctOfGross: gross > 0 ? taxResult.incomeTaxMonthly / gross : 0,
    style: 'tax',
  });

  // ─── Net take-home ───────────────────────────────────────────────────────
  rows.push({
    label: 'Net Take-Home',
    amount: netTakeHome,
    pctOfGross: gross > 0 ? netTakeHome / gross : 0,
    style: 'net',
  });

  return rows;
}

const STYLE_CLASSES: Record<Row['style'], { row: string; amount: string }> = {
  primary:    { row: 'bg-slate-700 font-semibold border-b border-slate-500', amount: 'text-slate-100' },
  separator:  { row: 'bg-slate-900/80 border-y border-dashed border-slate-500 text-center', amount: 'text-slate-300 font-mono' },
  'er-ssc':   { row: 'bg-slate-800/40', amount: 'text-slate-400' },
  'ee-ssc':   { row: 'bg-slate-800/40', amount: 'text-yellow-400' },
  tax:        { row: 'bg-slate-800/40', amount: 'text-red-400' },
  net:        { row: 'bg-green-950/40 font-semibold border-t border-green-800', amount: 'text-green-400' },
  sub:        { row: 'bg-slate-800/20', amount: 'text-slate-400' },
};

function styleClasses(s: Row['style']): { row: string; amount: string } {
  return STYLE_CLASSES[s] ?? STYLE_CLASSES.sub;
}

export function WageBreakdownTable({ result, currency, countryCurrency, eurExchangeRate }: Props) {
  // Detect OSVČ mode heuristic: no employer SSC and totalEmployerCost === gross
  const isOSVC = result.sscResult.employerTotal === 0 &&
    result.sscResult.totalEmployerCost === result.resolvedWage.grossLocal;
  // Detect paušální daň mode from the tax bracket description (set in computeScenario.ts)
  const isPausalniDan = isOSVC &&
    result.taxResult.bracketBreakdown.some(b => b.bracket.startsWith('Pau'));
  const rows = buildRows(result, isOSVC, isPausalniDan);
  const gross = result.resolvedWage.grossLocal;
  const da = (n: number) => displayAmount(n, countryCurrency, currency, eurExchangeRate);

  return (
    <div className="mt-3">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">Wage Breakdown</h3>
      <table className="w-full text-sm border-collapse rounded-lg overflow-hidden">
        <tbody>
          {rows.map((row, i) => {
            const sc = styleClasses(row.style);
            const isSeparator = row.style === 'separator';

            return (
              <tr key={i} className={`${sc.row} transition-colors`}>
                <td className={`px-3 py-2 text-slate-300 ${row.indent ? 'pl-6' : ''} ${isSeparator ? 'text-center text-slate-400 italic text-xs' : ''}`}>
                  {isSeparator ? row.label : row.label.replace(/^\s+/, '')}
                </td>
                <td className={`px-3 py-2 text-right font-mono ${sc.amount}`}>
                  {isSeparator
                    ? da(row.amount)
                    : da(row.amount)
                  }
                </td>
                <td className="px-2 py-2 text-right text-xs text-slate-600 w-14">
                  {!isSeparator && row.pctOfGross !== undefined && gross > 0
                    ? formatPct(row.pctOfGross)
                    : ''
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Overhead callout / OSVČ note */}
      {isPausalniDan ? (
        <div className="mt-2 text-xs text-slate-500 bg-slate-900/40 rounded px-3 py-2">
          <span className="text-emerald-400 font-medium">Paušální daň: </span>
          Fixed monthly lump-sum covers all SSC and a flat income-tax advance.
          SSC computed on band-minimum assessment bases — independent of actual profit.
        </div>
      ) : isOSVC ? (
        <div className="mt-2 text-xs text-slate-500 bg-slate-900/40 rounded px-3 py-2">
          <span className="text-orange-400 font-medium">OSVČ: </span>
          All social and health contributions are self-paid. SSC assessment base ={' '}
          <span className="text-orange-300 font-mono">50% of profit</span>.
          No employer overhead — profit equals total cost.
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-500 bg-slate-900/40 rounded px-3 py-2">
          <span className="text-slate-400 font-medium">Hidden cost: </span>
          Your employer pays{' '}
          <span className="text-amber-400 font-mono">
            {da(result.sscResult.employerTotal)}
          </span>{' '}
          above your contract salary every month in social charges. This never appears on your payslip.
        </div>
      )}
    </div>
  );
}

