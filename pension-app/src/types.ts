// ─── Data Provenance ────────────────────────────────────────────────────────

export interface DataSourceRef {
  parameter: string;      // e.g. "averageWage", "incomeTax.brackets"
  source: string;         // human label, e.g. "OECD Taxing Wages 2025"
  url: string;            // exact URL or API endpoint used
  retrievedDate: string;  // ISO date, e.g. "2026-01"
  dataYear: number;       // year the data represents
}

// ─── Income Tax ─────────────────────────────────────────────────────────────

export interface TaxBracket {
  upTo: number;   // monthly income ceiling (use Infinity for last bracket)
  rate: number;   // e.g. 0.15, 0.23
}

export interface Surcharge {
  label: string;
  rate: number;
  appliesTo: 'gross' | 'income_tax' | 'taxable_income';
}

export interface IncomeTaxConfig {
  type: 'progressive' | 'flat';
  personalAllowance: number;  // monthly, local currency (0 if none)
  /**
   * How the personal allowance is applied for progressive tax:
   *  - false / omitted (default): deducted from the tax base before brackets are applied
   *    (standard for most EU countries, e.g. SK NČZD, FR, IE, PT, SI)
   *  - true: subtracted from the final tax bill directly (tax credit),
   *    e.g. CZ §35ba základní sleva, PL kwota zmniejszająca podatek
   * The flat-rate engine always uses the deduction approach.
   */
  allowanceIsCredit?: boolean;
  brackets?: TaxBracket[];    // progressive only
  flatRate?: number;          // flat only
  taxBase: 'gross' | 'gross_minus_employee_ssc';
  surcharges?: Surcharge[];
  /**
   * CZ § 38h: the monthly záloha (advance tax) is computed on the gross wage
   * rounded UP to the nearest 100 CZK before applying brackets.
   * Set to 'ceil100' for Czech Republic; omit for all other countries.
   */
  taxBaseRounding?: 'ceil100';
}

// ─── SSC ────────────────────────────────────────────────────────────────────

export interface SSCComponent {
  label: string;
  rate: number;             // e.g. 0.065
  ceiling?: number;         // component-level ceiling (monthly, local currency)
  pensionFunded: boolean;   // does this component fund the pension?
  /**
   * When true, the component amount is rounded UP (Math.ceil) to the nearest
   * whole currency unit. Required for CZ/SK health insurance (zákon č. 592/1992 Sb.).
   */
  roundUp?: boolean;
}

export interface SSCConfig {
  components: SSCComponent[];
  ceiling?: number;   // monthly income ceiling (null = uncapped)
  floor?: number;     // minimum contributory base
}

// ─── Pension Systems ────────────────────────────────────────────────────────

export interface ReductionThreshold {
  upTo: number;       // monthly income ceiling
  creditRate: number; // fraction credited (e.g. 0.99, 0.26, 0.00)
}

/** Defined Benefit — e.g. Czech Republic, Hungary, Ireland, Spain, Portugal */
export interface DBConfig {
  type: 'DB';
  basePension: number;                     // fixed monthly base (CZ 2026: 4,900 CZK)
  reductionThresholds: ReductionThreshold[];
  accrualRatePerYear: number;              // e.g. 0.01495 for CZ 2026
  assessmentBase: 'monthly_avg' | 'lifetime_avg';
  ceiling: number;                         // monthly contrib/benefit ceiling (local currency)
  /**
   * Statutory minimum monthly pension (local currency, full-career basis).
   * Applied as a floor: Math.max(formulaPension, minimumMonthlyPension).
   * Note: should be prorated for partial careers in Phase 7.
   */
  minimumMonthlyPension?: number;
}

/** Pension Account — Austria Pensionskonto (post-2005 NDC-like but not classic NDC) */
export type AnnuityTable = Record<number, number>; // retirementAge → divisor

export interface PensionAccountConfig {
  type: 'PENSION_ACCOUNT';
  annualCreditRate: number;     // % of gross credited per year (AT 2026: 1.78%)
  ceiling: number;              // monthly gross ceiling
  valorisationRate: number;     // annual account valorisation rate assumption
  annuityDivisor: AnnuityTable; // Teilungsziffer
}

/** Points-based — Germany, France, Belgium, Slovakia, Luxembourg */
export interface PointsConfig {
  type: 'POINTS';
  pointValue: number;           // EUR/local per point at retirement
  pointValueIndexation: number; // annual indexation rate assumption
  pointsPerAW: number;          // points earned at 1x AW per year (usually 1.0)
  ceiling: number;              // max contributory earnings (in local currency/month)
  referenceWage: number;        // the AW used to normalise (= country AW)
  minimumPension?: number;
  /**
   * Solidarity (redistributive) reduction for high earners, e.g. Slovakia POMB:
   * - solidarityReductionThreshold: monthly gross above which accrual is reduced
   * - solidarityReductionRate: fraction by which excess earnings are downscaled
   *   before computing annual points (0.3 = 30% reduction above threshold).
   */
  solidarityReductionThreshold?: number;
  solidarityReductionRate?: number;
}

/** Notional Defined Contribution — Sweden, Poland, Italy, Latvia, Estonia */
export interface NDCConfig {
  type: 'NDC';
  pillar1ContributionRate: number; // % of gross credited to notional account
  notionalReturnRate: number;      // per-country default (wage growth proxy)
  annuityDivisor: AnnuityTable;    // life expectancy divisor at each retirement age
  ceiling: number;                 // max contributory earnings (monthly local currency)
  minimumPension?: number;
}

/** Mixed — Pillar 1 + mandatory funded Pillar 2 */
export interface MixedConfig {
  type: 'MIXED';
  pillar1: DBConfig | PointsConfig | NDCConfig | PensionAccountConfig;
  pillar2Rate: number; // % of gross redirected to funded account (or PAYG contribution base)
  /**
   * 'funded' (default): accumulates contributions at pillar2ReturnRate, then annuitises over 20yr.
   * 'payg_points': PAYG points (e.g. AGIRC-ARRCO France). Formula:
   *   monthly = grossMonthly × pillar2Rate × years × pillar2PAYGFactor
   */
  pillar2Type?: 'funded' | 'payg_points';
  /** Calibration factor for PAYG points. Converts (rate × years) to a monthly replacement share. */
  pillar2PAYGFactor?: number;
  /**
   * Monthly earnings franchise excluded from P2 contributions (e.g. NL AOW franchise €1,230/mo).
   * P2 contribution base = max(0, grossMonthly − pillar2Franchise) × pillar2Rate.
   */
  pillar2Franchise?: number;
  /** Annual real return rate for funded P2.  Overrides the engine default of 3%. */
  pillar2ReturnRate?: number;
  /**
   * AGIRC-ARRCO Tranche 2 support (France):
   * When set, the P2 contribution is split into two tiers:
   *   T1: min(gross, pillar2Ceiling) × pillar2Rate × years × pillar2PAYGFactor
   *   T2: max(0, gross − pillar2Ceiling) × pillar2T2Rate × years × pillar2T2PAYGFactor
   * Only meaningful when pillar2Type = 'payg_points'.
   */
  pillar2Ceiling?: number;
  pillar2T2Rate?: number;
  pillar2T2PAYGFactor?: number;
}

export type PensionSystemConfig =
  | DBConfig
  | PointsConfig
  | NDCConfig
  | MixedConfig
  | PensionAccountConfig;

// ─── Pension Taxation ──────────────────────────────────────────────────────────

/**
 * Describes how a country taxes pension income in retirement.
 * 'none'         = fully exempt from income tax
 * 'income_tax'   = treated as ordinary income using the country's standard income
 *                  tax rules (TaxEngine), optionally with a taxable fraction or
 *                  monthly allowance applied first.
 */
export interface PensionTaxConfig {
  method: 'none' | 'income_tax';
  /** Fraction of gross pension that is taxable (default 1.0). Germany 2026 cohort: 0.83 */
  taxableFraction?: number;
  /** Fixed monthly allowance deducted before applying income tax (default 0). AT: 72 EUR */
  monthlyAllowance?: number;
  /** Human-readable note citing the legal basis */
  note: string;
}

// ─── Pillar 2 ────────────────────────────────────────────────────────────────

export interface Pillar2Config {
  available: boolean;
  mandatory: boolean;
  contributionRate: number;         // % of gross (may come from SSC redirect)
  defaultAnnualReturnRate: number;  // per-country realistic default
  ceiling?: number;
  fundType: 'individual_account' | 'collective_fund';
}

// ─── Career Defaults ─────────────────────────────────────────────────────────

export interface CareerDefaults {
  careerStartAge: number;       // 25
  retirementAge: number;        // country-specific statutory age
  retirementDuration: number;   // years in retirement (to age 90 default)
}

// ─── Engine Result Types ──────────────────────────────────────────────────────
// Defined here (not in the engine files) to avoid a circular dependency:
//   types.ts (FormulaStep.liveValueFn) needs ScenarioResult
//   ScenarioResult needs TaxResult / SSCResult / PensionResult / etc.
//   Those are defined here; engines import them from types.ts.

export interface BracketBreakdown {
  bracket: string;
  amount: number;   // income taxed at this rate
  tax: number;      // tax due at this rate
}

export interface TaxResult {
  grossMonthly: number;
  taxableBase: number;
  incomeTaxMonthly: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  bracketBreakdown: BracketBreakdown[];
}

export interface SSCComponentResult {
  label: string;
  employeeAmount: number;
  employerAmount: number;
  fundsPension: boolean;
}

export interface SSCResult {
  employeeTotal: number;
  employerTotal: number;
  employeePensionPortion: number;
  employerPensionPortion: number;
  components: SSCComponentResult[];
  totalEmployerCost: number;
}

export interface PensionResult {
  monthlyPension: number;
  pillar1Monthly: number;
  pillar2Monthly?: number;
  replacementRate: number;
  systemType: string;
  formulaInputs: Record<string, number>;
  /** Monthly income tax levied on the pension (0 for exempt countries) */
  pensionIncomeTax?: number;
  /** monthlyPension − pensionIncomeTax */
  netMonthlyPension?: number;
}

export interface YearlySnapshot {
  age: number;
  phase: 'career' | 'retirement';
  grossMonthly?: number;
  netTakeHome?: number;
  incomeTax?: number;
  employeeSSC?: number;
  employerSSC?: number;
  totalEmployerCost?: number;
  employeePensionSSC?: number;
  employerPensionSSC?: number;
  cumulativePensionContributions?: number;
  cumulativeContributionsCompounded?: number;
  cumulativeIncomeTax?: number;
  cumulativeNetTakeHome?: number;
  monthlyPension?: number;
  fairReturnMonthly?: number;
  cumulativePensionReceived?: number;
  /** Cumulative pension received after deducting pension income tax */
  netCumulativePensionReceived?: number;
  cumulativePensionContributionsAtRetirement?: number;
  breakEvenReached?: boolean;
}

export interface FairReturnResult {
  accumulatedPot: number;
  monthlyAnnuity: number;
  totalContributionsPaid: number;
  breakEvenAge: number | null;
}

/**
 * One per selected country — the complete computed output for a given
 * (country, wage, career) scenario.
 */
export interface ScenarioResult {
  resolvedWage: ResolvedWage;
  taxResult: TaxResult;
  sscResult: SSCResult;
  pensionResult: PensionResult;
  timeline: YearlySnapshot[];
  fairReturn: FairReturnResult;
}

// ─── Formula Sidebar ─────────────────────────────────────────────────────────

export interface ScenarioInputs {
  grossMonthly: number;
  careerStartAge: number;
  retirementAge: number;
  retirementDuration: number;
}

export interface FormulaStep {
  stepNumber: number;
  label: string;         // "Step 3: Pension Assessment Base"
  formula: string;       // "ΣEarnings × CreditRate / CareerYears"
  liveValueFn: (inputs: ScenarioInputs, result: ScenarioResult) => string;
  explanation: string;   // plain English
  sourceNote: string;    // legislative citation
  isKeyInsight?: boolean;
}

// ─── Self-Employment (Stub) ─────────────────────────────────────────────────

/**
 * One SSC component for a self-employed person. baseType determines which
 * assessment-base floor is applied (social vs health have different Czech minimums).
 */
export interface SelfEmpSSCComponent {
  label: string;
  rate: number;                        // applied to the relevant assessment base
  baseType: 'social' | 'health';       // determines which min base floor to use
  ceiling?: number;                    // monthly ceiling on the assessment base (local currency)
  pensionFunded: boolean;
  roundUp?: boolean;                   // ceil contribution to whole CZK (health insurance law)
}

export interface SelfEmploymentMode {
  name: string;
  sscMonthlyFixed?: number;
  sscRate?: number;
  pensionBasisRate: number;
  incomeTaxOverride?: IncomeTaxConfig;
  pillar2Eligible: boolean;

  // ── OSVČ / self-employed-specific fields ──────────────────────────────────
  /**
   * Fraction of gross income / profit that forms the SSC assessment base.
   * Czech OSVČ: 0.5 (50% of net profit = vyměřovací základ)
   * Source: §5b zákona č. 589/1992 Sb.; §3a zákona č. 592/1992 Sb.
   */
  assessmentBasisRate?: number;
  /**
   * Minimum monthly social insurance assessment base (local currency).
   * CZ 2026: 25% × AW_month = 12,242 CZK (§5b(2) zákon č. 589/1992 Sb.)
   */
  minSocialInsuranceBase?: number;
  /**
   * Minimum monthly health insurance assessment base (local currency).
   * CZ 2026: 50% × AW_month = 24,484 CZK (§3a zákon č. 592/1992 Sb.)
   */
  minHealthInsuranceBase?: number;
  /**
   * Explicit SSC component structure for self-employed mode.
   * When present, overrides the country's standard employeeSSC / employerSSC.
   * All components are borne entirely by the self-employed person (no employer split).
   */
  sscOverrideComponents?: SelfEmpSSCComponent[];

  /**
   * When set, this is a Czech paušální daň (flat-tax) mode.
   * Income tax is replaced by a fixed monthly advance included in the lump-sum payment;
   * SSC uses the band-specific minimum assessment bases (assessmentBasisRate is forced to 0
   * and the min bases are elevated for Band 2+).
   * Source: Zákon č. 7/2021 Sb., as amended by zákon č. 366/2022 Sb. (reform 2023).
   */
  pausalniDan?: {
    /** Human-readable band label, e.g. "Pásmo 1" */
    bandLabel: string;
    /** Display band number (1, 2 or 3) */
    band: 1 | 2 | 3;
    /** Annual gross income ceiling for this band (local currency per year) */
    annualIncomeLimit: number;
    /**
     * Fixed monthly income tax advance (CZK) that replaces the standard PIT calculation.
     * Band 1: 100 CZK (statutory minimum)
     * Band 2: ~4 963 CZK (2026 decree)
     * Source: Zákon č. 7/2021 Sb. §7a–7h
     */
    fixedMonthlyTaxAdvance: number;
  };
}

export interface SelfEmploymentConfig {
  available: boolean;
  modes: SelfEmploymentMode[];
}

// ─── Master Country Config ─────────────────────────────────────────────────

export interface CountryConfig {
  // Identity
  code: string;             // "CZ", "DE", "PL"
  name: string;
  currency: string;         // "CZK", "EUR", "PLN"
  eurExchangeRate: number;  // updated per data year
  dataYear: number;         // e.g. 2026

  // Wages
  averageWage: number;        // monthly gross, local currency (AW) — model/national-statistics source
  /**
   * Statutory (or effective collective-agreement) monthly gross minimum wage
   * (local currency). Used as the left-boundary cutoff of the wage distribution
   * chart — no worker is paid below this floor.
   * Source: Eurostat minimum wage statistics / national labour ministry decrees 2026.
   * Countries without a statutory minimum (SE, DK, FI, AT, IT) use the effective
   * sectoral floor from the dominant collective agreement.
   */
  minimumWage?: number;
  /**
   * Monthly gross median wage (local currency).
   * Used in the wage distribution chart to parameterise the lognormal curve.
   * Source: Eurostat Structure of Earnings Survey (earn_ses_monthly) / OECD, adjusted to data year.
   * Omit for countries where median data is unavailable — chart falls back to a
   * σ = 0.5 lognormal centred on the averageWage.
   */
  medianWage?: number;
  /**
   * Gross wage percentiles (local currency, monthly) from Eurostat SES / national sources.
   * When present, the wage distribution chart fits a lognormal curve to all five
   * empirical points (P10, P25, P50=medianWage, P75, P90) using OLS in log-space,
   * giving a substantially more accurate distribution shape and mode estimate.
   * Source: Eurostat Structure of Earnings Survey (earn_ses) 2022, adjusted to data year.
   */
  wagePercentiles?: {
    p10: number;  // 10th percentile, monthly gross, local currency
    p25: number;  // 25th percentile
    p75: number;  // 75th percentile
    p90: number;  // 90th percentile
  };
  /**
   * Monthly gross average wage from OECD Taxing Wages (local currency).
   * Used when awSource === 'oecd' to normalise × AW multipliers against the
   * OECD reference benchmark rather than the model's national-statistics estimate.
   * Source: OECD Taxing Wages 2025, Table I.1 (data year 2024).
   * Omit for stub/incomplete countries lacking OECD coverage.
   */
  oecdAverageWage?: number;
  wageMultipliers: number[];  // [0.5, 1.0, 1.5, 2.0, 3.0, 4.0]

  // Pension defaults
  defaults: CareerDefaults;

  // Income Tax
  incomeTax: IncomeTaxConfig;

  // Social Security Contributions
  employeeSSC: SSCConfig;
  employerSSC: SSCConfig;

  // Pension Formula (polymorphic)
  pensionSystem: PensionSystemConfig;

  // Pillar 2 (optional)
  pillar2?: Pillar2Config;

  // Pension taxation in retirement
  pensionTax?: PensionTaxConfig;

  // Formula sidebar content
  formulaSteps: FormulaStep[];

  // Data provenance
  dataSourceRefs: DataSourceRef[];

  // True if pension formula parameters are incomplete
  incomplete?: boolean;

  // Self-employment stub
  selfEmployment?: SelfEmploymentConfig | null;
}

// ─── Wage Mode ───────────────────────────────────────────────────────────────

export type WageMode =
  | { type: 'multiplier'; value: number }
  | { type: 'fixed_gross_eur'; value: number }
  /** User sets the total employer cost (gross + employer SSC) in EUR; gross is back-calculated. */
  | { type: 'fixed_employer_cost_eur'; value: number };

export interface ResolvedWage {
  grossLocal: number;
  grossEUR: number;
  referenceLabel: string;
  averageWageLocal: number;
  averageWageEUR: number;
  displayNote: string;
  impliedMultiplier?: number;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppState {
  selectedCountries: string[];
  wageMode: WageMode;
  /**
   * Maps country code → array of active mode names (or null = standard employee).
   * Each entry in the array produces a separate card column.
   * Total across all countries is capped at MAX_CARDS (3).
   * Example: { CZ: [null, 'OSVČ (Hlavní činnost)', 'Paušální daň – Pásmo 1'] }
   */
  selfEmploymentModes: Record<string, (string | null)[]>;
  /**
   * Which average-wage source to use when wageMode.type === 'multiplier'.
   * 'model'  — country.averageWage (national statistics, default)
   * 'oecd'   — country.oecdAverageWage (OECD Taxing Wages table)
   */
  awSource: 'model' | 'oecd';
  /**
   * Which replacement rate to display in the pension KPI.
   * 'model' — model-computed gross RR (monthlyPension / grossWage)
   * 'oecd'  — OECD Pensions at a Glance tabulated RR (interpolated at current multiplier)
   *           Only meaningful when wageMode.type === 'multiplier'.
   */
  rrSource: 'model' | 'oecd';
  currency: 'EUR' | 'local';
  careerOverrides: Partial<CareerDefaults>;
  activeFormulaSidebarCountry: string;
  sidebarOpen: boolean;
}
