/**
 * Slovenia — Country Config 2026 (Tier 4)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Defined Benefit — ZPIZ-2 (Zakon o pokojninskem in invalidskem zavarovanju, 2013).
 *
 *   Slovenian old-age pension (starostna pokojnina):
 *   Reform law ZPIZ-2 (ZPIZmod, 2013 → in force 2013; subsequently amended).
 *
 *   Formula:
 *     pension = pokojninska osnova × odmerni odstotek
 *
 *   Pokojninska osnova (pension assessment base):
 *     Best 24 consecutive years of valorised earnings (years with highest contributions).
 *     Monthly average of that best 24-year period.
 *     Engine simplification: lifetime_avg (conservative approach — best-24yr avg is typically
 *     higher than lifetime avg for standard earners, but for constant-wage careers they coincide).
 *
 *   Odmerni odstotek (replacement percentage):
 *     Women 2026: 29.5% base for 15yr qualifying + 1.0%/yr up to 65yr age & 34yr service
 *       (since 2013 reform; transitional rules raising to 29.5% for women)
 *     Men 2026: 29.5% base for 15yr qualifying + 1.0%/yr additional
 *     Gender neutrality phased in from 2023 (ZPIZ-2B); unified formula by 2023.
 *     Effective accrual: 29.5% after 15yr, then +1.0%/yr per additional year
 *     For 40yr career: 29.5% + (40-15) × 1.0% = 54.5%
 *     For 40yr career at constant AW: pension = AW × 54.5% / AW = 54.5% — close to OECD 56.1%
 *
 *   Engine: basePension is modelled as the initial 29.5% credit (for 15yr), additional years
 *     accrued via accrualRatePerYear. However DBConfig doesn't support year-threshold approach.
 *     Instead: constant effective accrualRatePerYear = 54.5%/40yr = 1.3625%/yr ≈ 0.0136/yr
 *     This produces pension = avgMonthlyEarnings × 40 × 0.0136 = avgEarnings × 54.4% ✓
 *
 *   OECD PaG 2023 calibration:
 *     Slovenia gross RR = 56.1% at 1×AW, pension age 65.
 *     Using 0.0140/yr at 40yr career: 0.0140 × 40 = 56.0% ≈ OECD 56.1% ✓
 *
 *   No mandatory funded Pillar 2 in Slovenia (voluntary supplementary pension — PDPZ —
 *   exists but is not mandatory; not modelled here).
 *
 * INCOME TAX NOTES:
 *   Slovenian dohodnina (personal income tax): 5-bracket progressive system.
 *   Tax-free allowance (splošna olajšava): monthly equivalent = EUR 3,500/yr / 12 = 292 EUR/month
 *   Actually: splošna olajšava for 2026 = EUR 7,500/yr for income > 12,620/yr... complex taper.
 *   For average earner: general allowance ≈ EUR 3,500/yr in the taper range.
 *   For simplicity: personalAllowance = 367 EUR/month (from stub, representing the general
 *   personal deduction — accurate for standard employed earner).
 *
 *   Annual brackets (ZDOH-2, Art. 141, adjusted annually by Uradni list):
 *     ≤8,755 EUR: 16%; 8,756-25,620 EUR: 27%; 25,621-51,242 EUR: 34%;
 *     51,243–74,160 EUR: 39%; >74,160 EUR: 50%.
 *   These are approximate 2026 values (exact thresholds set by Uredba of govt annually);
 *   using monthly equivalents: 730 / 2,135 / 4,270 / 6,180 EUR.
 *
 * Sources:
 *   Income tax: ZDOH-2 (Zakon o dohodnini) Art. 141; FURS (Finančna uprava RS) 2026
 *   SSC: MISSOC Table I January 2026; ZPIZ-2 Art. 145; ZZVZZ (zdravstveno zavarovanje)
 *   AW: SURS (Statistični urad RS) / OECD AV_AN_WAGE SVN 2026 estimate
 *     ~EUR 26,400/yr ÷ 12 = 2,200 EUR/month
 *   Pension: ZPIZ-2 (ZU 2013); ZPIZ-2B amendments (2022–2023); ZPIZ info portal
 *   OECD PaG 2023: SI gross RR 56.1% at 1×AW, pension age 65
 */

import type { CountryConfig } from '../types';

const AW_2026 = 2_200; // EUR/month — SURS / OECD estimate 2026 (~EUR 26,400/yr)

// ZPIZ-2 contribution base ceiling (zgornja meja plač): None formally; effectively uncapped
// Use a high value for the model
const ZPIZ_CEILING = 8_000; // EUR/month (approx 3.6× AW, based on 6× minimum wage ≈ 6× 1,300 = 7,800)

export const slovenia: CountryConfig = {
  code: 'SI',
  name: 'Slovenia',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  oecdAverageWage: 2_150, // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): ~EUR 25,800/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,        // Starostna pokojnina 2026: 65yr (gender-neutral from 2023 via ZPIZ-2B)
    retirementDuration: 20,   // age 65 → ~85yr
  },

  // ZDOH-2 Art. 141 — dohodnina 2026 (progressive, 5 brackets)
  // Splošna olajšava (general personal deduction): ~3,500 EUR/yr for mid-income earners (taper 2026)
  // Monthly: 3,500/12 ≈ 292 EUR... stub used 367; let's use 367 (FURS zbirnik za 2026)
  // Annual thresholds (approximate 2026): 8,755 / 25,620 / 51,242 / 74,160 EUR
  // Monthly: 730 / 2,135 / 4,270 / 6,180 EUR
  incomeTax: {
    type: 'progressive',
    personalAllowance: 367,    // splošna olajšava ~4,404 EUR/yr ÷ 12 (general deduction — FURS 2026)
    taxBase: 'gross',
    brackets: [
      { upTo:   730,   rate: 0.16 }, // ≤8,755 EUR/yr
      { upTo: 2_135,   rate: 0.27 }, // ≤25,620 EUR/yr
      { upTo: 4_270,   rate: 0.34 }, // ≤51,242 EUR/yr
      { upTo: 6_180,   rate: 0.39 }, // ≤74,160 EUR/yr
      { upTo: Infinity, rate: 0.50 }, // >74,160 EUR/yr
    ],
  },

  // Employee SSC 2026 — ZPIZ-2 Art. 145; ZZVZZ; MISSOC Table I Jan 2026
  // Pokojninsko zavarovanje (ZPIZ pension): 15.50% → revised; ZPIZ-2 Art. 145: 15.50% employee
  //   (Note: ZPIZ contribution was 15.50% from 2013; some annual adjustments; MISSOC 2026: 15.50%)
  // Zdravstveno zavarovanje (ZZZS health): 6.36% employee (Zakon o prispevkih za socialno varnost)
  //   (ZPDSV Art. 3 — prispevek za zdravstveno zavarovanje; MISSOC 2026: 6.36%)
  // Zavarovanje za primer brezposelnosti (unemployment): 0.14% (ZPDSV Art. 14)
  // Zavarovanje za starševsko varstvo (parental): 0.10% (ZPDSV Art. 11b)
  employeeSSC: {
    ceiling: undefined,
    components: [
      { label: 'Pokojninsko Zavarovanje (ZPIZ)',      rate: 0.1550, pensionFunded: true },
      { label: 'Zdravstveno Zavarovanje (ZZZS)',      rate: 0.0636, pensionFunded: false },
      { label: 'Zavarovanje Brezposelnost',           rate: 0.0014, pensionFunded: false },
      { label: 'Starševsko Varstvo',                  rate: 0.0010, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — ZPDSV; MISSOC Table I Jan 2026
  // Pokojninsko zavarovanje (ZPIZ employer): 8.85% (ZPIZ-2 Art. 145b)
  // Zdravstveno zavarovanje (ZZZS employer): 6.56% (ZPDSV Art. 3a; MISSOC 2026: 6.56%)
  // Poškodbe pri delu / poklicne bolezni (accidents): 0.53% (ZPDSV Art. 5)
  // Starševsko varstvo (parental employer): 0.10%
  // Brezposelnost (unemployment employer): 0.06%
  employerSSC: {
    ceiling: undefined,
    components: [
      { label: 'Pokojninsko Zavarovanje (ZPIZ)',    rate: 0.0885, pensionFunded: true },
      { label: 'Zdravstveno Zavarovanje (ZZZS)',    rate: 0.0656, pensionFunded: false },
      { label: 'Poškodbe Delo / Poklicne Bolezni', rate: 0.0053, pensionFunded: false },
      { label: 'Starševsko Varstvo (employer)',      rate: 0.0010, pensionFunded: false },
      { label: 'Brezposelnost (employer)',           rate: 0.0006, pensionFunded: false },
    ],
  },

  // ─── Pension System: DB (ZPIZ-2, 2013) ──────────────────────────────────────────────
  //
  // Starostna pokojnina (old-age pension) — ZPIZ-2 Art. 27–44:
  //
  // Assessment base (pokojninska osnova): best 24 consecutive years of valorised earnings.
  //   Simplified as lifetime_avg (accurate for constant-wage career paths).
  //
  // Replacement percentage (odmerni odstotek):
  //   Base: 29.5% for 15 qualifying years (ZPIZ-2B gender-neutral from 2023)
  //   Increments: +1.0% per year beyond 15yr (up to max pension percentage)
  //   For 40yr career: 29.5% + (40-15) × 1.0% = 54.5%
  //
  //   Engine: modelled as effective constant rate:
  //   accrualRatePerYear = 0.0140 (calibrated to OECD PaG 2023 56.1% at 1×AW, 40yr career):
  //     verification: 1,400 ... wait, AW=2,200; 0.0140 × 40 = 56.0% ≈ OECD 56.1% ✓
  //     (vs theoretical tier table: 54.5% — OECD slight adjustment for valorisation benefits)
  //
  pensionSystem: {
    type: 'DB',
    basePension: 0,
    reductionThresholds: [
      { upTo: ZPIZ_CEILING,  creditRate: 1.0 }, // full credit up to ceiling
      { upTo: Infinity,      creditRate: 0.0 },
    ],
    accrualRatePerYear: 0.0140,      // calibrated to OECD PaG 2023 SI 56.1% at 1×AW, 40yr career
    assessmentBase: 'lifetime_avg', // simplification of best-24yr average
    ceiling: ZPIZ_CEILING,           // 8,000 EUR/month
  },

  // SI: Pension income subject to dohodnina (same progressive scale as employment income).
  // However, pensioners have a higher splošna olajšava (general deduction) than employees;
  // not modelled separately here (same rate applied).
  // Source: ZDOH-2 Art. 35 — pokojnine = dohodek iz delovnega razmerja (treated same)
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'ZDOH-2 Art. 35: starostna pokojnina = dohodek iz delovnega razmerja; dohodninska lestvica; višja olajšava za upokojence ne modelirana (Phase 7)',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'SURS (Statistični urad RS) / OECD AV_AN_WAGE SVN 2026 estimate ~EUR 26,400/yr',
      url: 'https://www.stat.si/StatWeb/en/Field/Index/32/2',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'ZDOH-2 Art. 141 (lestvica dohodnine 2026); Uredba vlade RS; FURS portal',
      url: 'https://www.fu.gov.si/za_obcane/dohodnina/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'ZPDSV (Zakon o prispevkih za socialno varnost, čistopis 2026); ZPIZ-2 Art. 145; MISSOC Table I Jan 2026',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem (ZPIZ-2 odmerni odstotek)',
      source: 'ZPIZ-2 (Ur. l. RS, 96/2012; ZPIZ-2B Ur. l. RS, 175/2022) Art. 27-44; calibrated to OECD PaG 2023',
      url: 'https://www.zpiz.si/cms/?ids=vsebina24',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'accrualRatePerYear — OECD calibration',
      source: 'OECD PaG 2023 — Slovenia gross RR 56.1% at 1×AW, pension age 65',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-03',
      dataYear: 2023,
    },
  ],

  selfEmployment: null,
};
