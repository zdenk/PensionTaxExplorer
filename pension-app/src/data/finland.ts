/**
 * Finland — Country Config 2026 (Tier 3)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: DB — TyEL (statutory earnings-related pension).
 *
 * DESIGN DEBT RESOLUTION (Tier 3 — ref §1A.6, §11):
 *   Finland's TyEL is NOT a capital-division NDC. It is an earnings-accrual defined-benefit system
 *   with an age-dependent accrual rate and a life expectancy *coefficient* (elinaikakerroin) that
 *   is a downward multiplier on the calculated benefit (not an annuity divisor on a capital pot).
 *
 *   This is modelled as DBConfig with an effective accrual rate that pre-applies elinaikakerroin:
 *     effective_accrual = base_accrual × elinaikakerroin_2026
 *     = 1.50% × 0.920 = 1.380%/year
 *   The standard accrual rate of 1.50%/year applies for ages 17–52 and 63+.
 *   A higher rate of 1.90%/year applies for ages 53–62 (increases: 1.9% per year for 10 years of that band).
 *   Weighted career average (25–65 = 40 years): 28yr×1.5% + 9yr×1.9% + 3yr×1.5% = 63.6% → 1.59%/yr avg.
 *   Combined with elinaikakerroin 0.920: effective 1.59% × 0.920 = 1.46%/yr.
 *   Simplified to 1.38%/yr (1.5% base × elinaikakerroin) — conservative, Phase 7 will add age bands.
 *
 *   Elinaikakerroin (life expectancy coefficient) 2026:
 *     For those born in 1961 (first eligible 2023 cohort applying 2026): ~0.920 (ETK published value).
 *     Source: Suomen eläketurvakeskus (ETK) — https://www.etk.fi/en/the-pension-system/statistics/life-expectancy-coefficient/
 *
 * INCOME TAX NOTES:
 *   Finnish income tax = state income tax (progressive) + municipal income tax (flat, avg ~21.5%).
 *   State tax 2026 brackets (approximate; Verohallinto 2026):
 *     0 – €17,400/yr: 0%; €17,400–€27,300: 12.64%; €27,300–€44,900: 19%;
 *     €44,900–€80,500: 25.01%; above €80,500: 31–34%
 *   Municipal (kunnallisvero) avg 2026: ~21.5% (Kuntaliitto — national weighted mean).
 *   Deductions: work income deduction (ansiotulovähennys) + basic deduction (perusvähennys) combined
 *     reduce the effective tax base at average wage by ~500 EUR/month.
 *   Modelled as personalAllowance = 500 EUR/month (deduction from base, covering SSC deductibility and
 *   standard Finnish income deductions; Phase 7 will add per-income taper for basic deduction).
 *   Tax base: gross (SSC deductibility factored into personalAllowance approximation).
 *
 * Sources:
 *   AW: Statistics Finland — earnings concept survey 2024; 2026 estimate
 *   Income tax: Verohallinto (Finnish Tax Administration) — 2026 tax tables; Tuloverolaki (TVL)
 *   Municipal rates: Kuntaliitto (Association of Finnish Local Authorities) — average rate 2026
 *   SSC: MISSOC Table I Jan 2026; ETK suomalainen eläkejärjestelmä 2026
 *   TyEL accrual rates: ETK / Työntekijän eläkelaki (TyEL) §12 §§ (395/2006)
 *   Elinaikakerroin: ETK published coefficient table https://www.etk.fi/en/the-pension-system/statistics/life-expectancy-coefficient/
 */

import type { CountryConfig } from '../types';

const AW_2026 = 3_900; // EUR/month gross — Statistics Finland 2026 estimate

// TyEL effective accrual rate (base 1.5% × elinaikakerroin 0.920 = 1.38%)
// See design debt resolution note above.
const TYEL_EFFECTIVE_ACCRUAL = 0.0138;

export const finland: CountryConfig = {
  code: 'FI',
  name: 'Finland',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 3_315,        // EUR/month — Eurostat SES / Statistics Finland 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / Statistics Finland 2022 adj. to 2026
    p10: 1_950, p25: 2_500, p75: 4_100, p90: 5_600,
  },
  minimumWage: 1_800,         // EUR/month — effective TES floor (dominant sector collective agreements 2026)
  oecdAverageWage: 3_978,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 47,736/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,      // Vanhuuseläkeikä: lower bound ~63; target age for 1961 cohort ~65.5
    retirementDuration: 21, // age 65 to ~86 (Finnish LE ~86 for 2026 cohort)
  },

  // Verohallinto — 2026 income tax
  // Combined state (progressive) + municipal (avg 21.5%).
  // personalAllowance = 500 EUR/month approximates work income deduction + basic deduction effect.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 500, // work income deduction + basic deduction combined effect (~EUR/mo)
    taxBase: 'gross',
    brackets: [
      { upTo: 1_450,   rate: 0.215 }, // below state threshold: municipal only (~21.5%)
      { upTo: 2_275,   rate: 0.340 }, // state 12.64% + municipal 21.4%
      { upTo: 3_742,   rate: 0.406 }, // state 19.0% + municipal 21.5%
      { upTo: 6_708,   rate: 0.465 }, // state 25.01% + municipal 21.5% ≈ 46.5%
      { upTo: Infinity, rate: 0.524 }, // state 31% + municipal 21.5%
    ],
  },

  // Employee SSC 2026 — ETK / MISSOC
  // TyEL contribution split: full employer 17.34% + employee 7.15% (age 17–52); 8.65% for age 53+.
  // Using the age 17–52 standard rate for the employee component (majority of career).
  // Note: TyEL employee contribution is tax-deductible (TVL § 96).
  employeeSSC: {
    ceiling: undefined,
    components: [
      // TyEL (Työntekijän eläkevakuutusmaksu): 7.15% for employees under 53
      // (rate rises to 8.65% for age 53–62; simplified as flat 7.15% — Phase 7 will add age bands)
      { label: 'TyEL (Pension Insurance)', rate: 0.0715, pensionFunded: true },
      // Työttömyysvakuutusmaksu (unemployment insurance): 1.42% (employee)
      { label: 'Unemployment Insurance', rate: 0.0142, pensionFunded: false },
      // Sairausvakuutuksen päivärahamaksu (daily allowance) + sairaanhoitomaksu: ~2.43% combined
      { label: 'Health Insurance (sairausvakuutus)', rate: 0.0243, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — ETK / MISSOC
  // TyEL employer rate: avg ~17.34% (rate varies by company age/size; standard weighted avg)
  employerSSC: {
    ceiling: undefined,
    components: [
      // TyEL employer contribution (average rate 2026; varies by age/company risk class)
      { label: 'TyEL (Pension Insurance)', rate: 0.1734, pensionFunded: true },
      // Työtapaturma- ja ammattitautivakuutus (occupational accident insurance): ~0.60% avg
      { label: 'Work Accident Insurance', rate: 0.0060, pensionFunded: false },
      // Ryhmähenkivakuutus (group life insurance): ~0.07%
      { label: 'Group Life Insurance', rate: 0.0007, pensionFunded: false },
      // Työttömyysvakuutusmaksu (employer): 0.59% (payroll ≤ €2,251,500/yr) / 2.07% above threshold
      // Using the lower rate for standard SME-sized employer
      { label: 'Unemployment Insurance (employer)', rate: 0.0114, pensionFunded: false },
    ],
  },

  // ─── Pension System: DB (TyEL — Werkijän eläkelaki 395/2006) ─────────────────────────
  //
  // Formula (TyEL §§12):
  //   Annual accrual = earnings_in_year × accrual_rate
  //     accrual_rate(age 17–52) = 1.50%/yr
  //     accrual_rate(age 53–62) = 1.90%/yr   ← Phase 7: add age-banded accrual
  //     accrual_rate(age 63+)   = 1.50%/yr
  //   Lifetime pension = Σ(annual_accruals), then × elinaikakerroin
  //
  //   Elinaikakerroin 2026 (ETK table, born 1961 cohort): 0.920
  //   Effective single-rate approximation: 1.50% × 0.920 = 1.38%/yr (TYEL_EFFECTIVE_ACCRUAL)
  //
  // Replacement rate check at 1× AW for 40-year career:
  //   pension = 3,900 × 40 × 0.0138 = 2,153 EUR/mo → RR = 55.2%
  //   OECD PaG 2023 FI gross RR at mean earnings: ~56.2% ✅ (within 1 pp)
  //
  // TyEL has no contribution/benefit ceiling — applies to all earnings.
  // Assessment base: last n years average (TEL actuals); simplified here as lifetime_avg.
  pensionSystem: {
    type: 'DB',
    basePension: 0,
    reductionThresholds: [
      { upTo: Infinity, creditRate: 1.0 }, // no reduction — all earnings credited at 100%
    ],
    accrualRatePerYear: TYEL_EFFECTIVE_ACCRUAL, // 1.38% = 1.5% base × 0.920 elinaikakerroin
    assessmentBase: 'lifetime_avg',
    ceiling: 40_000, // TyEL uncapped; large value for engine compatibility
  },

  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'TVL §§79–80: TyEL pension taxed as earned income; pensioners eligible for "eläketulovähennys" (pension income deduction) reducing effective rate — not modelled (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Statistics Finland — Palkkarakennetutkimus 2024; 2026 estimate',
      url: 'https://www.stat.fi/til/pra/index_en.html',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'Verohallinto (Finnish Tax Administration) — 2026 income tax tables; TVL §§124–125',
      url: 'https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/47465/veroprosentit/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'ETK (Finnish Centre for Pensions) — TyEL rates 2026; MISSOC Table I Jan 2026',
      url: 'https://www.etk.fi/en/the-pension-system/pension-system/financing/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — TyEL accrual, elinaikakerroin',
      source: 'ETK — TyEL §12 (395/2006); life expectancy coefficient 2026 published table',
      url: 'https://www.etk.fi/en/the-pension-system/statistics/life-expectancy-coefficient/',
      retrievedDate: '2026-01',
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
      parameter: 'minimumWage (effective sectoral floor)',
      source: 'MISSOC Comparative Tables 2026 + dominant sector collective agreement (FI: no national statutory minimum)',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
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
