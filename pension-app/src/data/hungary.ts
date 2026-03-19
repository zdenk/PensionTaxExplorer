/**
 * Hungary — Country Config 2026 (Tier 4)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Defined Benefit — Állami Nyugdíj (Social insurance pension, state DB).
 *
 *   Hungarian state pension (öregségi nyugdíj):
 *   Based on contributory earnings record; mandatory Pillar 2 (Magánpénztár) was nationalised
 *   in 2010-2011, so there is effectively only the state DB system for all current workers.
 *
 *   Formula:
 *     pension = average_monthly_earnings × tier_percentage
 *     where tier_percentage is a non-linear function of service years:
 *       10yr:  33.0%   → effective 3.30%/yr
 *       15yr:  41.0%   → marginal +1.60%/yr
 *       20yr:  49.0%   → marginal +1.60%/yr
 *       25yr:  57.0%   → marginal +1.60%/yr
 *       30yr:  65.5%   → marginal +1.70%/yr  (new arrangement from ~30yr)
 *       35yr:  72.5%   → marginal +1.40%/yr
 *       40yr:  78.5%   → marginal +1.20%/yr
 *       43yr:  81.5%   → marginal +1.00%/yr
 *       45yr:  83.5%   → marginal +1.00%/yr
 *   Assessment base: all career years average (1988+); valorised to retirement.
 *
 *   Engine simplification:
 *     The tiered structure is modelled as a constant accrualRatePerYear.
 *     For standard career 25→65 = 40yr: 78.5% / 40yr = 1.963%/yr
 *     OECD PaG 2023 HU gross RR = 73.4% at 1×AW at pension age 65 → effective rate = 73.4%/40 = 1.835%/yr
 *     We use 0.0183 (slightly below the tier table due to OECD's wage-growth adjusted assessment base vs 
 *     model's constant-wage assumption, and partial suspensions/valorisation differences).
 *
 * SOCIAL CONTRIBUTIONS NOTE:
 *   Key Hungarian SSC feature:
 *   - Employee: Nyugdíjjárulék (pension): 10%; Egészségügyi hozzájárulás / SZOCHO portion: 18.5%
 *     → Total employee: 18.5% (10% pension + various health/labour market components)
 *   - Employer: Szociális Hozzájárulási Adó (SZOCHO — social contribution tax): 13%
 *     This replaces the old 7 SSC components from 2019.
 *
 * INCOME TAX NOTES:
 *   Hungary has a flat 15% personal income tax (Szja — személyi jövedelemadó).
 *   No personal allowance for standard employees (family credit exists but not modelled).
 *
 * Sources:
 *   Income tax: Szja tv. (2011. évi CXVII. törvény) § 8 — 15% flat rate
 *   SSC: MISSOC Table I January 2026; Tbj. tv. (2019. évi CXXII. törvény); Szocho tv.
 *   AW: KSH (Központi Statisztikai Hivatal) / OECD AV_AN_WAGE HUN 2026 est.
 *     ~HUF 670,000/month gross (≈ EUR 1,675 at 400 HUF/EUR)
 *   EUR/HUF: MNB (Magyar Nemzeti Bank) reference rate Jan 2026 ≈ 400 HUF/EUR
 *   Pension: Tny. tv. (1997. évi LXXXI. törvény) § 13 — percentage formula
 *   OECD PaG 2023: HU gross RR 73.4% at 1×AW, pension age 65
 */

import type { CountryConfig } from '../types';

const AW_2026_HUF = 670_000; // HUF/month — KSH gross average wage estimate 2026
const EUR_HUF = 400.0;        // MNB reference rate Jan 2026 (approx)

// Hungarian pension contribution ceiling (above this, pension contributions still apply but
// benefits are capped by formula — effectively no nominal ceiling; using a very high number)
// In practice, Tny. tv. has no explicit contribution ceiling for HU pension → uncapped
const PENSION_CEILING = 3_000_000; // HUF/month — very high, effectively uncapped

export const hungary: CountryConfig = {
  code: 'HU',
  name: 'Hungary',
  currency: 'HUF',
  eurExchangeRate: EUR_HUF,
  dataYear: 2026,

  averageWage: AW_2026_HUF,
  medianWage: 536_000,          // HUF/month — Eurostat SES / KSH 2022 adj. to 2026
  wagePercentiles: {              // HUF/month — Eurostat SES / KSH 2022 adj. to 2026
    p10: 310_000, p25: 390_000, p75: 760_000, p90: 1_080_000,
  },
  minimumWage: 440_100,           // HUF/month — 289/2025. (X.21.) Korm. rend. (minimálbér 2026)
  oecdAverageWage: 660_000, // HUF/month — OECD Taxing Wages 2025, Table I.1 (2024): ~HUF 7,920,000/yr ÷ 12
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,        // Öregségi nyugdíjkorhatár: 65 (set by 2010 reform — phased in to 65 by 2022)
    retirementDuration: 20,   // age 65 → ~85yr
  },

  // Szja tv. § 8 — flat rate 15% of gross (since 2011; confirmed 2026)
  incomeTax: {
    type: 'flat',
    personalAllowance: 0,
    flatRate: 0.15,
    taxBase: 'gross',
  },

  // Employee SSC 2026 — Tbj. tv. (Tny. tv. → Tbj. combined); MISSOC Table I Jan 2026
  // Nyugdíjjárulék (pension contribution): 10% of gross (uncapped)
  // Egészségbiztosítási + munkaerő-piaci járulék (health + labour market): 8.5% of gross
  //   = 7% health insurance + 1.5% labour market contribution (post-2019 simplification)
  // Total employee SSC: 18.5%
  employeeSSC: {
    ceiling: undefined,
    components: [
      { label: 'Nyugdíjjárulék (Pension Insurance)',      rate: 0.10,  pensionFunded: true },
      { label: 'TB Egészségbiztosítás (Health Ins.)',     rate: 0.07,  pensionFunded: false },
      { label: 'Munkaerő-piaci Járulék (Labour Market)',  rate: 0.015, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — Szociális Hozzájárulási Adó (SZOCHO)
  // SZOCHO (social contribution tax): 13% of gross — fully borne by employer; replaces old multi-item SSC
  // Source: 2018. évi LII. törvény a szociális hozzájárulási adóról
  employerSSC: {
    ceiling: undefined,
    components: [
      { label: 'Szociális Hozzájárulási Adó (SZOCHO)', rate: 0.13, pensionFunded: true },
    ],
  },

  // ─── Pension System: DB (Állami Nyugdíj — Tny. tv. § 13) ─────────────────────────────
  //
  // State old-age pension (öregségi nyugdíj).
  // Assessment base: all career years average monthly earnings, valorised to retirement.
  //   (1988-onwards earnings history; engine uses lifetime_avg of contributed earnings)
  //
  // Percentage formula (non-linear, simplified as constant accrualRatePerYear):
  //   Official: 78.5% after 40yr; 81.5% after 43yr; 83.5% after 45yr
  //   OECD PaG 2023 gross RR 73.4% at 1×AW (22→65 = 43yr OECD career) → 73.4/43 = 1.708%/yr
  //   Model career (25→65 = 40yr): 0.0183 × 40 = 73.2% ≈ OECD 73.4% ✓
  //   The slight undershoot vs official tier table (78.5% theoretically) reflects that OECD
  //   applies wage-growth based assessment and actuarial adjustments. 0.0183 is the calibrated value.
  //
  // No minimum pension floor applicable as a simple monthly amount (complicated rules around
  // anti-poverty supplements — not modelled here; Phase 7).
  pensionSystem: {
    type: 'DB',
    basePension: 0,                   // no fixed flat component
    reductionThresholds: [
      { upTo: Infinity, creditRate: 1.0 }, // full credit on all career earnings (no ceiling effect)
    ],
    accrualRatePerYear: 0.0183,       // effective rate — calibrated to OECD PaG 2023 73.4% at 1×AW
    assessmentBase: 'lifetime_avg',   // all career earnings average, valorised
    ceiling: PENSION_CEILING,         // effectively uncapped (3M HUF/month)
  },

  // HU: Pension income taxed as ordinary income under Szja at 15% flat rate.
  // Source: Szja tv. § 7(1) — öregségi nyugdíj bizonyos feltételekkel szja-köteles...
  // Actually: Hungarian state pension (öregségi nyugdíj) is EXEMPT from Szja under § 7(1)(a).
  // Source: 2011. évi CXVII. törvény (Szja tv.) § 7(1)(a) — öregségi (és annyi) adómentes
  pensionTax: {
    method: 'none',
    note: 'Szja tv. § 7(1)(a): öregségi nyugdíj adómentes (state old‐age pension is income‐tax exempt in Hungary)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'KSH (Központi Statisztikai Hivatal) bruttó átlagkereset 2026 estimate (~HUF 670,000/month)',
      url: 'https://www.ksh.hu/stadat_inf_2_1',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'eurExchangeRate',
      source: 'MNB (Magyar Nemzeti Bank) EUR/HUF reference rate Jan 2026 ≈ 400',
      url: 'https://www.mnb.hu/arfolyam-lekerdezo',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'Szja tv. (2011. évi CXVII.) § 8 — 15% flat rate; NAV 2026',
      url: 'https://nav.gov.hu/ado/szja',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC',
      source: 'Tbj. tv. (2019. évi CXXII.) — nyugdíjjárulék 10%; egészségbiztosítási jár. 7%; munkaerő-piaci 1.5%; MISSOC Jan 2026',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employerSSC',
      source: '2018. évi LII. törvény — SZOCHO 13%; MISSOC Table I Jan 2026',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem (Tny. tv. § 13 — percentage formula)',
      source: '1997. évi LXXXI. törvény (Tny. tv.) § 13; calibrated to OECD PaG 2023 HU 73.4% at 1×AW',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-03',
      dataYear: 2023,
    },
    {
      parameter: 'pensionTax (Szja tv. § 7(1)(a) — exempt)',
      source: '2011. évi CXVII. törvény (Szja tv.) § 7(1)(a) — öregségi nyugdíj adómentes',
      url: 'https://nav.gov.hu/ado/szja',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,
};
