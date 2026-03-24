/**
 * Denmark — Country Config 2026 (Tier 3)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: MIXED — Folkepension (flat-rate state pension) + mandatory
 *   occupational pension (arbejdsmarkedspension / ATP).
 *
 *   Pillar 1 — Folkepension (flat-rate, residency-based state pension)
 *     2026 grundbeløb (basic amount, full pension for 40yr resident): ~7,000 DKK/month
 *     Means-tested pensionstillæg excluded (applies to pensioners with minimal other income only).
 *     Source: Ankestyrelsen / BEK nr 1207 af 08/07/2021 (pension regulation decrees); annual regulation.
 *     Engine: DBConfig basePension=7,000, accrualRate=0 (not earnings-related).
 *
 *   Pillar 2 — Mandatory Occupational Pension (arbejdsmarkedspension)
 *     Standard split (private sector, collective agreements): ~12% total (8% employer + 4% employee).
 *     Funded individual accounts, invested via ATP / commercial pension funds.
 *     pillar2Rate = 0.12, pillar2ReturnRate = 0.030 (3.0% real net-of-fees; model uses constant prices — historical net 4–6% nominal excluded).
 *     ATP (Arbejdsmarkedets Tillægspension): fixed flat monthly contribution (minor component).
 *     ATP contributions captured in SSC components; ATP benefit omitted from pension formula
 *     (ATP pensionsbeholdning is small relative to occupational pension).
 *
 * INCOME TAX NOTES:
 *   Danish income tax has three layers: AM-bidrag (8%), bundskat + kommuneskat, and topskat.
 *   AM-bidrag (arbetsmarkedsbidrag) = 8% of gross — modelled as employee SSC (pension-unfunded).
 *   Income tax is computed on after-AM-bidrag income. To use taxBase='gross', bracket rates are
 *   adjusted to their effective-on-gross equivalents:
 *     bottom rate (bundskat 12.01% + avg kommuneskat 25.0%) × 0.92 = 34.05% on gross
 *     topskat (15%) × 0.92 = 13.8% additional above top threshold
 *     combined above top: 47.85% on gross
 *   Top tax (topskat) threshold 2026: ~552,500 DKK/year after-AM-bidrag
 *     = 552,500 / 0.92 = ~600,540 DKK/year gross = 50,045 DKK/month gross.
 *   Personfradrag (basic personal allowance) 2026: ~51,800 DKK/year = 4,317 DKK/month.
 *     Modelled as personalAllowance = 4,317 DKK/month (deduction from gross — slight approximation;
 *     it is technically deducted from after-AM income, adjusted by × 0.92 for accuracy in Phase 7).
 *   Avg kommuneskat 2026: ~25.0% (national weighted mean; range 22.8–27.8%).
 *
 * Sources:
 *   AW: Danmarks Statistik — Earnings survey / OECD Avg Wages DK 2024 ~580,000 DKK/yr; 2026 ~600,000
 *   EUR/DKK: ECB fixed peg maintained at ~7.46 (CNB intervention band ≤±2.25%)
 *   Income tax: Skatteministeriet — personskatteloven (PSL); Ligningsloven 2026 takstoversigt
 *   Kommuneskat avg: KORA/VIVE / Skatteministeriet kommunale skatter 2026
 *   SSC: MISSOC Table I Jan 2026; ATP lov nr 857 af 01/07/2020
 *   Folkepension: BEK nr 1207 / Lov om social pension; Ankestyrelsen satser 2026
 *   Occupational pension: DA (Dansk Arbejdsgiverforening) standardoverenskomst; Pensionsinfo.dk
 */

import type { CountryConfig } from '../types';

const AW_2026  = 50_000; // DKK/month — Danmarks Statistik 2026 estimate
const EUR_DKK  = 7.46;   // ECB reference — DKK pegged to EUR (±2.25% band)

// Folkepension grundbeløb 2026 (single person, full 40yr residency)
// 2025: 82,536 DKK/yr = 6,878 DKK/mo; 2026 regulated estimate: ~84,000 DKK/yr = 7,000 DKK/mo
const FOLKEPENSION = 7_000; // DKK/month

// Top tax (topskat) threshold in gross-equivalent terms 2026
// After-AM-bidrag threshold ~552,500 DKK/yr → gross: 552,500 / 0.92 ≈ 600,543 DKK/yr ÷ 12
const TOPSKAT_THRESHOLD_GROSS = Math.round(600_543 / 12); // ~50,045 DKK/month

export const denmark: CountryConfig = {
  code: 'DK',
  name: 'Denmark',
  currency: 'DKK',
  eurExchangeRate: EUR_DKK,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 41_500,         // DKK/month — Eurostat SES / Danmarks Statistik 2022 adj. to 2026
  wagePercentiles: {            // DKK/month — Eurostat SES / Danmarks Statistik 2022 adj. to 2026
    p10: 26_000, p25: 32_500, p75: 53_000, p90: 72_000,
  },
  minimumWage: 25_000,          // DKK/month — effective collective floor (HK / 3F overenskomst 2026)
  oecdAverageWage: 52_998,  // DKK/month — OECD Taxing Wages 2025, Table I.1 (2024): DKK 635,976/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 67,      // Folkepensionsalder 2026: 67 (rising to 68 by 2030)
    retirementDuration: 18, // age 67 to ~85 (Danish LE at 67 ≈ 18yr)
  },

  // Skatteministeriet — 2026 income tax
  // All rates expressed as effective rates on gross (accounting for AM-bidrag reducing tax base by 8%).
  // Bundskat 12.01% + avg kommuneskat 25.0% = 37.01% on after-AM = 37.01% × 0.92 = 34.05% on gross.
  // Topskat 15% on excess above threshold = 15% × 0.92 = 13.80% additional on gross.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 4_317, // personfradrag: 51,800 DKK/yr ÷ 12 (applied to gross as approximation)
    taxBase: 'gross',
    brackets: [
      { upTo: TOPSKAT_THRESHOLD_GROSS, rate: 0.3405 }, // bundskat + kommuneskat effective on gross
      { upTo: Infinity,                rate: 0.4785 }, // + topskat 15% on gross above threshold
    ],
  },

  // Employee SSC 2026 — MISSOC Table I Jan 2026; ATP lov
  employeeSSC: {
    ceiling: undefined,
    components: [
      // AM-bidrag (arbejdsmarkedsbidrag): 8% of gross — labour market levy; NOT pension-funded
      // This reduces the income tax base (gross - AmbB = 92% base for income tax).
      { label: 'AM-bidrag (Labour Market Contribution)', rate: 0.080, pensionFunded: false },
      // ATP employee contribution: flat ~99 DKK/month for full-time (modelled as ~0.20% of AW)
      { label: 'ATP (Labour Market Pension)', rate: 0.0020, pensionFunded: true },
      // Obligatory occupational pension — employee share: 4% of gross (collective agreements)
      { label: 'Occupational Pension (employee 4%)', rate: 0.040, pensionFunded: true },
    ],
  },

  // Employer SSC 2026 — MISSOC Table I Jan 2026; ATP lov; DA standard
  employerSSC: {
    ceiling: undefined,
    components: [
      // ATP employer contribution: flat ~197 DKK/month for full-time (modelled as ~0.39% of AW)
      { label: 'ATP (Labour Market Pension)', rate: 0.0039, pensionFunded: true },
      // Obligatory occupational pension — employer share: 8% of gross
      { label: 'Occupational Pension (employer 8%)', rate: 0.080, pensionFunded: true },
      // AES (Arbejdsmarkedets Erhvervssikring — work accident): ~0.3% sector average
      { label: 'Work Accident Insurance (AES)', rate: 0.003, pensionFunded: false },
      // Finansieringsbidrag (various labour market funds + barsel): ~0.3%
      { label: 'Labour Market / Parental Funds', rate: 0.003, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (Folkepension DB-flat + Occupational funded) ──────────────
  //
  // Pillar 1 — Folkepension (non-earnings-related state pension)
  //   Engine: DBConfig with basePension = FOLKEPENSION, accrualRate = 0.
  //   The full grundbeløb is paid to all workers with 40yr Danish residency.
  //   Means-tested pensionstillæg (up to ~7,800 DKK/mo for singles) excluded — applies mainly
  //   to those with limited other income; not relevant for average-earner model.
  //
  // Pillar 2 — Mandatory Occupational Pension
  //   12% total contribution rate (employer 8% + employee 4%).
  //   Historical net real return of Danish pension funds: ~4–6%. Using 3.5% conservative.
  //   Annuitisation over 20yr (engine default) at same 3.5% return.
  //
  // Calibration at 1× AW = 50,000 DKK, 42yr career (25→67), 3.5% return:
  //   folkepension = 7,000 DKK (14.0% RR)
  //   pillar2: calcSimplePillar2(0.12, 50000, 42, 0.035) → ~36,000 DKK/mo (~72% RR)
  //   Total: ~86%  (OECD PaG Denmark gross RR at 1× AW: ~82.7% including all mandatory tiers)
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'DB',
      basePension: FOLKEPENSION,  // 7,000 DKK/month flat-rate state pension
      reductionThresholds: [
        { upTo: Infinity, creditRate: 0.0 }, // not earnings-related — only basePension counts
      ],
      accrualRatePerYear: 0.0,    // flat-rate; no earnings-related accrual
      assessmentBase: 'monthly_avg',
      ceiling: 100_000,           // irrelevant (accrualRate=0), set large
    },
    pillar2Rate: 0.12,            // 12% total occupational contribution (employer 8% + employee 4%)
    pillar2ReturnRate: 0.030,     // 3.0% real net-of-fees — model uses constant prices; within OECD 2-3% convention
  },

  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'PSL §§4–4a: folkepension and occupational pension both taxed as personal income (A-indkomst) at normal rates; pensioners eligible for ældrecheck (minor) — not modelled',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Danmarks Statistik Lønstruktur 2024; OECD Average Wages DK 2024 trend to 2026',
      url: 'https://www.dst.dk/da/Statistik/emner/arbejde-og-indkomst/loen',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'eurExchangeRate',
      source: 'ECB SDMX-REST EXR — DKK/EUR fixed peg; Danmarks Nationalbank ECB intervention 2026',
      url: 'https://data-api.ecb.europa.eu/service/data/EXR/M.DKK.EUR.SP00.A',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax.brackets',
      source: 'Skatteministeriet — Takstoversigt 2026; Personskatteloven § 6 (bundskat), § 7c (topskat)',
      url: 'https://skat.dk/borger/skat-paa-din-indkomst/takstoversigt',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I Jan 2026; ATP lov nr 857 af 01/07/2020; DA standardoverenskomst 2026',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — folkepension grundbeløb 2026',
      source: 'Ankestyrelsen — satsvejledning 2026; BEK om regulering af folkepension',
      url: 'https://www.borger.dk/pension-og-efterloen/folkepension',
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
      source: 'MISSOC Comparative Tables 2026 + dominant sector collective agreement (DK: no national statutory minimum)',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.pillar2Rate (occupational kvote)',
      source: 'OECD Pensions at a Glance 2023 — Denmark chapter; Sampension / Industriens Pension default rate 12%',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-01',
      dataYear: 2023,
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
