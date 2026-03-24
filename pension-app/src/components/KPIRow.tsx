/**
 * KPIRow — 3 headline KPI cards per country (§5 spec)
 * PRIMARY: Total Employer Cost | Contract Gross | Net Take-Home
 */

import type { ScenarioResult, CZBenefitResult } from '../types';
import { displayAmount, formatOverhead, formatPct } from '../utils/formatCurrency';

interface Props {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
  /** When present, adds lighter-green secondary values showing totals with benefits */
  czBenefitResult?: CZBenefitResult | null;
}

function KPICard({
  label, value, sub, isPrimary, valueColor, withBenefitsValue,
}: {
  label: string;
  value: string;
  sub: string;
  isPrimary?: boolean;
  valueColor?: string;
  /** Secondary value shown in lighter green when employer benefits are active */
  withBenefitsValue?: string;
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 flex-1 min-w-0 border ${
        isPrimary
          ? 'bg-slate-700 border-slate-500'
          : 'bg-slate-800/60 border-slate-700'
      }`}
    >
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-semibold font-mono leading-tight ${valueColor ?? 'text-slate-100'}`}>
        {value}
      </p>
      {withBenefitsValue && (
        <p className="text-sm font-mono font-semibold text-green-300 leading-tight">
          {withBenefitsValue}
          <span className="text-[10px] font-normal text-slate-500 ml-1">w/ benefits</span>
        </p>
      )}
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

export function KPIRow({ result, currency, countryCurrency, eurExchangeRate, czBenefitResult }: Props) {
  const { sscResult, taxResult } = result;
  const gross = result.resolvedWage.grossLocal;
  const netTakeHome = gross - taxResult.incomeTaxMonthly - sscResult.employeeTotal;
  const overheadPct = formatOverhead(sscResult.totalEmployerCost, gross);
  const netPct = gross > 0 ? `${((netTakeHome / gross) * 100).toFixed(1)}% of gross` : '—';

  // Detect OSVČ mode: no employer SSC pore totalEmployerCost equals gross
  const isOSVC = sscResult.employerTotal === 0 &&
    sscResult.totalEmployerCost === gross;

  const da = (n: number) => displayAmount(n, countryCurrency, currency, eurExchangeRate);

  // With-benefits variants (benefit amounts are real employer costs, just tax-exempt)
  const benefitNetAdd  = czBenefitResult?.totalNetAdd         ?? 0; // fringe + meal → net
  const benefitDps     = czBenefitResult?.pensionContribMonthly ?? 0; // DPS → locked
  const hasBenefits    = !isOSVC && (benefitNetAdd > 0 || benefitDps > 0);
  const totalCostWithB = sscResult.totalEmployerCost + benefitNetAdd + benefitDps;
  const netWithB       = netTakeHome + benefitNetAdd;
  const overheadWithB  = formatOverhead(totalCostWithB, gross);

  return (
    <div className="flex gap-2">
      <KPICard
        label={isOSVC ? 'Monthly Profit' : 'Total Employer Cost'}
        value={da(sscResult.totalEmployerCost)}
        sub={isOSVC ? 'All SSC self-paid (no employer)' : `Overhead: ${overheadPct} above gross`}
        isPrimary
        valueColor="text-slate-100"
        withBenefitsValue={hasBenefits ? `${da(totalCostWithB)} (${overheadWithB} above gross)` : undefined}
      />
      <KPICard
        label={isOSVC ? 'Profit Before SSC & Tax' : 'Contract Gross'}
        value={da(gross)}
        sub={result.resolvedWage.referenceLabel}
      />
      <KPICard
        label="Net Take-Home"
        value={da(netTakeHome)}
        sub={netPct}
        valueColor="text-green-400"
        withBenefitsValue={hasBenefits ? da(netWithB) : undefined}
      />
    </div>
  );
}

/** Effective rate summary row used inside WageBreakdownTable footer */
export function EffectiveRates({ result, czBenefitResult }: {
  result: ScenarioResult;
  czBenefitResult?: CZBenefitResult | null;
}) {
  const gross = result.resolvedWage.grossLocal;
  const { taxResult, sscResult } = result;
  const totalDeductions = taxResult.incomeTaxMonthly + sscResult.employeeTotal;
  const netTakeHome = gross - totalDeductions;

  const isOSVC = sscResult.employerTotal === 0 && sscResult.totalEmployerCost === gross;
  const benefitNetAdd = (!isOSVC ? czBenefitResult?.totalNetAdd : 0) ?? 0;
  const hasBenefits   = benefitNetAdd > 0;
  const ratioBase     = gross > 0 ? netTakeHome / gross : 0;
  const ratioWithB    = gross > 0 ? (netTakeHome + benefitNetAdd) / gross : 0;

  return (
    <div className="grid grid-cols-3 gap-2 text-center mt-2">
      <div className="bg-slate-900/40 rounded p-2">
        <p className="text-sm font-mono font-semibold text-red-400">{formatPct(taxResult.effectiveTaxRate)}</p>
        <p className="text-xs text-slate-500">Effective tax rate</p>
      </div>
      <div className="bg-slate-900/40 rounded p-2">
        <p className="text-sm font-mono font-semibold text-orange-400">{formatPct(taxResult.marginalTaxRate)}</p>
        <p className="text-xs text-slate-500">Marginal tax rate</p>
      </div>
      <div className="bg-slate-900/40 rounded p-2">
        <p className="text-sm font-mono font-semibold text-green-400">
          {gross > 0 ? formatPct(ratioBase) : '—'}
        </p>
        {hasBenefits && (
          <p className="text-xs font-mono font-semibold text-green-300">
            {formatPct(ratioWithB)}
            <span className="text-[10px] font-normal text-slate-500 ml-1">w/ benefits</span>
          </p>
        )}
        <p className="text-xs text-slate-500">Net/gross ratio</p>
      </div>
    </div>
  );
}

// ─── Pension breakdown row ────────────────────────────────────────────────────

interface OecdRR {
  rrPct: number;
  pensionAge: number;
  isP1Only: boolean;
  isInterpolated: boolean;
}

interface PensionRowProps {
  result: ScenarioResult;
  currency: 'EUR' | 'local';
  countryCurrency: string;
  eurExchangeRate: number;
  /** When rrSource === 'oecd': pre-computed OECD PaG value, or null if N/A */
  oecdRR?: OecdRR | null;
}

/**
 * PensionRow — shows estimated monthly pension split by pillar.
 * Single-pillar countries: one card + replacement rate.
 * Mixed countries (PL, SK): Pillar 1 | Pillar 2 DC | Total | Replacement Rate.
 * When oecdRR is provided, the replacement rate KPI switches to the OECD PaG value.
 */
export function PensionRow({ result, currency, countryCurrency, eurExchangeRate, oecdRR }: PensionRowProps) {
  const { pensionResult } = result;
  const { monthlyPension, pillar1Monthly, pillar2Monthly, replacementRate } = pensionResult;
  const hasP2 = pillar2Monthly != null && pillar2Monthly > 0;

  const da = (n: number) => displayAmount(n, countryCurrency, currency, eurExchangeRate);

  // Determine which replacement rate string to display
  const useOecd = oecdRR != null;
  const rrDisplayPct = useOecd ? oecdRR.rrPct : replacementRate * 100;
  const rrStr = `${rrDisplayPct.toFixed(1)}% of gross`;

  // Sub-label for the RR card
  const rrSub = useOecd
    ? `OECD PaG — pension age ${oecdRR.pensionAge}${oecdRR.isInterpolated ? ' (interp.)' : ''}${oecdRR.isP1Only ? ' · P1 only' : ''}`
    : 'of gross wage';

  return (
    <div className="mt-3">
      <h3 className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Pension Estimate</h3>
      <div className="flex gap-2">
        <KPICard
          label={hasP2 ? 'Pillar 1 — State' : 'Monthly Pension'}
          value={da(pillar1Monthly)}
          sub={hasP2 ? 'NDC / Points / DB' : rrStr}
          valueColor="text-sky-400"
        />
        {hasP2 && (
          <KPICard
            label="Pillar 2 — DC"
            value={da(pillar2Monthly!)}
            sub="Funded account"
            valueColor="text-amber-400"
          />
        )}
        <KPICard
          label={hasP2 ? 'Total Pension' : 'Replacement Rate'}
          value={hasP2 ? da(monthlyPension) : `${rrDisplayPct.toFixed(1)}%`}
          sub={hasP2 ? rrStr : rrSub}
          valueColor={hasP2 ? 'text-slate-100' : useOecd ? 'text-violet-400' : 'text-teal-400'}
        />
        {hasP2 && (
          <KPICard
            label="Replacement Rate"
            value={`${rrDisplayPct.toFixed(1)}%`}
            sub={rrSub}
            valueColor={useOecd ? 'text-violet-400' : 'text-teal-400'}
          />
        )}
      </div>
      {useOecd && (
        <p className="text-xs text-violet-500 mt-1">
          ● OECD PaG — tabulated reference rate{oecdRR.isInterpolated ? ' (linearly interpolated between 0.5×/1.0×/2.0× anchor points)' : ''}.
          Model RR: {(replacementRate * 100).toFixed(1)}%.
        </p>
      )}
    </div>
  );
}
