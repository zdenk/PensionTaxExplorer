/**
 * Poland — Country Config 2026 (Tier 1)
 *
 * Tax / SSC: complete and accurate.
 * Pension formula: NDC (ZUS I fillar + subkonto) + OFE Pillar 2 — parameters populated.
 *
 * Sources:
 *   SSC: MISSOC Table I Jan 2026; Ustawa o systemie ubezpieczeń społecznych
 *   Income tax: Ustawa o PIT — Nowy Polski Ład 2022+ (12%/32% threshold 2026)
 *   AW: GUS Przeciętne wynagrodzenie 2026 estimate
 *   Exchange rate: ECB SDMX-REST EXR PLN Jan 2026
 *   NDC contribution split: ZUS subkonto ustawa — 12.22% konto + 4.38% subkonto = 16.60% NDC;
 *     OFE (II pillar, opt-in since 2014): 2.92% separately
 *   GUS Life Table divisors: GUS Tablice trwania życia 2022 — combined M+F:
 *     age 60: 24.0 years = 288 months; age 65: 19.5 years = 234 months
 */

import type { CountryConfig } from '../types';

const AW_2026_PLN = 7_510; // PLN/month — GUS estimate 2026
const EUR_PLN = 4.25;       // ECB reference rate Jan 2026

// ZUS contribution ceiling (30× annual AW): 30 × 90,120 PLN/year = 2,703,600 PLN/year
// Monthly equivalent: 225,300 PLN/month (effectively uncapped for standard earners)
const ZUS_CEILING = 225_300;

// Kwota wolna od podatku: 30,000 PLN/year → monthly tax credit = 300 PLN
const MONTHLY_TAX_CREDIT = 300;

export const poland: CountryConfig = {
  code: 'PL',
  name: 'Poland',
  currency: 'PLN',
  eurExchangeRate: EUR_PLN,
  dataYear: 2026,

  averageWage: AW_2026_PLN,
  medianWage: 5_860,           // PLN/month — GUS SES 2022 adj. to 2026
  wagePercentiles: {             // PLN/month — GUS SES 2022 adj. to 2026
    p10: 3_400, p25: 4_200, p75: 7_900, p90: 11_500,
  },
  minimumWage: 4_626,            // PLN/month — Rozporządzenie RM (2026 minimalne wynagrodzenie)
  oecdAverageWage: 7_044,  // PLN/month — OECD Taxing Wages 2025, Table I.1 (2024): PLN 84,528/year
  wageMultipliers: [0.5, 1.0, 1.5, 2.0, 3.0, 4.0],

  defaults: {
    careerStartAge: 25,
    retirementAge: 65, // PL statutory: 65 (men); 60 (women) — use 65 for standard model
    retirementDuration: 20,
  },

  // Ustawa o PIT — Nowy Polski Ład (since 2022)
  // 12% up to 120,000 PLN/year (10,000 PLN/month)
  // 32% above
  // Kwota wolna: 30,000 PLN/year → reduces tax by 30,000 × 12% = 3,600 PLN/year = 300 PLN/month
  // Modelled as monthly tax credit (same approach as CZ personal allowance)
  incomeTax: {
    type: 'progressive',
    personalAllowance: MONTHLY_TAX_CREDIT, // 300 PLN/month credit against final tax
    allowanceIsCredit: true,   // PL: kwota zmniejszająca podatek is a tax credit
    taxBase: 'gross',
    brackets: [
      { upTo: 10_000, rate: 0.12 },
      { upTo: Infinity, rate: 0.32 },
    ],
  },

  // ZUS employee contributions (2026, Ustawa o SUS)
  // Note: health contribution (składka zdrowotna) calculated separately at 9% of gross
  // for employment contracts since 2022 reform (Nowy Polski Ład).
  employeeSSC: {
    ceiling: ZUS_CEILING,
    components: [
      // Emerytalne (pension): 9.76% (ceiling applies)
      { label: 'Pension Insurance (Emerytalne)', rate: 0.0976, ceiling: ZUS_CEILING, pensionFunded: true },
      // Rentowe (disability): 1.5% (ceiling applies)
      { label: 'Disability Insurance (Rentowe)', rate: 0.015, ceiling: ZUS_CEILING, pensionFunded: false },
      // Chorobowe (sickness): 2.45% (ceiling applies)
      { label: 'Sickness Insurance (Chorobowe)', rate: 0.0245, ceiling: ZUS_CEILING, pensionFunded: false },
      // Zdrowotna (health): 9% of gross — no ceiling; since 2022 reform non-deductible from PIT
      { label: 'Health Insurance (Zdrowotna)', rate: 0.09, pensionFunded: false },
    ],
  },

  employerSSC: {
    ceiling: ZUS_CEILING,
    components: [
      // Emerytalne: 9.76% (ceiling applies)
      { label: 'Pension Insurance (Emerytalne)', rate: 0.0976, ceiling: ZUS_CEILING, pensionFunded: true },
      // Rentowe: 6.5% (ceiling applies)
      { label: 'Disability Insurance (Rentowe)', rate: 0.065, ceiling: ZUS_CEILING, pensionFunded: false },
      // Wypadkowe (accident): 1.67% average (ceiling applies)
      { label: 'Accident Insurance (Wypadkowe)', rate: 0.0167, ceiling: ZUS_CEILING, pensionFunded: false },
      // Fundusz Pracy (labour fund): 1.0% (no ceiling)
      { label: 'Labour Fund (FP)', rate: 0.01, pensionFunded: false },
      // FGŚP (guaranteed benefits): 0.1% (no ceiling)
      { label: 'Employee Benefits Fund (FGŚ P)', rate: 0.001, pensionFunded: false },
    ],
  },

  // NDC (ZUS I filar + subkonto) + OFE Pillar 2 — official 2026 parameters
  // Contribution split (total ZUS pension = 19.52% of gross):
  //   konto emerytalne (main account, NDC): 12.22%
  //   subkonto (sub-account, NDC valorized differently): 4.38%
  //   → pillar1ContributionRate = 12.22 + 4.38 = 16.60% (goes to ZUS notional accounts)
  //   OFE (opt-in Pillar 2): 2.92% → modelled via pillar2Rate separately
  //   Note: Using 19.52% would double-count the OFE contribution.
  // annuityDivisor: GUS Tablice trwania życia 2022 (combined M+F averages, in MONTHS):
  //   age 60: 24.0yr combined = 288 months
  //   age 65: 19.5yr combined = 234 months
  pensionSystem: {
    type: 'MIXED',
    pillar1: {
      type: 'NDC',
      pillar1ContributionRate: 0.1660, // 16.60% = 12.22% konto + 4.38% subkonto (ZUS NDC only)
      notionalReturnRate: 0.005,       // 0.5% real: wage-bill growth proxy (subkonto valorised at CPI;
                                       // konto at wage-bill growth; blended real ≈0.5%; calibrated to
                                       // OECD PaG 2023 NDC-only RR of ~40.6% at 1×AW, 43yr career).
      annuityDivisor: {
        // GUS Tablice trwania życia 2022 — combined male+female, in months
        60: 288, // 24.0 years = 288 months combined LE at 60 (M:22.0yr + F:26.0yr)
        65: 234, // 19.5 years = 234 months combined LE at 65 (M:17.7yr + F:21.3yr)
      },
      ceiling: ZUS_CEILING,
    },
    pillar2Rate: 0.0292, // OFE (II pillar, opt-in since 2014 reform): 2.92% of gross
  },

  pillar2: {
    available: true,
    mandatory: false, // opt-in since 2014 reform
    contributionRate: 0.0292,
    defaultAnnualReturnRate: 0.030, // 3.0% real net-of-fees — constant prices basis; within OECD 2–3% convention
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
        return `${v.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN/month`;
      },
      explanation:
        'Your employer pays this amount in total. Your contract gross is a subset — the remainder is invisible social charges.',
      sourceNote: 'Ustawa o SUS',
      isKeyInsight: true,
    },
    {
      stepNumber: 2,
      label: 'Step 2: Annual NDC Contribution',
      formula: 'NDC = Gross × 16.60%',
      liveValueFn: (inputs, result) => {
        const ceiling = result.pensionResult.formulaInputs['ceiling'];
        const rate = result.pensionResult.formulaInputs['pillar1ContributionRate'];
        const annualGross = Math.min(inputs.grossMonthly, ceiling) * 12;
        const contrib = annualGross * rate;
        return `${contrib.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN/year`;
      },
      explanation:
        '16.60% of your gross salary is credited to your notional accounts at ZUS (12.22% to the main account and 4.38% to the sub-account).',
      sourceNote: 'ZUS podział składek',
      isKeyInsight: true,
    },
    {
      stepNumber: 3,
      label: 'Step 3: Monthly Pension (NDC)',
      formula: 'Pension = Total Account / Life Expectancy (months)',
      liveValueFn: (_inputs, result) => {
        const v = result.pensionResult.pillar1Monthly;
        return `${v.toLocaleString('pl-PL', { maximumFractionDigits: 0 })} PLN/month`;
      },
      explanation:
        'At retirement, your total notional capital is divided by your remaining life expectancy in months (e.g., 234 months at age 65).',
      sourceNote: 'GUS Tablice trwania życia',
    },
  ],
  dataSourceRefs: [
    {
      parameter: 'averageWage',
      source: 'GUS Przeciętne wynagrodzenie 2026',
      url: 'https://stat.gov.pl',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'eurExchangeRate',
      source: 'ECB SDMX-REST EXR PLN Jan 2026',
      url: 'https://data-api.ecb.europa.eu/service/data/EXR/M.PLN.EUR.SP00.A',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'employeeSSC + employerSSC',
      source: 'MISSOC Table I Jan 2026; Ustawa o SUS',
      url: 'https://www.missoc.org/missoc-database/comparative-tables/',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'incomeTax',
      source: 'Ustawa o PIT — Nowy Polski Ład 2022+ for 2026',
      url: 'https://www.podatki.gov.pl',
      retrievedDate: '2026-01',
      dataYear: 2026,
    },
    {
      parameter: 'pensionSystem — NDC contribution split, annuityDivisor',
      source: 'GUS Tablice trwania życia 2022 (combined M+F); ZUS ustawa podział składek',
      url: 'https://stat.gov.pl/en/topics/population/life-expectancy/',
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
      source: 'Eurostat minimum wage statistics (earn_mw_cur) + Rozporządzenie RM 2026 (minimalne wynagrodzenie)',
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

  // PL: ZUS state pension (emerytura) is taxed as regular income under PIT.
  // The 30 000 PLN/year tax-free amount (kwota wolna od podatku) applies via the standard TaxEngine.
  // Source: Art. 9 ust.1 + art. 10 ust.1 pkt 1 ustawy o PIT (Dz.U. 1991 nr 80 poz. 350 ze zm.).
  pensionTax: {
    method: 'income_tax',
    note: 'Art.9/10(1) PIT: emerytura opodatkowana według skali PIT; kwota wolna 30 000 zł/rok',
  },
};
