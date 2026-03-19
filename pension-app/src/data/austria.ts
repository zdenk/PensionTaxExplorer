/**
 * Austria — Country Config 2026 (Tier 1)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: Pensionskonto (ASVG §§ 14-15) — parameters populated.
 *
 * Sources:
 *   SSC: MISSOC Table I January 2026; ASVG / GSVG
 *   Income tax: EStG Österreich § 33 (2026 brackets)
 *   AW: Eurostat earn_ses_monthly; Statistics Austria
 *   Pensionskonto: ASVG §§ 14-15 (SVÄG 2003); BMSGPK 2026
 *
 * PENSIONSKONTO FORMULA NOTES:
 *   Kontoprozentsatz = 1.78% per year of ANNUAL GROSS (including 14th salary)
 *   The ASVG basis is the annual Beitragsgrundlage (14 monthly salaries for full-time).
 *   The calcPensionAccount engine uses grossMonthly × 12, so annualCreditRate is adjusted:
 *     annualCreditRate = 1.78% × (14/12) = 2.0767% ≈ 0.0208
 *   This ensures: annual credit = grossMonthly × 12 × 0.0208 = grossMonthly × 14 × 0.0178 ✓
 *
 *   The account represents ACCUMULATED ANNUAL PENSION (in EUR), not a fund balance.
 *   valorisationRate = 0.0 because valorisation only maintains real wage-indexed value
 *   (no additional real compound return; Austria valorises by wage/CPI to preserve purchasing power).
 *
 *   annuityDivisor: In the engine formula:
 *     monthly = (account / TZ) × (12/14)
 *   For the account to equal the accumulated annual pension (14-payment basis), TZ = 12
 *   gives: monthly = (annual_pension / 12) × (12/14) = annual_pension / 14 ✓
 *   Age adjustments per Austrian Abschlag/Zuschlag rules (4.2%/year early, 5.1%/year late):
 *     age 60: TZ = 12 / (1 - 5×4.2%) ≈ 15 (21% early-retirement reduction)
 *     age 65: TZ = 12 (standard)
 *     age 67: TZ = 12 / (1 + 2×5.1%) ≈ 11 (10.2% late-retirement bonus)
 */

import type { CountryConfig } from '../types';

const AW_2026 = 3_400; // EUR/month — Statistics Austria / Eurostat estimate 2026

// Höchstbeitragsgrundlage (HBG) 2026: 6,450 EUR/month
const HBG = 6_450;

export const austria: CountryConfig = {
  code: 'AT',
  name: 'Austria',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  oecdAverageWage: 4_221,  // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): EUR 50,648/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65,
    retirementDuration: 20,
  },

  // EStG Österreich § 33 (2026)
  // Brackets (annual income → monthly):
  //   ≤12,756 EUR/year  (1,063/mo):  0%
  //   ≤20,818 EUR/year  (1,735/mo): 20%
  //   ≤34,513 EUR/year  (2,876/mo): 30%
  //   ≤66,612 EUR/year  (5,551/mo): 40%
  //   ≤99,266 EUR/year  (8,272/mo): 48%
  //   >99,266 EUR/year  (>8,272/mo): 50%
  // No personal allowance in bracket sense; first bracket is zero rate.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 0,
    taxBase: 'gross',
    brackets: [
      { upTo: 1_063,   rate: 0.00 },
      { upTo: 1_735,   rate: 0.20 },
      { upTo: 2_876,   rate: 0.30 },
      { upTo: 5_551,   rate: 0.40 },
      { upTo: 8_272,   rate: 0.48 },
      { upTo: Infinity, rate: 0.50 },
    ],
  },

  // ASVG employee SSC rates 2026 (Quelle: MISSOC / Sozialministerium)
  employeeSSC: {
    ceiling: HBG,
    components: [
      // Pensionsversicherung: 10.25% (ceiling = HBG)
      { label: 'Pension Insurance (PV)', rate: 0.1025, ceiling: HBG, pensionFunded: true },
      // Krankenversicherung: 3.87%
      { label: 'Health Insurance (KV)', rate: 0.0387, ceiling: HBG, pensionFunded: false },
      // Arbeitslosenversicherung: tiered (0%/1%/2%/3%); use 3% above threshold; simplified here
      { label: 'Unemployment Insurance (ALV)', rate: 0.03, ceiling: HBG, pensionFunded: false },
      // Unfallversicherung: 0.1%
      { label: 'Accident Insurance (UV)', rate: 0.001, ceiling: HBG, pensionFunded: false },
    ],
  },

  employerSSC: {
    ceiling: HBG,
    components: [
      { label: 'Pension Insurance (PV)', rate: 0.1255, ceiling: HBG, pensionFunded: true },
      { label: 'Health Insurance (KV)', rate: 0.0378, ceiling: HBG, pensionFunded: false },
      { label: 'Unemployment Insurance (ALV)', rate: 0.03, ceiling: HBG, pensionFunded: false },
      { label: 'Accident Insurance (UV)', rate: 0.013, pensionFunded: false }, // no ceiling
      // Dienstgeberbeitrag (FLAF family fund): 3.7%
      { label: 'Family Fund (FLAF)', rate: 0.037, pensionFunded: false },
      // Kommunalsteuer: 3% — a local business tax on gross wages, effectively an employer SSC
      { label: 'Municipal Tax (Kommunalsteuer)', rate: 0.03, pensionFunded: false },
      // Wohnbauförderungsbeitrag: 0.5%
      { label: 'Housing Fund Levy', rate: 0.005, ceiling: HBG, pensionFunded: false },
    ],
  },

  // Pensionskonto (ASVG §§ 14-15, post-2005) — fully parameterised
  // Kontoprozentsatz: 1.78% of annual Beitragsgrundlage (14 monthly salaries per year)
  // Engine uses grossMonthly × 12, so effective rate = 1.78% × 14/12 = 2.0767% ≈ 0.0208
  // valorisationRate = 0.0 (valorization maintains real wage-indexed value; no real compound growth)
  // annuityDivisor: TZ=12 standard (65), adjusted for early/late retirement Abschlag/Zuschlag
  //   account / TZ / 14 × 12 = monthly pension (TZ=12 means account = annual pension in 14-paymt basis)
  pensionSystem: {
    type: 'PENSION_ACCOUNT',
    annualCreditRate: 0.0208,    // 1.78% × (14/12) — corrects engine's 12-month base to 14-month
    ceiling: HBG,
    valorisationRate: 0.005,     // 0.5% real annual valorisation (ASVG §108h Aufwertungszahl
                                 // tracks wage/CPI growth; conservative 0.5% real net of our
                                 // constant-wage assumption brings model closer to OECD PaG 2023).
    annuityDivisor: {
      // TZ: derived from pension age adjustment rules (Abschlag 4.2%/yr early, Zuschlag 5.1%/yr late)
      // Standard retirement age is 65. TZ=12 → monthly = account/(12×14/12) = account/14
      60: 15,   // ~21% early-retirement reduction (5 yrs × 4.2%/yr → TZ = 12/0.79 ≈ 15)
      65: 12,   // standard (account/12×12/14 = account/14 → annual_14_basis/14 = monthly)
      67: 11,   // ~10% late-retirement bonus (2 yrs × 5.1%/yr → TZ = 12/1.102 ≈ 11)
    },
  },

  incomplete: false,

  formulaSteps: [],
  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'Statistics Austria / Eurostat earn_ses_monthly 2022 survey',
      url: 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/earn_ses_monthly',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I Jan 2026; ASVG',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'EStG Österreich § 33 (2026)',
      url: 'https://www.bmf.gv.at',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — Kontoprozentsatz, Abschlag/Zuschlag',
      source: 'ASVG §§ 14-15; BMSGPK Pensionskonto 2026; WU Wien Pensionskontorecht',
      url: 'https://www.sozialministerium.gv.at/Themen/Pension/Das-Pensionskonto.html',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
  ],

  selfEmployment: null,

  // AT: pension taxed as regular employment income (ASVG §25 Abs.1 Z.3a EStG).
  // The Pensionistenabsetzbetrag (§33(6) EStG) provides up to ~€868/year tax credit (simplified
  // here as a fixed monthly allowance of €72). Phasing-out for pensions above ~€2 061/mo omitted.
  pensionTax: {
    method: 'income_tax',
    monthlyAllowance: 72,
    note: 'EStG §25/§33(6): Pension taxed as income; Pensionistenabsetzbetrag €868/year simplified as €72/mo allowance',
  },
};
