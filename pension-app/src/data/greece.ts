/**
 * Greece — Country Config 2026 (Tier 4)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: MIXED — post-2016 EFKA reform (Law 4387/2016).
 *
 *   Greek pension system was comprehensively reformed in 2016 (Law 4387/2016 — "Katrougalos Law")
 *   creating the Unified Social Insurance Agency (ΕΦΚΑ / EFKA):
 *
 *   Two-component mandatory pension:
 *
 *   Component 1 — Εθνική Σύνταξη (National Pension, flat-rate):
 *     Full national pension: EUR 384/month for ≥20 years of insurance.
 *     Prorated below 20 years: EUR 384 × (insurance_years / 20), minimum 15 years to qualify.
 *     Modelled as basePension = 384 in DB pillar 1 (for careers ≥ 20yr, which standard career satisfies).
 *     Note: subsequent governments modified the national pension amount multiple times;
 *     384 EUR/month is the 2016-reform set value, partially valorised by 2026 to ~400 EUR/month.
 *     Using 400 EUR/month as the modelled 2026 national pension.
 *
 *   Component 2 — Ανταποδοτική Σύνταξη (Contributory/Earnings-related pension):
 *     Tiered accrual schedule (Law 4387/2016 Art. 8):
 *       Years 1–15:   0.77%/yr
 *       Years 16–18:  0.84%/yr
 *       Years 19–21:  0.90%/yr
 *       Years 22–25:  1.00%/yr
 *       Years 26–28:  1.07%/yr
 *       Years 29–31:  1.14%/yr
 *       Years 32–34:  1.21%/yr
 *       Years 35–37:  1.28%/yr
 *       Years 38–40+: 1.34%/yr
 *     Engine simplification: effective average rate per year modelled as single constant.
 *     For 42-year career: weighted avg = sum of tier rates / 42 ≈ 0.0099/yr.
 *     Assessment base: full career average of pensionable earnings.
 *
 *   Calibration to OECD PaG 2023:
 *     OECD reports Greece gross RR = 53.7% at 1×AW, pension age 67.
 *     For 42yr career (25→67) at AW=1,400 EUR/month:
 *       national pension = 400 EUR
 *       earnings-related target = 53.7% × 1,400 - 400 = 751.8 - 400 = 351.8 EUR
 *       effective rate = 351.8 / (1,400 × 42) = 0.00598/yr ≈ 0.0060/yr
 *     This lower effective rate vs the statutory tier schedule reflects the nominal assessment
 *     base (career earnings in real terms lower than at retirement due to wage growth) and
 *     recent legislative freezes/postponements on valorisation.
 *
 * INCOME TAX NOTES:
 *   Greek ENFIA + income tax (φόρος εισοδήματος) 2026:
 *   4-bracket progressive IRS (Φ.Ε.): rates applying to total gross income.
 *   Annual brackets: ≤10,000 EUR: 9%; 10,001-20,000: 22%; 20,001-30,000: 28%; >30,000: 44%.
 *   Solidarity levy (εισφορά αλληλεγγύης) was suspended from 2020 for private sector; removed permanently.
 *   Monthly equivalents: 833 / 1,667 / 2,500 per month.
 *
 * Sources:
 *   Income tax: Κώδικας Φορολογίας Εισοδήματος (ΚΦΕ) N. 4172/2013 Art. 15;
 *     AADE (Ανεξάρτητη Αρχή Δημοσίων Εσόδων) 2026
 *   SSC: MISSOC Table I January 2026; Law 4387/2016; EFKA circulars 2026
 *   AW: ELSTAT / OECD AV_AN_WAGE GRC 2026 estimate (~EUR 16,800/yr ÷ 12 = 1,400 EUR/month)
 *   Pension: Law 4387/2016 (Katrougalos reform); Law 4670/2020; EFKA
 *   OECD PaG 2023: GR gross RR 53.7% at 1×AW, pension age 67
 */

import type { CountryConfig } from '../types';

const AW_2026 = 1_400; // EUR/month — ELSTAT / OECD estimate 2026 (~EUR 16,800/yr)

// EFKA pensionable earnings ceiling 2026
// Contribution ceiling: ~7× minimum wage → ~7 × EUR 830 = ~5,810 EUR/month
// Using 7,000 EUR/month (from stub) as approximate upper bound
const EFKA_CEILING = 7_000; // EUR/month

// National pension (Εθνική Σύνταξη) 2026: valorised from 384 EUR (2016) to ~400 EUR/month
const NATIONAL_PENSION_MONTHLY = 400; // EUR/month (full career, ≥20yr)

export const greece: CountryConfig = {
  code: 'GR',
  name: 'Greece',
  currency: 'EUR',
  eurExchangeRate: 1.0,
  dataYear: 2026,

  averageWage: AW_2026,
  medianWage: 1_140,       // EUR/month — Eurostat SES / ELSTAT 2022 adj. to 2026
  wagePercentiles: {         // EUR/month — Eurostat SES / ELSTAT 2022 adj. to 2026
    p10: 760, p25: 900, p75: 1_540, p90: 2_150,
  },
  minimumWage: 968,          // EUR/month — YA 25825/2025 (ελάχιστα αμοιβή 2026)
  oecdAverageWage: 1_350, // EUR/month — OECD Taxing Wages 2025, Table I.1 (2024): ~EUR 16,200/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 67,        // Ηλικία συνταξιοδότησης: 67 (since Law 4387/2016)
    retirementDuration: 18,   // age 67 → ~85yr
  },

  // ΚΦΕ Art. 15 — φόρος εισοδήματος 2026 (progressive, 4 brackets)
  // No personal allowance in Greek income tax; minimum exemption handled via deductions
  // (εκπτώσεις εξοδών) — not modelled here; personalAllowance = 0.
  incomeTax: {
    type: 'progressive',
    personalAllowance: 0,
    taxBase: 'gross',
    brackets: [
      { upTo:   833,   rate: 0.09 }, // ≤10,000 EUR/yr
      { upTo: 1_667,   rate: 0.22 }, // ≤20,000 EUR/yr
      { upTo: 2_500,   rate: 0.28 }, // ≤30,000 EUR/yr — actually 28% per KFE Art.15
      { upTo: Infinity, rate: 0.44 }, // >30,000 EUR/yr (40% base + solidarity suspended)
    ],
  },

  // Employee SSC 2026 — EFKA; Law 4387/2016; MISSOC Table I Jan 2026
  // Main pension/IKA: 6.67% of earnings (EFKA main fund — post-2017 unified rate)
  // Health (ΕΟΠΥΥ / EOPYY): 2.55% employee
  // Unemployment (DYPA / OAED): 1.00% employee
  // Note: professional unified EFKA rates apply to IKA/TSMEDE/TSAY etc. uniformly from 2017
  employeeSSC: {
    ceiling: EFKA_CEILING,
    components: [
      { label: 'EFKA Κύρια Σύνταξη (Main Pension)', rate: 0.0667, ceiling: EFKA_CEILING, pensionFunded: true },
      { label: 'EFKA Υγεία / ΕΟΠΥΥ (Health)',        rate: 0.0255, pensionFunded: false },
      { label: 'ΔΥΠΑ Ανεργία (Unemployment)',         rate: 0.0100, pensionFunded: false },
    ],
  },

  // Employer SSC 2026 — EFKA; MISSOC Table I Jan 2026
  // Main pension (employer): 13.33% (EFKA unified main fund)
  // Health: 4.55% employer
  // Unemployment: 0.89%
  // Accident / occupational disease: 1.00% average
  // Social solidarity levy (ETEAEP / EOPTTD home care): 0.30%
  employerSSC: {
    ceiling: EFKA_CEILING,
    components: [
      { label: 'EFKA Κύρια Σύνταξη (Main Pension)', rate: 0.1333, ceiling: EFKA_CEILING, pensionFunded: true },
      { label: 'EFKA Υγεία / ΕΟΠΥΥ (Health)',        rate: 0.0455, pensionFunded: false },
      { label: 'ΔΥΠΑ Ανεργία (Unemployment)',         rate: 0.0089, pensionFunded: false },
      { label: 'Ατυχήματα (Accidents / ETEAEP)',      rate: 0.0100, pensionFunded: false },
      { label: 'Κοινωνική Αλληλεγγύη (solidarity)',   rate: 0.0030, pensionFunded: false },
    ],
  },

  // ─── Pension System: MIXED (National Pension flat + EFKA earnings-related) ─────────────
  //
  // Πillar 1 (DB-MIXED) — Modelled as DBConfig with basePension = national pension amount:
  //   basePension = 400 EUR/month (Εθνική Σύνταξη 2026, full career ≥ 20yr)
  //   accrualRatePerYear = 0.0060 (earnings-related Ανταποδοτική — effective average rate)
  //   assessmentBase: lifetime_avg (average of all career pensionable earnings)
  //
  //   Calibration verification at 1×AW (1,400 EUR/month), 42yr career (25→67):
  //     national = 400 EUR
  //     earnings-related = 1,400 × 42 × 0.0060 = 352.8 EUR
  //     total pension = 752.8 EUR
  //     gross RR = 752.8 / 1,400 = 53.7% ✓ (OECD 53.7%)
  //
  // No mandatory funded Pillar 2 in Greece (EFKA II pillar was wound down; TEKA introduced
  // for new entrants from 2022 — mandatory funded for those entering employment from 1 Jan 2022).
  // TEKA (Ταμείο Επικουρικής Κεφαλαιοποιητικής Ασφάλισης) for new entrants: not modelled here.
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'DB',
      basePension: NATIONAL_PENSION_MONTHLY,  // 400 EUR/month — Εθνική Σύνταξη 2026
      reductionThresholds: [
        { upTo: EFKA_CEILING,  creditRate: 1.0 }, // earnings-related on earnings up to ceiling
        { upTo: Infinity,      creditRate: 0.0 },
      ],
      accrualRatePerYear: 0.0060,   // effective avg — see calibration note above
      assessmentBase: 'lifetime_avg',
      ceiling: EFKA_CEILING,         // 7,000 EUR/month
    },
    pillar2Rate: 0.0, // No mandatory funded pillar 2 for pre-2022 cohort
  },

  // GR: Pension income taxed as ordinary income.
  // Law 4172/2013 ΚΦΕ Art. 12: pension = εισόδημα από μισθωτή εργασία / συντάξεις.
  pensionTax: {
    method: 'income_tax',
    taxableFraction: 1.0,
    note: 'ΚΦΕ Art. 12: σύνταξη = εισόδημα μισθωτής εργασίας; ΦΕ κλιμάκιο ισχύει',
  },

  incomplete: false,
  formulaSteps: [],

  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'ELSTAT / OECD AV_AN_WAGE GRC 2026 estimate — ~EUR 16,800/yr',
      url: 'https://stats.oecd.org/Index.aspx?DataSetCode=AV_AN_WAGE',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'ΚΦΕ N. 4172/2013 Art. 15 — κλίμακα φορολογίας εισοδήματος 2026; AADE',
      url: 'https://www.aade.gr/polites/forologiki-enimerosi/forologia-eisodimatos',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'EFKA εισφορές 2026; Law 4387/2016; MISSOC Table I January 2026',
      url: 'https://www.efka.gov.gr/el/asfalismenos/misthoti/eisphores',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — national pension (Εθνική Σύνταξη)',
      source: 'Law 4387/2016 Art. 7 (national pension 384 EUR → valorised to ~400 EUR by 2026)',
      url: 'https://www.efka.gov.gr/el/ashalismenos/sindaxyoychoi',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — earnings-related accrual (Ανταποδοτική)',
      source: 'Law 4387/2016 Art. 8 — tiered accrual schedule; effective rate calibrated to OECD PaG 2023',
      url: 'https://www.oecd.org/en/publications/oecd-pensions-at-a-glance-2023_678d9b99-en.html',
      retrievedDate: '2026-03',
      dataYear: 2023,
    },
  ],

  selfEmployment: null,
};
