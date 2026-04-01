/**
 * Czech Republic — Full Country Config 2026
 *
 * All parameters sourced from official 2026 MPSV / ČSSZ decrees.
 * Validated against Appendix A reference table in Technical Design v2.0.
 *
 * Key legislation:
 *   - Zákon č. 155/1995 Sb. (Pension Insurance Act) §§ 15-16
 *   - Zákon č. 589/1992 Sb. (SSC contributions)
 *   - Zákon č. 586/1992 Sb. (Income Tax Act)
 *   - Nařízení vlády (Government Decree) for pension year 2026
 *
 * 2026-03-26 update: OSVČ minimum social advance reduced 5,720 → 5,005 CZK/month
 *   retroactively from Jan 2026 (Sněmovna vote 25.3.2026; pending Senate + Presidential sign.).
 *   PD Band 1 total: 9,984 → 9,162 CZK/month (social: 6,578 → 5,756 CZK).
 */

import type { CountryConfig } from '../types';

/** CZ AW 2026 per MPSV Government Decree (48,967 CZK/month) */
const AW_2026 = 48_967;

// ─── Paušální daň (flat-tax scheme for OSVČ) — 2026 ──────────────────────────
// Source: Zákon č. 7/2021 Sb. (paušální daň), as amended by zákon č. 366/2022 Sb.
//
// Three bands based on annual gross income:
//   Pásmo 1 (Band 1): ≤ 1,000,000 CZK/year
//   Pásmo 2 (Band 2): ≤ 1,500,000 CZK/year (or ≤ 2,000,000 if ≥ 75% income from
//                     80%/60%-expense activities — simplified in model to 1,500,000 limit)
//   (Pásmo 3 not modelled here)
//
// The OSVČ pays a single fixed monthly lump sum covering social + health + tax advance.
// SSC is always computed at the band's statutory fixed assessment base (NOT 50% of profit).
//
// 2026 official monthly payments (source: Finanční správa ČR / ČSSZ decree 2026):
//
//   Band 1: total 9,162 CZK/month (retroactively from Jan 2026 — Sněmovna 25.3.2026)
//     = 100 CZK (daň) + 5,756 CZK (soc, base 19,712 CZK) + 3,306 CZK (zdrav, base 24,484 CZK)
//     Note: social base ≈ 115% × OSVČ min advance 5,005 CZK; health base = 50% of AW_2026.
//     Was: 9,984 CZK/month (100 + 6,578 + 3,306) before the Babišova novela.
//
//   Band 2: total 16,745 CZK/month
//     = 4,963 CZK (daň) + 8,191 CZK (soc, base 28,050 CZK) + 3,591 CZK (zdrav, base 26,600 CZK)

/** Annual income ceiling for Pásmo 1: 1,000,000 CZK/year */
const PD_BAND1_LIMIT = 1_000_000;
/** Annual income ceiling for Pásmo 2: 1,500,000 CZK/year */
const PD_BAND2_LIMIT = 1_500_000;

/**
 * Band 1: social assessment base — reduced retroactively from Jan 2026.
 * Babišova novela (Sněmovna 25.3.2026): OSVČ min advance 5,720 → 5,005 CZK/month. (~35% of PD reference AW).
 * PD Band 1 social = 115% × OSVČ min advance = 5,005 × 1.15 = 5,756 CZK/month.
 * Derived: Math.round(5,756 ÷ 29.2%) = 19,712 CZK (was: 22,527 CZK → 6,578 CZK).
 * Band 1 health assessment base unchanged: 50% of AW_2026 = 24,484 CZK
 * (13.5% × 24,484 → ceil = 3,306 CZK).
 */
const PD_BAND1_SOCIAL_BASE = Math.round(5_756 / 0.292); // 19,712 CZK → ≈5,756 CZK social (29.2%). Was 22_527 pre-novela.

/**
 * Band 2: explicit assessment bases from the 2026 decree.
 *   Social: 28,050 CZK → 29.2% = 8,191 CZK
 *   Health: 26,600 CZK → 13.5% = 3,591 CZK
 */
const PD_BAND2_SOCIAL_BASE = 28_050; // CZK/month
const PD_BAND2_HEALTH_BASE = 26_600; // CZK/month

/**
 * Fixed monthly income tax advances per band (zákon č. 7/2021 Sb. §7f; Finanční správa 2026).
 * Band 1: 100 CZK | Band 2: 4,963 CZK
 */
const PD_BAND1_TAX_ADVANCE = 100;
const PD_BAND2_TAX_ADVANCE = 4_963;

/**
 * Czech income tax uses the "superhrubá mzda" (super-gross) system, which was
 * abolished from 2021. From 2021 the tax base is the gross wage.
 * Progressive rates: 15% up to 3× AW/month; 23% above.
 * Personal allowance (základní sleva na poplatníka): 30,840 CZK/year = 2,570 CZK/month
 * Source: Zákon č. 586/1992 Sb. §§ 16, 35ba (as amended 2024-2026)
 */
const MONTHLY_PERSONAL_ALLOWANCE_CZK = 2_570; // 30,840 / 12

/**
 * 2026 income tax bracket thresholds.
 * The 23% rate kicks in above 3× AW annually.
 * 3 × 48,967 × 12 = 1,766,812 CZK/year → 147,234 CZK/month
 */
const TAX_BRACKET_THRESHOLD = 3 * AW_2026; // 147,234 CZK/month

/**
 * Reduction thresholds for pension assessment base (výpočtový základ).
 * Source: Nařízení vlády 2026
 *   1st threshold: 44% × AW = 21,546 CZK @ 99%  (reduced from 100% by 2026 pension reform)
 *   2nd threshold: 4×  AW = 195,868 CZK @ 26%
 *   Above 2nd threshold                 @ 0%
 */
const REDUCTION_THRESHOLD_1 = Math.round(0.44 * AW_2026); // 21,546 CZK (44% of AW)
const REDUCTION_THRESHOLD_2 = 4 * AW_2026;                // 195,868 CZK

/**
 * SSC contribution ceiling (max. vyměřovací základ) 2026.
 * Source: Zákon č. 589/1992 Sb. § 15a; Nařídení vlády 2026.
 * Annual cap: 48 × AW = 48 × 48,967 = 2,350,416 CZK/year
 * Monthly cap: 2,350,416 ÷ 12 = 195,868 CZK/month
 * Applies to: pension insurance + sick-leave insurance (employee & employer).
 * Health insurance (zdravotní pojištění) is NOT subject to this ceiling.
 * Note: numerically identical to REDUCTION_THRESHOLD_2 (both = 4 × AW) because 48 ÷ 12 = 4.
 */
const SSC_ANNUAL_CAP   = 48 * AW_2026;          // 2,350,416 CZK/year
const SSC_MONTHLY_CAP  = SSC_ANNUAL_CAP / 12;   // 195,868 CZK/month

export const czechRepublic: CountryConfig = {
  // ─── Identity ─────────────────────────────────────────────────────────────
  code: 'CZ',
  name: 'Czech Republic',
  currency: 'CZK',
  eurExchangeRate: 25.0,   // approx EUR/CZK as of Jan 2026; update via ECB API annually
  dataYear: 2026,

  // ─── Wages ────────────────────────────────────────────────────────────────
  averageWage: AW_2026,
  medianWage: 39_000,         // CZK/month — Eurostat SES / ISPV 2023–2024 adj. to 2026
  wagePercentiles: {          // CZK/month — ISPV / Eurostat SES 2022 adj. to 2026
    p10: 19_000, p25: 27_000, p75: 57_000, p90: 82_000,
  },
  minimumWage: 22_400,        // CZK/month — NV č. 365/2025 Sb. (2026 decree)
  oecdAverageWage: 41_420,  // CZK/month — OECD Taxing Wages 2025, Table I.1 (2024): CZK 497,040/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  // ─── Pension Defaults ─────────────────────────────────────────────────────
  defaults: {
    careerStartAge: 25,
    retirementAge: 65,
    retirementDuration: 20, // age 65 → 85 (conservative; design uses 25 years to 90)
  },

  // ─── Income Tax ───────────────────────────────────────────────────────────
  // Zákon č. 586/1992 Sb. §§ 16, 35ba
  // Tax base: gross (superhrubá abolished 2021)
  // Two brackets: 15% up to 4×AW/month; 23% above
  // Personal allowance applied after computing tax (as a flat monthly credit, not a deduction)
  // Implementation note: we model allowance as a deduction from taxable base equivalent to
  // monthly credit (2,570 CZK) to correctly reduce tax at the 15% rate, matching Czech practice.
  incomeTax: {
    type: 'progressive',
    personalAllowance: MONTHLY_PERSONAL_ALLOWANCE_CZK,
    allowanceIsCredit: true,   // CZ §35ba: základní sleva na poplatníka is a tax credit, not a base deduction
    taxBase: 'gross',
    // CZ § 38h: monthly záloha is computed on gross rounded UP to nearest 100 CZK
    taxBaseRounding: 'ceil100',
    brackets: [
      { upTo: TAX_BRACKET_THRESHOLD, rate: 0.15 },
      { upTo: Infinity, rate: 0.23 },
    ],
  },

  // ─── Employee SSC ─────────────────────────────────────────────────────────
  // Zákon č. 589/1992 Sb.
  // Total employee SSC = 11.0% of gross (no ceiling for health insurance;
  // pension + sick leave + unemployment apply up to max base = 48× AW/year)
  //   - Pension insurance (důchodové pojištění):    6.5%
  //   - Health insurance (zdravotní pojištění):     4.5%  (no ceiling, paid via ZP schemes)
  //   Note: Czech health insurance is paid separately to health insurance companies,
  //   but it is an employee SSC for modelling purposes.
  // Annual SSC ceiling (max. vyměřovací základ): SSC_ANNUAL_CAP = 48 × AW = 2,350,416 CZK
  // → Monthly cap: SSC_MONTHLY_CAP = 195,868 CZK/month (pension + sick-leave; health uncapped)
  employeeSSC: {
    ceiling: SSC_MONTHLY_CAP, // 195,868 CZK/month — Zákon č. 589/1992 Sb. § 15a
    components: [
      {
        label: 'Pension Insurance',
        rate: 0.065,
        ceiling: SSC_MONTHLY_CAP,
        pensionFunded: true,
      },
      {
        // Nemocenské pojištění — employee sick-leave insurance, mandatory from 1 Jan 2024
        // Zákon č. 187/2006 Sb. (as amended by zákon č. 270/2023 Sb.)
        label: 'Sick Leave Insurance',
        rate: 0.006,
        ceiling: SSC_MONTHLY_CAP,
        pensionFunded: false,
      },
      {
        label: 'Health Insurance',
        rate: 0.045,
        ceiling: undefined, // uncapped
        pensionFunded: false,
        // Zákon č. 592/1992 Sb. § 3 — health insurance contributions rounded up
        roundUp: true,
      },
    ],
  },

  // ─── Employer SSC ─────────────────────────────────────────────────────────
  // Zákon č. 589/1992 Sb.
  // Total employer SSC = 33.8% of gross (same ceiling as employee for the non-health portions)
  //   - Pension insurance:          21.5%  ← pension-funded (to pension accounts via ČSSZ)
  //   - Sick leave (nemocenské):     2.1%  ← NOT pension-funded (sickness benefit fund)
  //   - State employment policy:     1.2%  ← NOT pension-funded (labour market fund)
  //   - Health insurance:            9.0%  ← health (to ZP companies)
  //   Total:                        33.8%
  // Note: ČSSZ collects 21.5+2.1+1.2 = 24.8% in a single payment, but only the
  // 21.5% pension insurance portion is directed to the pension system.
  employerSSC: {
    ceiling: SSC_MONTHLY_CAP, // 195,868 CZK/month — Zákon č. 589/1992 Sb. § 15a
    components: [
      {
        label: 'Pension Insurance',
        rate: 0.215,
        ceiling: SSC_MONTHLY_CAP,
        pensionFunded: true,
      },
      {
        // Sick leave (nemocenské) — paid to ČSSZ but funds sickness benefits, not pensions
        label: 'Sick Leave Insurance',
        rate: 0.021,
        ceiling: SSC_MONTHLY_CAP,
        pensionFunded: false,
      },
      {
        // Příspěvek na státní politiku zaměstnanosti — labour market / unemployment fund
        label: 'State Employment Policy',
        rate: 0.012,
        ceiling: SSC_MONTHLY_CAP,
        pensionFunded: false,
      },
      {
        label: 'Health Insurance',
        rate: 0.09,
        ceiling: undefined,
        pensionFunded: false,
        // Zákon č. 592/1992 Sb. § 3 — employer health contributions also rounded up
        roundUp: true,
      },
    ],
  },

  // ─── Pension System: DB ────────────────────────────────────────────────────
  // Zákon č. 155/1995 Sb. §§ 15-16; Nařízení vlády 2026
  //
  // Formula:
  //   výpočtový základ (credited assessment base) = reduction of monthly avg earnings
  //   procentní výměra = credited × careerYears × accrualRate (1.495%/yr)
  //   pension = základní výměra (4,900) + procentní výměra
  //
  // 2026 reform: 1st threshold reduced from 100% to 99% credit rate.
  // Accrual rate reduced from 1.500% to 1.495% (decreasing 0.005pp/yr until 2035).
  pensionSystem: {
    type: 'DB',
    basePension: 4_900,                      // základní výměra (CZK/month)
    assessmentBase: 'monthly_avg',           // average of lifetime monthly earnings
    accrualRatePerYear: 0.01495,             // 1.495% per year of credited earnings
    ceiling: REDUCTION_THRESHOLD_2,          // 195,868 CZK/month (= 4× AW)
    reductionThresholds: [
      { upTo: REDUCTION_THRESHOLD_1, creditRate: 0.99 },  // ≤21,546 @ 99%
      { upTo: REDUCTION_THRESHOLD_2, creditRate: 0.26 },  // 21,546–195,868 @ 26%
      { upTo: Infinity, creditRate: 0.00 },               // >195,868 @ 0%
    ],
  },

  // ─── Pillar 2 ─────────────────────────────────────────────────────────────
  // Czech Republic abolished its Pillar 2 ("II. pilíř") in 2016. It has
  // a voluntary "doplňkové penzijní spoření" (III. pilíř) but that is not mandatory.
  pillar2: {
    available: false,
    mandatory: false,
    contributionRate: 0,
    defaultAnnualReturnRate: 0.030, // 3.0% real net-of-fees — constant prices basis; OECD 2–3% convention
    fundType: 'individual_account',
  },

  // ─── Formula Steps (for Sidebar) ─────────────────────────────────────────
  formulaSteps: [
    {
      stepNumber: 1,
      label: 'Step 1: Total Employer Cost',
      formula: 'Total Employer Cost = Gross + Employer SSC',
      liveValueFn: (_inputs, result) => {
        const v = result.sscResult.totalEmployerCost;
        return `${v.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/month`;
      },
      explanation:
        'Your employer pays this amount in total. Your contract gross is a subset — the remainder is invisible social charges.',
      sourceNote: 'Zákon č. 589/1992 Sb.',
      isKeyInsight: true,
    },
    {
      stepNumber: 2,
      label: 'Step 2: Employee Social Contributions',
      formula: 'Employee SSC = Pension Insurance (6.5%) + Health Insurance (4.5%) = 11%',
      liveValueFn: (_inputs, result) => {
        const v = result.sscResult.employeeTotal;
        return `${v.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/month`;
      },
      explanation:
        'Deducted from your gross before income tax. 6.5% funds your pension; 4.5% funds health insurance.',
      sourceNote: 'Zákon č. 589/1992 Sb.',
    },
    {
      stepNumber: 3,
      label: 'Step 3: Income Tax',
      formula: 'Tax = 15% × min(gross, 4×AW) + 23% × max(0, gross − 4×AW) − personal allowance',
      liveValueFn: (_inputs, result) => {
        const v = result.taxResult.incomeTaxMonthly;
        return `${v.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/month`;
      },
      explanation:
        '15% up to 4× average wage, 23% above. Personal allowance (30,840 CZK/year) reduces the final tax bill.',
      sourceNote: 'Zákon č. 586/1992 Sb. §§ 16, 35ba',
    },
    {
      stepNumber: 4,
      label: 'Step 4: Pension Assessment Base (výpočtový základ)',
      formula:
        'credited = min(gross, T1)×99% + max(0, min(gross, T2) − T1)×26%',
      liveValueFn: (_inputs, result) => {
        const credited = result.pensionResult.formulaInputs['credited'];
        return `${credited.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/month`;
      },
      explanation:
        'The reduction formula compresses higher earners. Only the first band (44% of average wage) is nearly fully credited (99%); amounts up to the second band (4× average wage) get 26%. Nothing above is credited.',
      sourceNote: 'Zákon č. 155/1995 Sb. § 15; Nařízení vlády 2026',
      isKeyInsight: true,
    },
    {
      stepNumber: 5,
      label: 'Step 5: Monthly Pension',
      formula: 'Pension = 4,900 + credited × careerYears × 1.495%',
      liveValueFn: (_inputs, result) => {
        const v = result.pensionResult.monthlyPension;
        return `${v.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} CZK/month`;
      },
      explanation:
        'The base pension (základní výměra) of 4,900 CZK is a flat amount paid to everyone. The percentage component (procentní výměra) adds 1.495% of credited earnings per year worked.',
      sourceNote: 'Zákon č. 155/1995 Sb. § 16; Nařízení vlády 2026',
    },
    {
      stepNumber: 6,
      label: 'Step 6: Replacement Rate',
      formula: 'Replacement rate = Monthly Pension ÷ Gross Salary',
      liveValueFn: (_inputs, result) => {
        const rr = result.pensionResult.replacementRate;
        return `${(rr * 100).toFixed(1)}%`;
      },
      explanation:
        'Percentage of your working salary replaced by the state pension. Higher earners receive a lower replacement rate due to the redistribution built into the reduction formula.',
      sourceNote: 'OECD Pensions at a Glance 2023',
    },
    {
      stepNumber: 7,
      label: 'Step 7: Lifetime Value — Contributions vs. Received',
      formula:
        'Total Paid = (Pension SSC employee + employer) × 12 × career years\nTotal Received = Pension × 12 × retirement years',
      liveValueFn: (inputs, result) => {
        const paid = result.fairReturn.totalContributionsPaid;
        const received = result.pensionResult.monthlyPension * 12 * inputs.retirementDuration;
        const diff = received - paid;
        const sign = diff >= 0 ? '+' : '−';
        return (
          `Paid: ${(paid / 1e6).toFixed(1)}m CZK | ` +
          `Received: ${(received / 1e6).toFixed(1)}m CZK | ` +
          `${sign}${(Math.abs(diff) / 1e6).toFixed(1)}m CZK`
        );
      },
      explanation:
        'Nominal lifetime comparison (no discounting). Higher earners tend to pay more in but receive a similar pension — a deliberate redistribution effect.',
      sourceNote: 'Calculated from Zákon č. 155/1995 Sb. + Zákon č. 589/1992 Sb.',
      isKeyInsight: true,
    },
  ],

  // ─── Data Source References ───────────────────────────────────────────────
  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'MPSV Nařízení vlády (Government Decree) 2026',
      url: 'https://mpsv.gov.cz/dulezite-parametry',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.basePension',
      source: 'MPSV Nařízení vlády 2026 / Zákon č. 155/1995 Sb.',
      url: 'https://mpsv.gov.cz/dulezite-parametry',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.reductionThresholds',
      source: 'MPSV Nařízení vlády 2026 / ČSSZ',
      url: 'https://www.penize.cz/starobni-duchod/483580',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      // NV č. 365/2025 Sb. — sets 2026 pension parameters:
      //   basic pension (základní výměra): 4,900 CZK
      //   1st reduction threshold: 21,546 CZK (44% of AW) - lower than minimum wage
      //   2nd reduction threshold: 195,868 CZK (4× AW)
      //   recalculation coefficient for 2024 earnings: 1.0581
      parameter: 'pensionSystem.basePension + pensionSystem.reductionThresholds',
      source: 'Nařízení vlády č. 365/2025 Sb. (effective 1.1.2026)',
      url: 'https://www.zakonyprolidi.cz/cs/2025-365',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem.accrualRatePerYear',
      source: 'Zákon č. 155/1995 Sb. (as amended by důchodová reforma)',
      url: 'https://mpsv.gov.cz/dulezite-parametry',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC',
      source: 'Zákon č. 589/1992 Sb.',
      url: 'https://www.zakonyprolidi.cz/cs/1992-589',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employerSSC',
      source: 'Zákon č. 589/1992 Sb.',
      url: 'https://www.zakonyprolidi.cz/cs/1992-589',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'Zákon č. 586/1992 Sb. §§ 16, 35ba',
      url: 'https://www.zakonyprolidi.cz/cs/1992-586',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'eurExchangeRate',
      source: 'ECB SDMX-REST EXR (daily reference rate)',
      url: 'https://data-api.ecb.europa.eu/service/data/EXR/M.CZK.EUR.SP00.A',
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
      source: 'MPSV — Minimální mzda (official portal)',
      url: 'https://mpsv.gov.cz/minimalni-mzda',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    {
      parameter: 'minimumWage',
      source: 'Eurostat minimum wage statistics (earn_mw_cur)',
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
    // ── Employer benefit / fringe-benefit exemptions ──────────────────────
    {
      parameter: 'employerBenefits.fringe_benefit',
      source: 'Zákon č. 586/1992 Sb. §6(9)(g) — nepeněžní zaměstnanecké benefity (zákon č. 366/2022 Sb.)',
      url: 'https://www.zakonyprolidi.cz/cs/1992-586#p6-9-g',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employerBenefits.meal_voucher',
      source: 'Zákon č. 586/1992 Sb. §6(9)(b); Vyhláška č. 392/2024 Sb. (MPSV stravné 2025)',
      url: 'https://www.zakonyprolidi.cz/cs/1992-586#p6-9-b',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    // ── Paušální daň (flat-tax scheme for OSVČ) ───────────────────────────
    {
      // Confirms 2026 monthly amounts: Band 1 = 9,984 CZK (100+6,578+3,306);
      // Band 2 = 16,745 CZK (4,963+8,191+3,591).
      // Also confirms assessment bases: Band 1 social = 22,526 CZK; Band 2 social = 28,050 CZK;
      // Band 2 health = 26,600 CZK.
      parameter: 'paušální daň (PD_BAND1_*, PD_BAND2_*)',
      source: 'ČSSZ — OSVČ v paušálním režimu',
      url: 'https://www.cssz.cz/osvc-v-pausalnim-rezimu',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    {
      parameter: 'paušální daň (PD_BAND1_*, PD_BAND2_*)',
      source: 'Finanční správa ČR — Paušální daň 2026: novinky, termíny',
      url: 'https://financnisprava.gov.cz/cs/financni-sprava/media-a-verejnost/tiskove-zpravy-gfr/tiskove-zpravy-2025/pausalni-dan-2026-novinky-terminy',
      retrievedDate: '2026-03',
      dataYear: 2026,
    },
    // ── 2026-03-26: Babišova novela — OSVČ minimum social advance reduction ───
    {
      parameter: 'selfEmployment.modes[OSVČ].minSocialInsuranceBase + PD_BAND1_SOCIAL_BASE',
      source: 'Peníze.cz — Minimální zálohy na sociální pojištění se zpětně sníží (25.3.2026)',
      url: 'https://www.penize.cz/socialni-pojisteni/487450-minimalni-zalohy-na-socialni-pojisteni-se-zpetne-snizi-spocitame-vam-kolik-muzete-dostat-zpatky',
      retrievedDate: '2026-03-26',
      dataYear: 2026,
    },
    {
      parameter: 'employerBenefits.pension_contrib',
      source: 'Zákon č. 586/1992 Sb. §6(9)(l); zákon č. 427/2011 Sb. (DPS); zákon č. 277/2009 Sb. (pojišťovnictví)',
      url: 'https://www.zakonyprolidi.cz/cs/1992-586#p6-9-l',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
  ],

  // Pension formula parameters fully populated for Phase 1
  incomplete: false,

  // ─── Self-Employment: OSVČ ─────────────────────────────────────────────────
  // Osoba Samostatně Výdělečně Činná — Czech self-employed persons.
  // Source: Zákon č. 589/1992 Sb. § 5b (social insurance) + Zákon č. 592/1992 Sb. § 3a (health)
  //
  // Key rules:
  //  • Assessment base (vyměřovací základ) = 50% of net profit (příjmy − výdaje)
  //  • Social insurance:  29.2% of assessment base
  //      - Pension insurance:  28.0% (pension-funded)
  //      - State employment:    1.2% (not pension-funded)
  //    Minimum monthly assessment base = 25% × AW_2026 = 12,242 CZK
  //    Maximum monthly assessment base = 195,868 CZK (= 4× AW, same as employee ceiling)
  //  • Health insurance: 13.5% of assessment base (rouna up to whole CZK)
  //    Minimum monthly assessment base = 50% × AW_2026 = 24,484 CZK (no upper ceiling)
  //  • Sick leave insurance: voluntary for OSVČ (excluded from model)
  //  • Pension formula: uses social assessment base (50% of profit) as effective "earnings"
  //    rather than raw profit — matching how ČSSZ records the OSVČ pension basis.
  //  • Income tax: same brackets (15%/23%) and personal allowance as employees.
  //    Tax base = profit (gross income − expenses), consistent with current taxBase:'gross' config.
  selfEmployment: {
    available: true,
    modes: [
      {
        name: 'OSVČ (Hlavní činnost)',
        pensionBasisRate: 0.5,        // pension assessment base = 50% of profit
        pillar2Eligible: false,       // CZ has no mandatory Pillar 2

        // ── OSVČ-specific assessment-base rules ──────────────────────────────
        assessmentBasisRate: 0.5,     // 50% of profit → vyměřovací základ

        // Babišova novela (Sněmovna 25.3.2026): minimum social advance → 5,005 CZK/month
        // retroactively from Jan 2026. Prior Fiala reform (2024–2026) had increased it to
        // 5,720 CZK/month (40% × AW). Original §5b(2) zákon č. 589/1992 Sb. rate was 25%.
        minSocialInsuranceBase: Math.round(5_005 / 0.292), // 17,140 CZK → 5,005 CZK advance/month

        // Source: §3a zákon č. 592/1992 Sb. — 50% of monthly AW
        minHealthInsuranceBase: Math.round(0.50 * AW_2026), // 24,484 CZK/month

        // ── SSC component structure (all borne by OSVČ, no employer split) ───
        sscOverrideComponents: [
          {
            label: 'Pension Insurance',
            rate: 0.280,                          // 28.0% of social assessment base
            baseType: 'social',
            ceiling: REDUCTION_THRESHOLD_2,       // 195,868 CZK/month (= 4× AW)
            pensionFunded: true,
          },
          {
            label: 'State Employment Policy',
            rate: 0.012,                          // 1.2% of social assessment base
            baseType: 'social',
            ceiling: REDUCTION_THRESHOLD_2,
            pensionFunded: false,
          },
          {
            label: 'Health Insurance',
            rate: 0.135,                          // 13.5% of health assessment base
            baseType: 'health',
            ceiling: undefined,                   // health insurance uncapped
            pensionFunded: false,
            roundUp: true,                        // §3 zákon č. 592/1992 Sb.
          },
        ],
      },

      // ─── Paušální daň — Pásmo 1 ─────────────────────────────────────────────
      // Valid for annual gross income ≤ 1,000,000 CZK.
      // Monthly lump sum: 9,162 CZK = 100 (daň) + 5,756 (soc) + 3,306 (zdrav). [from Jan 2026]
      // Was: 9,984 CZK (100+6,578+3,306) before Babišova novela (Sněmovna 25.3.2026).
      // Social base: 19,712 CZK (= 115% × OSVČ min advance 5,005 CZK). Health base: 24,484 CZK (50% AW_2026).
      // Source: Finanční správa ČR; Zákon č. 7/2021 Sb. §7a–§7h; novela přijatá 25.3.2026.
      {
        name: 'Paušální daň – Pásmo 1',
        pensionBasisRate: 0.0,      // pension base = minSocialInsuranceBase (via max(0, min))
        pillar2Eligible: false,

        assessmentBasisRate: 0,     // force SSC onto the fixed band bases (rawBase=0 → min kicks in)
        minSocialInsuranceBase: PD_BAND1_SOCIAL_BASE, // 19,712 CZK → soc ≈5,756 CZK/month (was 22,527 / 6,578 pre-novela)
        minHealthInsuranceBase: Math.round(0.50 * AW_2026), // 24,484 CZK → zdrav 3,306 CZK/month

        sscOverrideComponents: [
          {
            label: 'Pension Insurance (PD)',
            rate: 0.280,
            baseType: 'social',
            ceiling: REDUCTION_THRESHOLD_2,
            pensionFunded: true,
          },
          {
            label: 'State Employment Policy (PD)',
            rate: 0.012,
            baseType: 'social',
            ceiling: REDUCTION_THRESHOLD_2,
            pensionFunded: false,
          },
          {
            label: 'Health Insurance (PD)',
            rate: 0.135,
            baseType: 'health',
            ceiling: undefined,
            pensionFunded: false,
            roundUp: true,
          },
        ],

        pausalniDan: {
          bandLabel: 'Pásmo 1',
          band: 1,
          annualIncomeLimit: PD_BAND1_LIMIT,
          fixedMonthlyTaxAdvance: PD_BAND1_TAX_ADVANCE,
        },
      },

      // ─── Paušální daň — Pásmo 2 ─────────────────────────────────────────────
      // Valid for annual gross income ≤ 1,500,000 CZK (or ≤ 2,000,000 with 80%/60% expenses).
      // Monthly lump sum: 16,745 CZK = 4,963 (daň) + 8,191 (soc) + 3,591 (zdrav).
      // Social base: 28,050 CZK (29.2% → 8,191 CZK). Health base: 26,600 CZK (13.5% → 3,591 CZK).
      // Source: Finanční správa ČR; Zákon č. 7/2021 Sb. §7b(3); zákon č. 366/2022 Sb.
      {
        name: 'Paušální daň – Pásmo 2',
        pensionBasisRate: 0.0,      // pension base = minSocialInsuranceBase (Band 2 elevated)
        pillar2Eligible: false,

        assessmentBasisRate: 0,     // force SSC onto the fixed band bases
        minSocialInsuranceBase: PD_BAND2_SOCIAL_BASE, // 28,050 CZK → soc 8,191 CZK/month
        minHealthInsuranceBase: PD_BAND2_HEALTH_BASE, // 26,600 CZK → zdrav 3,591 CZK/month

        sscOverrideComponents: [
          {
            label: 'Pension Insurance (PD)',
            rate: 0.280,
            baseType: 'social',
            ceiling: REDUCTION_THRESHOLD_2,
            pensionFunded: true,
          },
          {
            label: 'State Employment Policy (PD)',
            rate: 0.012,
            baseType: 'social',
            ceiling: REDUCTION_THRESHOLD_2,
            pensionFunded: false,
          },
          {
            label: 'Health Insurance (PD)',
            rate: 0.135,
            baseType: 'health',
            ceiling: undefined,
            pensionFunded: false,
            roundUp: true,
          },
        ],

        pausalniDan: {
          bandLabel: 'Pásmo 2',
          band: 2,
          annualIncomeLimit: PD_BAND2_LIMIT,
          fixedMonthlyTaxAdvance: PD_BAND2_TAX_ADVANCE,
        },
      },
    ],
  },

  // ─── Employer Benefits (Zaměstnanecké benefity) ──────────────────────────────
  //
  // Three tax-optimised compensation components that reduce the fiscal wedge
  // relative to equivalent cash wages.  All three are exempt from employee income
  // tax and SSC (within the statutory annual caps); the employer neither pays SSC
  // on these amounts, making them cheaper per unit of employee value than gross pay.
  //
  // (a) Non-Monetary Benefits / Fringe Benefits — §6(9)(g) ZDP
  //     Covers recreation, sport, culture, healthcare, education, transport subsidy, etc.
  //     Annual exemption cap: 50% × AW = 48,967 × 0.50 = 24,484 CZK/year.
  //     Source: Zákon č. 586/1992 Sb. §6(9)(g), as amended by zákon č. 366/2022 Sb.
  //             (reform effective 1 Jan 2024 capped the previously unlimited exemption).
  //
  // (b) Cash Meal Allowance (Stravenkový paušál) — §6(9)(b) ZDP
  //     The paušál replaces paper meal vouchers with a direct cash transfer.
  //     Exempt per working day up to 70% of the highest statutory meal reimbursement
  //     rate for journeys over 12 hours.  MPSV Vyhláška č. 392/2024 Sb. sets the
  //     12-h rate at 166 CZK → 70% = 116.20 CZK/day (2026 estimate).
  //     23 working days/month → ~2,673 CZK/month; model default: 2,600 CZK/month.
  //     Source: Zákon č. 586/1992 Sb. §6(9)(b); Vyhláška č. 392/2024 Sb.
  //
  // (c) Pension & Life Insurance Contributions — §6(9)(l) ZDP
  //     Employer contributions to DPS (doplňkové penzijní spoření) and/or
  //     capitalotvorné životní pojištění are exempt from income tax and SSC.
  //     Combined annual cap: 50,000 CZK/year = 4,167 CZK/month.
  //     Flows directly into the employee's DPS account — locked until age 60
  //     or statutory retirement.  Model accumulates at Pillar-2 real return (3.0%
  //     real net-of-fees, constant prices) and annuitises over the retirement period.
  //     Source: Zákon č. 586/1992 Sb. §6(9)(l); zákon č. 427/2011 Sb. (DPS Act);
  //             zákon č. 277/2009 Sb. (Insurance Act).
  employerBenefits: {
    available: true,
    benefits: [
      {
        id: 'fringe_benefit',
        label: 'Non-Monetary Benefits (Fringe)',
        labelLocal: 'Zaměstnanecké benefity',
        destination: 'net_pay',
        defaultEnabled: false,
        defaultAmountMonthly: 2_000,
        minAmount: 0,
        maxAmount: Math.round(Math.round(0.5 * AW_2026) / 12),  // 2,040 CZK/mo — monthly exempt cap
        stepAmount: 100,
        // 50% × AW_2026 per year — §6(9)(g) ZDP (zákon č. 366/2022 Sb., eff. 2024)
        annualExemptCap: Math.round(0.5 * AW_2026),  // 24,484 CZK/year
        legalBasis: '§6(9)(g) zákon č. 586/1992 Sb.',
        sourceNote:
          'Zákon č. 586/1992 Sb. §6(9)(g) (ve znění zákon. č. 366/2022 Sb., účinné 2024) — ' +
          'nepeněžní plnění poskytovaná zaměstnavatelem (rekreace, sport, kultura, zdraví, ' +
          'vzdělání, doprava) jsou osvobozena od daně z příjmů a odvozeny od pojistných ' +
          'odvodů do výše 50 % průměrné mzdy ročně (2026: 24 484 CZK/rok).',
        sourceUrl: 'https://www.zakonyprolidi.cz/cs/1992-586#p6-9-g',
      },
      {
        id: 'meal_voucher',
        label: 'Meal Voucher / Cash Meal Allowance',
        labelLocal: 'Stravenkový paušál',
        destination: 'net_pay',
        defaultEnabled: false,
        defaultAmountMonthly: 2_600,
        minAmount: 0,
        maxAmount: Math.round(32_054 / 12),  // 2,671 CZK/mo — monthly exempt cap
        stepAmount: 50,
        // 70% × 166 CZK (12h rate 2026) × 276 working days/year ≈ 32,054 CZK/year
        annualExemptCap: 32_054,
        legalBasis: '§6(9)(b) zákon č. 586/1992 Sb.',
        sourceNote:
          'Zákon č. 586/1992 Sb. §6(9)(b) — stravenkový paušál osvobozen od daně ' +
          'z příjmů fyzických osob a odvozů na pojistné do výše 70 % stravného při ' +
          'pracovní cestě trvající déle než 12 hodin (vyhláška č. 392/2024 Sb.: 166 CZK/den ' +
          '→ 70% = 116,20 CZK/den). Model: 23 pracovních dní/měsíc → ~2 673 CZK/měsíc; ' +
          'výchozí hodnota 2 600 CZK/měsíc.',
        sourceUrl: 'https://www.zakonyprolidi.cz/cs/1992-586#p6-9-b',
      },
      {
        id: 'pension_contrib',
        label: 'Pension & Life Insurance Contributions',
        labelLocal: 'Příspěvek na penzijní / životní pojištění',
        destination: 'third_pillar',
        defaultEnabled: false,
        defaultAmountMonthly: 1_000,
        minAmount: 0,
        maxAmount: 4_100,  // stays within 50,000 CZK/year cap (4,167/month)
        stepAmount: 100,
        // Combined cap for DPS + life insurance: 50,000 CZK/year — §6(9)(l) ZDP
        annualExemptCap: 50_000,
        legalBasis: '§6(9)(l) zákon č. 586/1992 Sb.',
        sourceNote:
          'Zákon č. 586/1992 Sb. §6(9)(l) — příspěvek zaměstnavatele na doplňkové ' +
          'penzijní spoření (zákon č. 427/2011 Sb.) nebo na soukromé životní pojištění ' +
          '(zákon č. 277/2009 Sb.) je osvobozen od daně z příjmů a pojistných odvodů ' +
          'do celkové výše 50 000 CZK/rok. Prostředky jsou vázány do 60 let věku / ' +
          'důchodového věku. Model akumuluje stejnou reálnou výnosovou mírou jako ' +
          'II. pilíř (3,0 % reálně po poplatcích, stálé ceny).',
        sourceUrl: 'https://www.zakonyprolidi.cz/cs/1992-586#p6-9-l',
      },
    ],
  },

  // CZ: state pension (štátní důchod) is fully exempt from income tax.
  // Source: §4 odst.1 písm.h) zákona č.586/1992 Sb. (zákon o daních z příjmů).
  pensionTax: {
    method: 'none',
    note: '§4(1)(h) ZDP: státní důchod je osvobozen od daně z příjmů fyzických osob',
  },
};
