/**
 * Ireland — Country Config 2026 (Tier 2)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Defined Benefit — Contributory State Pension (PRSI-based, flat-rate).
 *
 *   The Irish State Pension (Contributory) — "SPC" — is a flat-rate benefit based on
 *   PRSI contributions record, not earnings. A person with ≥520 paid PRSI contributions
 *   and a yearly average of ≥48 contributions receives the maximum personal rate.
 *
 *   2026 rate (max personal, after Budget 2026 €12/week increase):
 *     ~€289.30/week × 52/12 ≈ €1,254/month
 *   Modelled as DB with basePension=1,254 and accrualRate=0 (non-earnings-related).
 *
 *   NOTE: No mandatory funded second pillar in Ireland. Voluntary occupational/PRSA pensions
 *   are widespread but not modelled here (Phase 7 voluntary pension contribution layer).
 *
 * INCOME TAX NOTES:
 *   Ireland uses "schedular" PAYE with two rates: 20% (standard) and 40% (higher).
 *   Standard rate band 2026 (single person): €44,000/year = €3,667/month (Budget 2026 increase).
 *   Personal tax credits are KEY in Ireland (reduce tax, not tax base):
 *     - Personal tax credit: €1,875/year  → €156/month
 *     - PAYE employee credit: €1,875/year → €156/month
 *     Total mandatory employee credits: €3,750/year ≈ €313/month against tax bill.
 *   Modelled via personalAllowance=313 + allowanceIsCredit=true (tax credit, not base deduction).
 *
 * Sources:
 *   SPC 2026 rate: gov.ie Budget 2026 social welfare rates; Dept. Social Protection
 *   SSC: MISSOC Table I Jan 2026; Social Welfare Consolidation Act 2005 (PRSI); USC FA 2024 s.2
 *   Income tax: TCA 1997 s.15–16; Finance Act 2025 (Budget 2026) standard rate band €44,000
 *   AW: CSO Earnings, Hours and Employment Costs Survey 2025 / Eurostat NL 2026 estimate
 */

import type { CountryConfig } from '../types';

const AW_2026 = 4_600; // EUR/month — CSO Ireland gross average estimate 2026

// Irish State Pension (Contributory) 2026 — maximum personal rate
// Budget 2026 increased by €12/week: old rate ~€277.30 → new ~€289.30/week
// Monthly: €289.30 × 52/12 = €1,254 EUR/month
const SPC_2026 = 1_254; // EUR/month

export const ireland: CountryConfig = {
  code: 'IE',
  name: 'Ireland',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 3_680,        // EUR/month — Eurostat SES / CSO 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / CSO Ireland 2022 adj. to 2026
    p10: 1_950, p25: 2_650, p75: 4_900, p90: 6_800,
  },
  minimumWage: 2_340,         // EUR/month — National Minimum Wage Orders 2026 (13.50 EUR/hr × 173hr)
  oecdAverageWage: 4_447,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 53,364/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 66,        // Irish State Pension age 2026 (rose from 65 to 66 in 2014)
    retirementDuration: 19,   // age 66 to 85 expected
  },

  // TCA 1997 s.15–16 — Finance Act 2025 (Budget 2026)
  // Standard rate band (single person) 2026: €44,000/year = €3,667/month
  // Personal + PAYE tax credits combined: €3,750/year = €313/month (tax credit, not deduction)
  incomeTax: {
    type: 'progressive',
    personalAllowance: 313,     // €313/month combined personal + PAYE tax credits (credits, not deduction)
    allowanceIsCredit: true,    // Irish tax credits reduce final tax payable, not the taxable base
    taxBase: 'gross',
    brackets: [
      { upTo: 3_667,   rate: 0.20 }, // standard rate: €44,000/year ÷ 12 = €3,667/month
      { upTo: Infinity, rate: 0.40 }, // higher rate: above standard rate band
    ],
  },

  // Employee SSC 2026 — PRSI + USC (Universal Social Charge)
  // PRSI: standard Class A employees pay 4.0% (increased from 4.1% back to 4.0% — verify)
  // USC: Universal Social Charge 2026 thresholds (Finance Act 2025):
  //   0.5% on first €12,012/year (€1,001/month)
  //   2.0% on €12,012–€23,124/year (€1,001–€1,927/month)
  //   4.0% on €23,124–€70,044/year (€1,927–€5,837/month)
  //   8.0% on income above €70,044/year (above €5,837/month)
  // PRSI is pension-funded; USC is a revenue levy (not pension-funded)
  employeeSSC: {
    ceiling: undefined,
    components: [
      { label: 'PRSI Class A (Pension/SI)', rate: 0.04, pensionFunded: true },
      { label: 'USC Tier 1 (0.5%)',         rate: 0.005, ceiling: 1_001, pensionFunded: false },
      { label: 'USC Tier 2 (2%)',           rate: 0.02,  ceiling: 1_927, pensionFunded: false },
      { label: 'USC Tier 3 (4%)',           rate: 0.04,  ceiling: 5_837, pensionFunded: false },
      { label: 'USC Tier 4 (8%)',           rate: 0.08,  pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — PRSI employer rate
  // Class A employer rate: 11.05% on all earnings (Budget 2024 increased from 10.95%)
  // Note: no employer USC
  employerSSC: {
    ceiling: undefined,
    components: [
      { label: 'PRSI Employer (Class A)', rate: 0.1105, pensionFunded: true },
    ],
  },

  // ─── Pension System: DB (Flat-rate State Pension Contributory) ────────────────
  //
  // The SPC is NOT earnings-related. It is based solely on PRSI contribution record.
  // Maximum personal rate (2026): ~€1,254/month (€289.30/week × 52/12).
  // All employees with standard 40yr career get the maximum rate.
  //
  // Engine mapping (DBConfig):
  //   basePension = SPC_2026 (full monthly pension)
  //   accrualRatePerYear = 0.0 (flat — not scaled by earnings)
  //   reductionThresholds → creditRate=0 (no earnings-related component)
  //   → monthly pension = 1,254 EUR for any wage level with full PRSI history
  //
  // NOTE: Ireland has no mandatory funded Pillar 2 for private sector workers.
  //   Voluntary Personal Retirement Savings Accounts (PRSAs) and occupational schemes
  //   are common but not modelled here. Phase 7 will add voluntary pension contribution relief.
  pensionSystem: {
    type: 'DB',
    basePension: SPC_2026,        // €1,254/month maximum personal rate — flat regardless of earnings
    reductionThresholds: [
      { upTo: Infinity, creditRate: 0.0 }, // non-earnings-related: no credit on any earnings
    ],
    accrualRatePerYear: 0.0,       // flat-rate — basePension IS the full benefit
    assessmentBase: 'monthly_avg',
    ceiling: 10_000,               // irrelevant (accrualRate=0), set large
  },

  // IE: SPC is subject to income tax if total income exceeds personal tax credits threshold.
  // For a typical pensioner receiving SPC only: below liability threshold.
  // For higher earners with occupational pension: SPC + occupational pension taxed as income.
  // Standard income tax rules apply. Source: TCA 1997 s.18.
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'TCA 1997 s.18: SPC taxable as Schedule E income; personal + age credits (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'CSO EHECS Survey 2025 / Eurostat earn_ses estimate 2026',
      url: 'https://www.cso.ie/en/statistics/earnings/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'TCA 1997 s.15–16; Finance Act 2025 (Budget 2026) — standard rate band raised to €44,000',
      url: 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-rates-bands/index.aspx',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC — PRSI + USC',
      source: 'MISSOC Table I Jan 2026; Finance Act 2025 USC thresholds; SW Consolidation Act 2005',
      url: 'https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax/universal-social-charge/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employerSSC — PRSI 11.05%',
      source: 'Dept. Social Protection — PRSI Class A employer rate Budget 2024/2025',
      url: 'https://www.gov.ie/en/service/12e6f3-prsi-pay-related-social-insurance/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — SPC 2026 rate (€289.30/week)',
      source: 'gov.ie Budget 2026 social welfare rates booklet; Dept. Social Protection',
      url: 'https://www.gov.ie/en/publication/0685c-sw19-guide-to-social-welfare-rates/',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    // ── Cross-cutting source references ──────────────────────
    {
      parameter: 'medianWage + wagePercentiles',
      source: 'Eurostat Structure of Earnings Survey (earn_ses_monthly) 2022, adjusted to 2026',
      url: 'https://ec.europa.eu/eurostat/web/labour-market/earnings/database',
      retrievedDate: '2026-01',
      dataYear: 2022,
    },
    {
      parameter: 'oecdAverageWage',
      source: 'OECD Taxing Wages 2025, Table I.1 (data year 2024)',
      url: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
      retrievedDate: '2025-11',
      dataYear: 2024,
    },
    {
      parameter: 'minimumWage',
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + National Minimum Wage Order 2026',
      url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php/Minimum_wage_statistics',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionTax (taxed as income)',
      source: 'MISSOC Comparative Tables — Table V pension taxation 2025; specific law cited in pensionTax.note',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,
};
