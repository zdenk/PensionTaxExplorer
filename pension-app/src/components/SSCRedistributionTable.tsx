/**
 * SSCRedistributionTable — breakdown of where SSC contributions go (§5)
 *
 * Groups components into: Pension | Health | Other
 * Shows employee + employer shares and the career/retirement context.
 */

import type { ScenarioResult, CountryConfig } from '../types';
import { displayAmount, formatPct } from '../utils/formatCurrency';

interface Props {
  result: ScenarioResult;
  country: CountryConfig;
  currency: 'EUR' | 'local';
}

interface Group {
  label: string;
  employeeTotal: number;
  employerTotal: number;
  color: string;
}

function groupComponents(result: ScenarioResult): Group[] {
  const pension = { label: 'Pension-Funded', employeeTotal: 0, employerTotal: 0, color: 'text-yellow-400' };
  const health  = { label: 'Health Insurance', employeeTotal: 0, employerTotal: 0, color: 'text-sky-400' };
  const other   = { label: 'Other (Unemployment, Accident…)', employeeTotal: 0, employerTotal: 0, color: 'text-slate-400' };

  const HEALTH_KEYWORDS = ['health', 'kranken', 'zdrav', 'zvelyk', 'kv', 'zvw', 'nhs', 'prsi', 'zvp', 'zzzs', 'kvl'];

  for (const comp of result.sscResult.components) {
    const labelLower = comp.label.toLowerCase();
    const isHealth = HEALTH_KEYWORDS.some(k => labelLower.includes(k));

    if (comp.fundsPension) {
      pension.employeeTotal += comp.employeeAmount;
      pension.employerTotal += comp.employerAmount;
    } else if (isHealth) {
      health.employeeTotal += comp.employeeAmount;
      health.employerTotal += comp.employerAmount;
    } else {
      other.employeeTotal += comp.employeeAmount;
      other.employerTotal += comp.employerAmount;
    }
  }

  return [pension, health, other].filter(g => g.employeeTotal + g.employerTotal > 0);
}

export function SSCRedistributionTable({ result, country, currency }: Props) {
  const groups = groupComponents(result);
  const gross = result.resolvedWage.grossLocal;
  const da = (n: number) => displayAmount(n, country.currency, currency, country.eurExchangeRate);

  const totalEe = result.sscResult.employeeTotal;
  const totalEr = result.sscResult.employerTotal;
  const totalSSC = totalEe + totalEr;

  // Detect OSVČ / Paušální daň mode: no employer SSC, totalEmployerCost === gross
  const isOSVC = totalEr === 0 && result.sscResult.totalEmployerCost === gross;

  const pensionGroupTotal = groups.find(g => g.label === 'Pension-Funded');
  const pensionTotal = (pensionGroupTotal?.employeeTotal ?? 0) + (pensionGroupTotal?.employerTotal ?? 0);

  return (
    <div className="mt-4">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-2">SSC Redistribution</h3>

      {isOSVC && (
        <p className="text-xs text-orange-400/80 mb-2">
          All contributions self-paid — no employer split. Assessment base fixed per band (Paušální daň) or 50% of profit (OSVČ).
        </p>
      )}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-700">
            <th className="text-left pb-1.5 font-normal">Destination</th>
            <th className="text-right pb-1.5 font-normal">{isOSVC ? 'Self-Paid' : 'Employee'}</th>
            <th className="text-right pb-1.5 font-normal">{isOSVC ? '—' : 'Employer'}</th>
            <th className="text-right pb-1.5 font-normal">Total</th>
            <th className="text-right pb-1.5 font-normal w-12">% gross</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => {
            const total = g.employeeTotal + g.employerTotal;
            return (
              <tr key={g.label} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
                <td className={`py-1.5 pr-2 ${g.color}`}>{g.label}</td>
                <td className="py-1.5 text-right font-mono text-slate-300 text-xs">{da(g.employeeTotal)}</td>
                <td className="py-1.5 text-right font-mono text-slate-300 text-xs">{da(g.employerTotal)}</td>
                <td className={`py-1.5 text-right font-mono font-semibold text-xs ${g.color}`}>{da(total)}</td>
                <td className="py-1.5 text-right text-slate-500 text-xs">
                  {gross > 0 ? formatPct(total / gross) : '—'}
                </td>
              </tr>
            );
          })}

          {/* Totals row */}
          <tr className="border-t-2 border-slate-600 font-semibold">
            <td className="py-2 text-slate-300">Total SSC</td>
            <td className="py-2 text-right font-mono text-slate-200 text-xs">{da(totalEe)}</td>
            <td className="py-2 text-right font-mono text-slate-200 text-xs">{da(totalEr)}</td>
            <td className="py-2 text-right font-mono text-slate-100 text-xs">{da(totalSSC)}</td>
            <td className="py-2 text-right text-slate-400 text-xs">
              {gross > 0 ? formatPct(totalSSC / gross) : '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Pension context */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900/40 rounded px-3 py-2">
          <p className="text-slate-500 mb-0.5">Pension SSC share</p>
          <p className="text-yellow-400 font-mono font-semibold">
            {da(pensionTotal)} / mo
          </p>
          <p className="text-slate-500">
            {gross > 0 ? formatPct(pensionTotal / gross) : '—'} of gross
          </p>
        </div>
        <div className="bg-slate-900/40 rounded px-3 py-2">
          <p className="text-slate-500 mb-0.5">State pension start</p>
          <p className="text-sky-400 font-mono font-semibold">
            Age {country.defaults.retirementAge}
          </p>
          <p className="text-slate-500 capitalize">
            System: {country.pensionSystem.type.replace('_', ' ')}
          </p>
        </div>
      </div>
    </div>
  );
}
