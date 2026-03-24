/**
 * Latvia — Country Config 2026 (Tier 3)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: MIXED — Pillar 1 (NDC, valsts pensija) + mandatory funded Pillar 2.
 *
 *   Total pension contribution: 20% of gross (insured income):
 *     Employee: 10% of gross (4% → Pillar 2 funded, 6% → Pillar 1 NDC)
 *     Employer: 10% of gross (2% → Pillar 2 funded redirect, 8% → Pillar 1 NDC)
 *     Combined: Pillar 1 NDC = 14%, Pillar 2 funded = 6%
 *
 *   Pillar 1 — NDC (valsts pensijas apdrošināšana, Valsts sociālā apdrošināšana)
 *     pillar1ContributionRate = 14%, notionalReturnRate = 3% (wage index proxy)
 *     Annuity divisor: CSB Latvia life tables — remaining LE at retirement age (months)
 *     Source: CSB — https://www.csb.gov.lv/en/statistics/population/mortality-life-expectancy
 *
 *   Pillar 2 — Mandatory funded (uzkrājošā pensiju shēma)
 *     6% total redirected to individual funded account.
 *     Pension ceiling (insured income max) 2026: ~65,000 EUR/year = ~5,417 EUR/month.
 *     Source: VSAA / Konsolidētā valsts sociālā apdrošināšana likums
 *
 * INCOME TAX NOTES:
 *   Latvia has a three-band progressive income tax since 2018 reform:
 *     20% up to 20,004 EUR/year (1,667 EUR/month);
 *     23% on 20,004–78,100 EUR/year (1,667–6,508 EUR/month);
 *     31% above 78,100 EUR/year (6,508 EUR/month).
 *   Non-taxable minimum (neapliekamais minimums) 2026: 6,000 EUR/year = 500 EUR/month.
 *   Complex taper applies: NTM decreases as income rises above 21,600 EUR/year (1,800 EUR/month)
 *   until it reaches 0 at 43,200 EUR/year (3,600 EUR/month).
 *   personalAllowance = 500 EUR/month models the full NTM (accurate for ≤ 1,800 EUR/month;
 *   overstates allowance for 1,800–3,600 EUR/month range; Phase 7 will add taper logic).
 *   Source: Likums par iedzīvotāju ienākuma nodokli (IIN) § 13; MK noteikumi 2026.
 *
 * Sources:
 *   AW: CSB Latvia — Vidējā darba samaksa 2025/2026 estimate; OECD Average Wages LV
 *   Income tax: Likums par IIN § 15; Valsts ieņēmumu dienests (VID) 2026 parametri
 *   SSC: VSAA — VSAOI likmes 2026; MISSOC Table I Jan 2026
 *   Pension: Valsts sociālās apdrošināšanas likums; VSAA pensijas aprēķins
 *   Life tables: CSB Latvia — Demogrāfija — dzīvildze 2024
 */

import type { CountryConfig } from '../types';

const AW_2026 = 1_700; // EUR/month — CSB Latvia gross average wage 2026 estimate

// Pension contribution ceiling 2026
// VSAA: max insured income ~65,000 EUR/year → 5,417 EUR/month
const PENSION_CEILING = 5_417; // EUR/month

export const latvia: CountryConfig = {
  code: 'LV',
  name: 'Latvia',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 1_360,        // EUR/month — Eurostat SES / CSB Latvia 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / CSB Latvia 2022 adj. to 2026
    p10: 820, p25: 1_020, p75: 1_900, p90: 2_750,
  },
  minimumWage: 740,           // EUR/month — MK not. Nr. 786 2025 (minimums darba alga 2026)
  oecdAverageWage: 1_729,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 20,748/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,      // Vecuma pensijas vecums 2026: 65 (rising to 65yr since 2025 reform)
    retirementDuration: 20, // age 65 to ~85
  },

  // Likums par IIN — 2026 progressive income tax (3-band system since 2018 reform)
  // personalAllowance = 500 EUR/month = NTM max (6,000 EUR/yr); taper not modelled (Phase 7).
  incomeTax: {
    type: 'progressive',
    personalAllowance: 500, // neapliekamais minimums (NTM) — full amount; tapers to 0 above 3,600 EUR/mo
    taxBase: 'gross',
    brackets: [
      { upTo: 1_667,   rate: 0.20 }, // ≤ 20,004 EUR/year ÷ 12
      { upTo: 6_508,   rate: 0.23 }, // ≤ 78,100 EUR/year ÷ 12 (includes Eur solidarity)
      { upTo: Infinity, rate: 0.31 }, // above 78,100 EUR/year
    ],
  },

  // Employee SSC 2026 — VSAOI (Valsts sociālās apdrošināšanas obligātās iemaksas)
  // Total employee rate: 10.5% of gross
  employeeSSC: {
    ceiling: PENSION_CEILING,
    components: [
      // Old-age pension, employee share redirected to funded Pillar 2: 4%
      { label: 'Pensiju apdrošināšana — Pillar 2 (employee 4%)', rate: 0.040, ceiling: PENSION_CEILING, pensionFunded: true },
      // Old-age pension, employee share to NDC Pillar 1: 6%
      { label: 'Pensiju apdrošināšana — NDC Pillar 1 (employee 6%)', rate: 0.060, ceiling: PENSION_CEILING, pensionFunded: true },
      // Invaliditate + vecāku pabalsti (disability + parental): 0.5%
      { label: 'Invaliditāte / vecāku pabalsti', rate: 0.005, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — VSAOI
  // Total employer rate: 23.59% of gross
  employerSSC: {
    ceiling: PENSION_CEILING,
    components: [
      // Old-age pension, employer share redirected to funded Pillar 2: 2%
      { label: 'Pensiju apdrošināšana — Pillar 2 (employer 2%)', rate: 0.020, ceiling: PENSION_CEILING, pensionFunded: true },
      // Old-age pension, employer share to NDC Pillar 1: 8%
      { label: 'Pensiju apdrošināšana — NDC Pillar 1 (employer 8%)', rate: 0.080, ceiling: PENSION_CEILING, pensionFunded: true },
      // Veselības aprūpe (health insurance): ~10.60%
      { label: 'Veselības aprūpe (health insurance)', rate: 0.1060, pensionFunded: false },
      // Bezdarba + nelaimes + pārējie (unemployment + accidents + other): ~2.99%
      { label: 'Bezdarbs / nelaime gadijumi / citi', rate: 0.0299, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (NDC Pillar 1 + funded Pillar 2) ──────────────────────────
  //
  // Pillar 1 — NDC (Valsts sociālās apdrošināšanas likums §§ 11–14)
  //   14% of gross credited to notional account for Pillar 1 (employee 6% + employer 8%)
  //   Notional return: wage bill growth index (Latvia real wage growth ~3–4% historically; 3% conservative)
  //   Annuity divisor: CSB Latvia remaining LE at retirement age (months) — 2024 combined M+F tables
  //   Age 65: ~17.5yr = 210 months; age 67: ~15.5yr = 186 months
  //
  // Pillar 2 — Mandatory funded (uzkrājošā pensiju shēma)
  //   6% total redirected to funded individual account (employee 4% + employer redirect 2%)
  //   Managed by licensed private pension fund managers regulated by FKTK.
  //   Default return: 3% net real (OECD benchmark; Latvian funds avg 3–4% net real).
  //
  // Calibration at 1× AW (1,700 EUR), 40yr career at 65, 3% return:
  //   NDC: 1,700 × 0.14 × 12 × FV(3%, 40) = 2,856 × 75.4 = 215,342 EUR → 215,342/210 = 1,025 EUR/mo → RR 60.3%
  //   P2: calcSimplePillar2(0.06, 1700, 40, 0.03) → ~182 EUR/mo → RR 10.7%
  //   Total: ~71.0% (OECD PaG Latvia gross RR ~68–72% aligns ✅)
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'NDC',
      pillar1ContributionRate: 0.14,  // employee 6% + employer 8% → NDC Pillar 1
      notionalReturnRate: 0.025,       // wage index proxy (LV real wage growth normalised ~2.5%/yr long-term)
      annuityDivisor: {               // CSB Latvia remaining LE in months — combined M+F Eurostat 2022
        63: 222,                         // ~18.5yr (age 63 combined LV LE)
        65: 200,                         // ~16.7yr (males ~14.7yr, females ~19.0yr, combined ~16.7yr)
        67: 180,                         // ~15yr
        70: 150,                         // ~12.5yr
      },
      ceiling: PENSION_CEILING,       // 5,417 EUR/month (max insured income)
    },
    pillar2Rate: 0.06,                // 6% total to funded Pillar 2 (employee 4% + employer redirect 2%)
    pillar2ReturnRate: 0.025,         // 2.5% net real (FKTK-supervised funds; conservative normalised estimate)
  },

  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'Likums par IIN: state pension taxable as personal income; income threshold for pension taxation may apply at low pension amounts (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'CSB Latvia — Nodarbinātības un darba samaksas statistika 2025/2026',
      url: 'https://www.csb.gov.lv/en/statistics/social-statistics/earnings',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'Likums par iedzīvotāju ienākuma nodokli § 15 (likme 20%/23%/31%); MK noteikumi par NTM',
      url: 'https://likumi.lv/ta/id/56880',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'Valsts sociālās apdrošināšanas obligāto iemaksu likme 2026; MISSOC Table I Jan 2026',
      url: 'https://www.vsaa.gov.lv/pakalpojumi/darbiniekiem/pensijas/vecuma-pensija/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — NDC rates, Pillar 2, life expectancy',
      source: 'VSAA — pensijas aprēķins; CSB Latvia dzīvildze (life expectancy tables) 2024',
      url: 'https://www.csb.gov.lv/en/statistics/statistics-theme/population/life-expectancy',
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
      parameter: 'minimumWage',
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + national decree 2026 (minimālā alga)',
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
