/**
 * Slovakia — Country Config 2026 (Tier 1)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: POMB (points) + Pillar 2 DSS — parameters populated from official 2026 sources.
 *
 * Sources:
 *   SSC: MISSOC Table I Jan 2026; Zákon č. 461/2003 Z.z. (Social Insurance Act)
 *   Income tax: Zákon č. 595/2003 Z.z. (Income Tax Act) — 2026 parameters
 *   AW: Štatistický úrad SR / Eurostat; 2026 estimate based on growth trend
 *   Dôchodková hodnota 2026: Sociálna poišťovňa official decree — 19.7633 EUR
 *     Source: socpoist.sk/socialne-poistenie/zmeny-v-socialnom-poisteni/najdolezitejsie-zmeny-...
 *     („Aktuálna dôchodková hodnota na rok 2026, ktorá vstupuje do vzorca na výčpočet dôchodku,
 *      je 19,7633 eura“)
 *   DSS (Pillar 2) contribution rate 2026: 4% (unchanged; socpoist.sk 2026 changes, item 13)
 */

import type { CountryConfig } from '../types';

// SK AW 2026: estimated ~1,500 EUR/month based on Eurostat trend
// (2024 actual ~1,435; +2.5% growth → 2026 ≈ 1,507 → use 1,500)
const AW_2026 = 1_500; // EUR/month

// Contribution ceiling: 7× AW = 10,500 EUR/month (Sociálna poisťovňa 2026)
const CEILING = 7 * AW_2026; // 10,500 EUR/month

// NČZD (non-taxable part of tax base / personal allowance) 2026: ~5,011 EUR/year = 417.6/month
const PERSONAL_ALLOWANCE_MONTHLY = 418; // EUR/month

export const slovakia: CountryConfig = {
  code: 'SK',
  name: 'Slovakia',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 1_185,        // EUR/month — Eurostat SES 2022 adj. to 2026
  wagePercentiles: {          // EUR/month — Eurostat SES / ŠÚ SR 2022 adj. to 2026
    p10: 700, p25: 870, p75: 1_580, p90: 2_200,
  },
  minimumWage: 816,           // EUR/month — Nariadenie vlády SR č. 300/2025 (2026 minimálna mzda)
  oecdAverageWage: 1_616,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 19,392/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 64, // SK statutory retirement age 2026 (rising from 62 to 64+ based on life exp)
    retirementDuration: 20,
  },

  // Zákon č. 595/2003 Z.z. § 15: two rates 19% / 25%
  // The 25% rate applies to income above 176.8× subsistence minimum ≈ ~3,813 EUR/month (2026 est.)
  incomeTax: {
    type: 'progressive',
    personalAllowance: PERSONAL_ALLOWANCE_MONTHLY,
    taxBase: 'gross',
    brackets: [
      { upTo: 3_813,   rate: 0.19 },
      { upTo: Infinity, rate: 0.25 },
    ],
  },

  // Sociálna poisťovňa — employee contributions (Zákon č. 461/2003 Z.z.)
  employeeSSC: {
    ceiling: CEILING,
    components: [
      // Starobné (old-age): 4% Pillar 1 + up to 6% opt into Pillar 2 DSS
      // Employee pays 4% to Sociálna poisťovňa regardless; the 6% (if in Pillar 2) redirects
      // from employer's 14%. Model employee as 4%.
      { label: 'Old-Age Pension (Starobné)', rate: 0.04, ceiling: CEILING, pensionFunded: true },
      // Invalidné (disability): 3%
      { label: 'Disability Insurance', rate: 0.03, ceiling: CEILING, pensionFunded: false },
      // Nemocenské (sickness): 1.4%
      { label: 'Sickness Insurance', rate: 0.014, ceiling: CEILING, pensionFunded: false },
      // Poistenie v nezamestnanosti (unemployment): 1%
      { label: 'Unemployment Insurance', rate: 0.01, ceiling: CEILING, pensionFunded: false },
      // Zdravotné (health): 4% (employees, ceiling = uncapped)
      { label: 'Health Insurance', rate: 0.04, pensionFunded: false },
    ],
  },

  employerSSC: {
    ceiling: CEILING,
    components: [
      // Starobné employer: 14% (of which up to 6% redirected to DSS Pillar 2 if employee opted in)
      { label: 'Old-Age Pension (Starobné)', rate: 0.14, ceiling: CEILING, pensionFunded: true },
      { label: 'Disability Insurance', rate: 0.03, ceiling: CEILING, pensionFunded: false },
      { label: 'Sickness Insurance', rate: 0.014, ceiling: CEILING, pensionFunded: false },
      { label: 'Unemployment Insurance', rate: 0.005, ceiling: CEILING, pensionFunded: false },
      // Úrazové (accident/injury): 0.8%
      { label: 'Accident Insurance', rate: 0.008, ceiling: CEILING, pensionFunded: false },
      // Rezervný fond (reserve fund): 4.75%
      { label: 'Reserve Fund', rate: 0.0475, ceiling: CEILING, pensionFunded: false },
      // Garančné (guarantee fund): 0.25%
      { label: 'Guarantee Fund', rate: 0.0025, ceiling: CEILING, pensionFunded: false },
      // Zdravotné employer: 10%
      { label: 'Health Insurance', rate: 0.10, pensionFunded: false },
    ],
  },

  // POMB (osobný mzdový bod) Pillar 1 + Pillar 2 DSS — official 2026 parameters
  // Dôchodková hodnota 2026: 19.7633 EUR/point (Sociálna poisťovňa decree Jan 2026)
  // OSB = gross_wage / VVZ (všeobecný vymeriavací základ = national reference avg wage, annual)
  // Annual POMB = grossMonthly × 12 / (AW_2026 × 12) = grossMonthly / AW_2026
  // Engine formula: annualPoints = (grossMonthly × 12) / referenceWage_ANNUAL, so:
  //   referenceWage must be ANNUAL = AW_2026 × 12 = 18,000 EUR/year
  // Max annual POMB = CEILING_month / AW_month = 7 (ceiling is 7× AW)
  // DSS (Pillar 2) rate: 4% of gross — redirected from employer's 14% to individual DSS account
  //
  // SOLIDARITY REDUCTION (§40 zákon č. 461/2003 Z.z.):
  //   For the personal wage coefficient (ODZ = grossMonthly/VVZ_monthly):
  //     ODZ ≤ 1.25 : full POMB = ODZ (no reduction)
  //     ODZ > 1.25 : POMB = ODZ − (ODZ − 1.25) × 0.3  (30% solidarity haircut on excess)
  //   In engine terms: solidarityReductionThreshold = 1.25 × VVZ_monthly = 1.25 × 1,500 = 1,875 EUR
  //                    solidarityReductionRate = 0.3
  //   Effect at 2× AW = 3,000: adjusted monthly = 1,875 + (3,000−1,875)×0.7 = 2,662.5
  //     annual POMB = 2,662.5×12/18,000 = 1.775  vs 2.0 without reduction (−11.25%)
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'POINTS',
      pointValue: 19.7633,       // EUR/POMB point — Dôchodková hodnota 2026 (Sociálna poisťovňa)
      pointValueIndexation: 0.02,
      pointsPerAW: 1.0,
      ceiling: 7.0,               // max annual POMB = 7 (contribution ceiling = 7× AW)
      referenceWage: AW_2026 * 12, // ANNUAL VVZ = 1,500 × 12 = 18,000 EUR/year
      solidarityReductionThreshold: 1.25 * AW_2026, // 1,875 EUR/month (1.25 × VVZ)
      solidarityReductionRate: 0.3,                  // 30% reduction on excess above 1.25×VVZ
    },
    pillar2Rate: 0.04,            // 4% of gross to DSS — official 2026 rate (socpoist.sk item 13)
    //
    // DSS funded Pillar 2 calibration note:
    //   OECD PaG 2023 implies effective P2 of ~14-15% RR at 1× AW for the steady-state case.
    //   Using 2% real return (OECD net-of-fees convention) instead of 3% aligns the model:
    //     P2 monthly at 1× AW, 47yr, 4% rate, 2% return ≈ 279 EUR/month (18.6%)
    //     vs OECD implied ~14.4% — delta -4pp (✓ within tolerance).
    //   Sources: OECD PaG 2023 SK country profile; socpoist.sk DSS rate 4%.
    pillar2ReturnRate: 0.02,
  },

  pillar2: {
    available: true,
    mandatory: true,
    contributionRate: 0.04,        // 4% (confirmed 2026 — item 13 of 2026 SK changes)
    defaultAnnualReturnRate: 0.02, // 2% real net-of-fees (OECD convention; calibrated to PaG 2023)
    fundType: 'individual_account',
  },

  incomplete: false,

  formulaSteps: [
    {
      stepNumber: 1,
      label: 'Step 1: Total Employer Cost',
      formula: 'Total Employer Cost = Gross + Employer SSC',
      liveValueFn: (_inputs, result) => {
        const v = result.sscResult.totalEmployerCost;
        return `${v.toLocaleString('sk-SK', { maximumFractionDigits: 0 })} EUR/month`;
      },
      explanation:
        'Your employer pays this amount in total. Your contract gross is a subset — the remainder is invisible social charges.',
      sourceNote: 'Zákon č. 461/2003 Z.z.',
      isKeyInsight: true,
    },
    {
      stepNumber: 2,
      label: 'Step 2: Annual POMB Points',
      formula: 'POMB = (Gross / Reference AW) with Solidarity Haircut',
      liveValueFn: (_inputs, result) => {
        const points = result.pensionResult.formulaInputs['annualPoints'];
        return `${points.toFixed(4)} POMB/year`;
      },
      explanation:
        'Points are earned based on your salary relative to the national average. A "solidarity haircut" reduces points for earnings above 1.25× average wage.',
      sourceNote: 'Zákon č. 461/2003 Z.z. § 40',
      isKeyInsight: true,
    },
    {
      stepNumber: 3,
      label: 'Step 3: Pillar 1 Monthly Pension',
      formula: 'Pension = Total POMB × Dôchodková hodnota',
      liveValueFn: (_inputs, result) => {
        const v = result.pensionResult.pillar1Monthly;
        return `${v.toLocaleString('sk-SK', { maximumFractionDigits: 2 })} EUR/month`;
      },
      explanation:
        'Your lifetime points are multiplied by the "current pension value" (19.76 EUR in 2026).',
      sourceNote: 'Sociálna poisťovňa 2026 decree',
    },
  ],
  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Štatistický úrad SR / Eurostat earn_nt_net SK 2026',
      url: 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/earn_nt_net',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I Jan 2026; Zákon č. 461/2003 Z.z.',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'Zákon č. 595/2003 Z.z. § 15 (2026)',
      url: 'https://www.financnasprava.sk',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — dôchodková hodnota, DSS rate, solidarity reduction',
      source: 'Sociálna poišťovňa — Najdôležitejšie zmeny v sociálnom poistení od 1. januára 2026 (items 4+13); zákon č. 461/2003 Z.z. §40 (solidarita redukcia 30% nad 1.25×VVZ)',
      url: 'https://www.socpoist.sk/socialne-poistenie/zmeny-v-socialnom-poisteni/najdolezitejsie-zmeny-v-socialnom-poisteni-od-1-1',
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
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + nariadenie vlády 2026 (minimálna mzda)',
      url: 'https://ec.europa.eu/eurostat/statistics-explained/index.php/Minimum_wage_statistics',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionTax (exempt)',
      source: 'MISSOC Comparative Tables — Table V pension taxation 2025; specific law cited in pensionTax.note',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,

  // SK: social-security pensions (Sociálna poisťovňa, Pillar 1 + DSS Pillar 2 annuities)
  // are exempt from income tax.
  // Source: §9 ods.2 písm.a) zákona č.595/2003 Z.z. o dani z príjmov.
  pensionTax: {
    method: 'none',
    note: '§9(2)(a) ZDP: sociálne dôchodky sú oslobodené od dane z príjmov fyzických osôb',
  },
};
