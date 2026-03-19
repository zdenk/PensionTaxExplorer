# EU27 Pension & Tax Burden Explorer — Technical Design

**Version:** 2.0  
**Date:** 2026-03-18  
**Supersedes:** v1.0 (2026-03-18)  
**Status:** Pre-implementation — approved for Phase 1 development

**V2.0 Changes from V1.0:**
- Country scope restricted to the **22 EU OECD member states** where structured, API-accessible data exists; 5 non-OECD EU members (BG, RO, HR, CY, MT) deferred to a future data phase
- New **§2** — Data Sources & API Pipeline — documents every authoritative data source and API endpoint for each parameter category
- `CountryConfig` extended with `dataSourceRefs` for full traceability
- `calcDB` formula corrected (erroneous `/30` divisor removed)
- Austria system type updated to reflect the **Pensionskonto** structure (post-2005)
- Finland TyEL structural design flag added to `NDCConfig` section
- Implementation tiers re-ordered around the 22-country OECD scope
- Czech Republic Appendix A explicitly cites all 2026 MPSV decree parameters

---

## Scope & Disclaimer

### Country Scope — OECD EU-22

Version 2.0 restricts the active country set to the **22 EU member states that are also OECD members**, where income tax bracket schedules, SSC rates, and pension formula parameters are available from structured, machine-readable, and openly licensed data sources (OECD, Eurostat, ECB, MISSOC). See §2 for full source details.

**Included (22 countries):** AT, BE, CZ, DE, DK, EE, ES, FI, FR, GR, HU, IE, IT, LT, LU, LV, NL, PL, PT, SE, SI, SK

**Deferred — non-OECD EU members (5 countries):** BG, RO, HR, CY, MT. These countries are excluded because:
- Income tax brackets require manual scraping from national tax authority websites (no OECD machine-readable coverage)
- Pension formula parameters have no OECD *Pensions at a Glance* country profile
- These countries will be added in a dedicated **Phase 6 – Non-OECD Country Pack** once data entry workflows are established

All 22 `CountryConfig` stubs are populated at V1 with correct system type, SSC rates, and AW (sourced via API). Pension formula parameters are populated by implementation tier per §8.

### Standard Earner Assumptions

This tool models the **standard employee tax and pension position** for a single adult earner with no tax-modifying personal circumstances. The following are explicitly **out of scope for this version** and are flagged as a future phase:

- Child tax credits and family allowances
- Married couple / joint filing tax benefits
- Disability or carer allowances
- Housing deductions and mortgage interest relief
- Pension contribution tax relief (voluntary private pension top-ups)
- Any means-tested benefit entitlements

These factors can significantly alter the effective tax burden in many EU27 countries (notably Germany's Ehegattensplitting, France's Quotient Familial, Czech Republic's child tax credit, etc.). A dedicated **Phase 7 — Personal Circumstances Layer** is reserved in the architecture to accommodate these without requiring a redesign.

---

## 1. Application Architecture Overview

This is a **fully client-side single-page application** — no backend required. All **22 OECD EU country configs**, tax tables, SSC rates, and pension formulas are encoded as static TypeScript/JSON data objects sourced from the APIs described in §1A. The calculation engine consists of pure functions with zero side effects, making every result fully reproducible and auditable.

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│  Controls Bar │ Country Cards (1–3) │ Formula Sidebar           │
│  Charts Panel │ Wage Table          │ Pension Summary           │
├─────────────────────────────────────────────────────────────────┤
│                     CALCULATION ENGINE                          │
│  TaxEngine │ SSCEngine │ PensionEngine │ TimelineBuilder        │
│  FairReturnEngine │ CurrencyConverter                          │
├─────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                               │
│  CountryRegistry[27] │ ExchangeRates │ FormulaDescriptors      │
└─────────────────────────────────────────────────────────────────┘
```

**Technology stack:** React + TypeScript (single-file artifact), Recharts for all graphs, Tailwind for layout. No external dependencies beyond the standard artifact environment.

---

## 1A. Data Sources & API Pipeline

All country parameters are sourced from authoritative, openly licensed datasets. No parameter is invented or estimated. Every `CountryConfig` object carries `dataSourceRefs` (see §2.1) that trace each parameter to its source and year.

The application itself is fully static — no runtime API calls. All data is authored into `countryData.ts` at build time. The APIs below are used during the **annual data refresh workflow** (run each January) to pull the latest values and update the static data file.

### 1A.1 Income Tax Brackets & Rates

| Source | API / Download | EU Coverage | Notes |
|---|---|---|---|
| **OECD Taxing Wages** | SDMX-REST: `https://data-api.oecd.org/datasource/DSD_TAXWAGES@DF_TAXWAGES` | **22 EU OECD members** | Full bracket schedules + marginal/average rates; Excel annexes shipped with annual publication (free download after OECD registration). API dataset code: `DSD_TAXWAGES@DF_TAXWAGES` |
| **EC TAXUD Taxation Trends** | REDISSTAT browser: `https://webgate.ec.europa.eu/taxation_customs/redisstat` | All 27 (statutory top rates only) | CC BY 4.0; full bracket schedules not machine-readable |
| **PwC Worldwide Tax Summaries** | HTML scrape: `https://taxsummaries.pwc.com` | All 27 | Fallback for manual verification; not redistributable |

**Annual refresh command (OECD SDMX API example):**
```
GET https://data-api.oecd.org/datasource/DSD_TAXWAGES@DF_TAXWAGES/CZE+DEU+AUT+POL+SVK.T_PIT_BRACKET+T_SSC_EE+T_SSC_ER?startPeriod=2025&endPeriod=2026&format=csvfilewithlabels
```

### 1A.2 SSC Rates (All 22 countries)

| Source | Access | Coverage | Notes |
|---|---|---|---|
| **MISSOC Comparative Tables** | Direct Excel export: `https://www.missoc.org/missoc-database/comparative-tables/` → Table I: Financing | All EU27 + EFTA; restricted to OECD-22 for this app | Updated twice yearly (1 Jan, 1 Jul). Employee & employer rates, contribution ceilings, split by scheme type (old-age, health, unemployment, accidents). **Recommended primary source.** |
| **OECD Taxing Wages Excel annexes** | Same as §1A.1 | OECD-22 | Cleaner decomposition into pension/health/unemployment sub-components for OECD members; supplement MISSOC for sub-component breakdown |

**Workflow:** Download MISSOC Table I Excel → map narrative cells to `SSCComponent[]` array per country → cross-reference sub-component split with OECD Taxing Wages country chapter.

### 1A.3 Average Wages

| Source | API Endpoint | Coverage | Notes |
|---|---|---|---|
| **Eurostat `earn_ses_monthly`** | `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/earn_ses_monthly?format=JSON` | All EU27 confirmed | Mean monthly earnings in EUR and national currency. CC BY 4.0. **4-year survey cycle** — latest = 2022. |
| **Eurostat `earn_nt_net`** | `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/earn_nt_net?format=JSON` | 39 countries incl. all EU27 | Annual net earnings at 5 AW multiples (50%/67%/100%/133%/167%) — useful for inter-survey year estimates. Updated Feb 2026. |
| **OECD Average Wages** | `https://data-api.oecd.org/datasource/AV_AN_WAGE` | 22 EU OECD members | Annual gross wages in national currency; 1990–2024. |

**Annual refresh example (Eurostat):**
```
GET https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/earn_nt_net/A.CZ+DE+AT+PL+SK.B.100.TOTAL.TOTAL.NAC?lastObservations=1&format=JSON
```

### 1A.4 EUR Exchange Rates

| Source | API Endpoint | Coverage | Notes |
|---|---|---|---|
| **ECB SDMX-REST** | `https://data-api.ecb.europa.eu/service/data/EXR/M.CZK+PLN+HUF+SEK+DKK.EUR.SP00.A?format=csvdata&lastNObservations=12` | All non-EUR EU currencies | Daily/monthly/annual reference rates. Free, no key. JSON or CSV. |

**Non-EUR currencies in scope (OECD-22):** CZK (CZ), PLN (PL), HUF (HU), SEK (SE), DKK (DK). All others in the OECD-22 use EUR.

**Special cases:**
- **BGN** (Bulgaria, non-OECD): fixed peg 1.95583 BGN/EUR since 1999 — excluded from scope in v2.0
- **HRK** (Croatia, non-OECD): joined eurozone 1 Jan 2023 — excluded from scope in v2.0

### 1A.5 Pension Formula Parameters

No single machine-readable API covers all EU27 pension formula parameters. The **OECD *Pensions at a Glance*** (biennial, downloadable Excel annexes) is the primary comparative reference for the 22 OECD EU members. Country-specific annual parameters (ceilings, indexation factors, base amounts) must be sourced from national social insurance authorities.

| Country | Authority | URL | Key parameters |
|---|---|---|---|
| **CZ** | ČSSZ / MPSV | `https://mpsv.gov.cz/dulezite-parametry` | Redukční hranice, základní výměra, procentní výměra, AW decree |
| **DE** | DRV | `https://www.deutsche-rentenversicherung.de/.../rechengroessen_node.html` | Rentenwert (€/point), Beitragsbemessungsgrenze, Durchschnittsentgelt |
| **AT** | PVA / BMSGPK | `https://www.sozialministerium.gv.at/Themen/Pension/Das-Pensionskonto.html` | Kontogutschrift rate (1.78%/yr), Höchstbeitragsgrundlage, Teilungsziffer |
| **SK** | Sociálna Poisťovňa | `https://www.socpoist.sk/en/social-insurance/pension-insurance` | POMB point value, Pillar 1 / Pillar 2 split |
| **PL** | ZUS + GUS | `https://www.zus.pl/en` + `https://stat.gov.pl/en/topics/population/life-expectancy/` | NDC rate, ZUS sub-account rate, OFE rate, GUS life expectancy tables |
| **SE** | Pensionsmyndigheten | Orange Report: `https://www.pensionsmyndigheten.se/en/about-us/publications/the-orange-report` | G-value (delningstal) divisor table, inkomstpension rate |
| **IT** | INPS / MEF | `https://www.inps.it` + MEF coefficienti di trasformazione decree | Conversion coefficients (% of capital → annual pension), updated every 3 years |
| **LV** | VSAA + CSB | `https://www.csb.gov.lv/en/statistics/.../life-tables` | NDC rate, life expectancy divisors |
| **EE** | SKA + Statistics Estonia | `https://www.stat.ee/en/.../life-tables` | NDC rate, Pillar 2 contribution rate, life expectancy divisors |
| **FI** | ETK | `https://www.etk.fi/en/the-pension-system/statistics/life-expectancy-coefficient/` | Life expectancy coefficient (elinaikakerroin) — **not a capital divisor** (see §2.4 note) |
| **All OECD-22** | OECD *Pensions at a Glance* | `https://www.oecd-ilibrary.org/finance-and-investment/pensions-at-a-glance_19991363` | Cross-country reference; Excel statistical annexes per biennial edition |

**Data maintenance discipline:** Every `CountryConfig.dataSourceRefs` entry carries a `retrievedDate` field. An annual refresh of pension parameters is scheduled each January after national decrees are published. The `dataYear` field on every `CountryConfig` is the authoritative version stamp shown in the UI.

### 1A.6 NDC Annuity Divisor Tables

NDC systems require a life expectancy divisor (or equivalent) specific to each country's actuarial methodology. These are not available via any unified API:

| Country | Divisor type | Source & update cycle |
|---|---|---|
| **PL** | Life expectancy at exact retirement age (joint male/female) | GUS life tables CSV — annual |
| **SE** | *Delningstal* (G-value) per birth cohort at retirement age | Pensionsmyndigheten Orange Report appendix — annual |
| **IT** | *Coefficienti di trasformazione* (% of capital → annual pension) | MEF ministerial decree — every 3 years |
| **LV** | Remaining life expectancy | CSB Latvia life tables — annual |
| **EE** | Remaining life expectancy | Statistics Estonia life tables — annual |
| **FI** | *Elinaikakerroin* (life expectancy coefficient — a multiplier, not a divisor) | ETK published table — annual. **Structural note:** Finland's TyEL is an earnings-accrual DB with a longevity penalty multiplier, not a capital-division NDC. The `NDCConfig.annuityDivisor` type does not model this correctly. Finland requires a `TyELConfig` variant or a `DBConfig` with a `longevityAdjustment` field. Flagged as a design debt item before Tier 3 implementation. |

---

## 2. Data Model

### 2.1 Country Config — The Master Schema

Every OECD EU-22 country is represented by exactly one `CountryConfig` object. This is the most critical data structure in the application.

```typescript
interface CountryConfig {
  // Identity
  code: string;              // "CZ", "DE", "PL" ...
  name: string;
  currency: string;          // "CZK", "EUR", "PLN" ...
  eurExchangeRate: number;   // updated manually per data year
  dataYear: number;          // e.g. 2026

  // Wages
  averageWage: number;       // monthly gross, local currency (AW)
  wageMultipliers: number[]; // [0.5, 1.0, 1.5, 2.0, 3.0, 4.0] — defaults

  // Pension defaults (country-specific, overridable by user)
  defaults: {
    careerStartAge: number;       // 25
    retirementAge: number;        // country-specific statutory age
    retirementDuration: number;   // years in retirement (to age 90 default)
  };

  // Income Tax
  incomeTax: IncomeTaxConfig;

  // Social Security Contributions
  employeeSSC: SSCConfig;
  employerSSC: SSCConfig;

  // Pension Formula (polymorphic — see §2.4)
  pensionSystem: PensionSystemConfig;

  // Pillar 2 (optional funded component)
  pillar2?: Pillar2Config;

  // Formula sidebar content (human-readable derivation steps)
  formulaSteps: FormulaStep[];

  // Data provenance — links every parameter to its source (see §1A)
  dataSourceRefs: DataSourceRef[];

  // True if pension formula parameters are incomplete for this country (see §8 stub principle)
  incomplete?: boolean;

  // Future: self-employment stub (see §8)
  selfEmployment?: SelfEmploymentConfig | null;
}

interface DataSourceRef {
  parameter: string;        // e.g. "averageWage", "employeeSSC", "incomeTax.brackets"
  source: string;           // human label, e.g. "OECD Taxing Wages 2025"
  url: string;              // exact URL or API endpoint used
  retrievedDate: string;    // ISO date of last retrieval, e.g. "2026-01"
  dataYear: number;         // year the data represents
}
```

### 2.2 Income Tax Config

Supports progressive brackets (most EU countries) and flat tax (Hungary, Estonia in OECD-22 scope):

```typescript
interface IncomeTaxConfig {
  type: 'progressive' | 'flat';
  personalAllowance: number;    // monthly, local currency (0 if none)
  brackets?: TaxBracket[];      // progressive only
  flatRate?: number;            // flat only
  taxBase: 'gross' | 'gross_minus_employee_ssc'; // varies by country
  surcharges?: Surcharge[];     // e.g. French CSG, solidarity taxes
}

interface TaxBracket {
  upTo: number;    // monthly income ceiling (Infinity for last bracket)
  rate: number;    // e.g. 0.15, 0.23
}
```

### 2.3 SSC Config

SSC is broken down into individual components. This is essential for the "SSC redistribution after pension" view — you can trace exactly which fraction of the SSC rate funds the pension versus health insurance versus unemployment.

```typescript
interface SSCConfig {
  components: SSCComponent[];
  ceiling?: number;   // monthly income ceiling (null = uncapped)
  floor?: number;     // minimum contributory base
}

interface SSCComponent {
  label: string;        // "Pension Insurance", "Health Insurance", "Unemployment"
  rate: number;         // 0.065, 0.248, etc.
  ceiling?: number;     // component-level ceiling if different from overall
  pensionFunded: boolean; // does this component fund the pension?
}
```

### 2.4 Pension System Config — Polymorphic Core

Three pension system types, each with its own formula shape. TypeScript narrows on the `.type` discriminant.

```typescript
type PensionSystemConfig = DBConfig | PointsConfig | NDCConfig | MixedConfig | PensionAccountConfig;

// DEFINED BENEFIT
// OECD-22 countries: Czech Republic, Hungary, Greece (EFKA), Ireland (PRSI flat-rate),
//   Spain (earnings-related), Portugal (earnings-related), Belgium (wage-history)
// NOTE: Austria is NOT modelled as DB — see PensionAccountConfig below.
// NOTE: Romania, Bulgaria, Croatia excluded from OECD-22 scope.
interface DBConfig {
  type: 'DB';
  basePension: number;           // fixed monthly base (CZ 2026: 4,900 CZK)
  reductionThresholds: {
    upTo: number;                // monthly income ceiling
    creditRate: number;          // fraction credited (CZ 2026: 0.99, 0.26, 0.00)
  }[];
  // CZ 2026: 1.495% (reform reduced from 1.500% in 2025; decreasing 0.005pp/yr until 1.450% in 2035)
  // Source: ČSSZ / Nařízení vlády (Government Decree) for pension year 2026
  accrualRatePerYear: number;    // % of credited earnings per career year
  assessmentBase: 'monthly_avg' | 'lifetime_avg';
  ceiling: number;               // contribution/benefit ceiling in AW multiples
}

// PENSION ACCOUNT (Notional accumulation — not a classic NDC, not a classic DB)
// Countries: Austria (Pensionskonto, post-2005)
// Pre-2005 periods use a transitional ASVG DB formula — model as MixedConfig with a DB pillar1
// for the legacy tranche and PensionAccountConfig for new accruals.
interface PensionAccountConfig {
  type: 'PENSION_ACCOUNT';
  annualCreditRate: number;      // % of gross credited as Kontogutschrift per year (AT 2026: 1.78%)
  ceiling: number;               // monthly gross ceiling (AT 2026: 6,450 EUR/month)
  valorisationRate: number;      // annual account valorisation assumption (wage/CPI blended)
  annuityDivisor: AnnuityTable;  // Teilungsziffer — remaining life expectancy at retirement age ÷ 14 payment months
}

// POINTS-BASED
// Countries: Germany, France, Belgium, Slovakia, Luxembourg
interface PointsConfig {
  type: 'POINTS';
  pointValue: number;            // EUR/local per point at retirement
  pointValueIndexation: number;  // annual indexation rate assumption
  pointsPerAW: number;           // points earned at 1x AW per year (usually 1.0)
  ceiling: number;               // max points per year (in AW multiples)
  referenceWage: number;         // the AW used to normalize (= country AW)
  minimumPension?: number;
}

// NDC — NOTIONAL DEFINED CONTRIBUTION
// OECD-22 countries: Sweden, Poland, Italy, Latvia, Estonia
// DESIGN NOTE — Finland (TyEL): Finland's statutory pension system is an earnings-accrual DB
// with an age-dependent accrual rate, NOT a capital-division NDC. It uses a life expectancy
// *coefficient* (elinaikakerroin) as a downward multiplier on the benefit, not an annuity divisor.
// Finland must be modelled with DBConfig (age-banded accrual rates) + a longevityAdjustment
// multiplier field. This is a design debt item — flagged for resolution before Tier 3 (SE/FI/DK)
// implementation. See §1A.6.
interface NDCConfig {
  type: 'NDC';
  pillar1ContributionRate: number;  // % of gross credited to notional account
  notionalReturnRate: number;       // per-country default (wage growth proxy)
  annuityDivisor: AnnuityTable;     // life expectancy divisor at each retirement age
                                    // Source per country: PL=GUS life tables; SE=Orange Report G-value;
                                    //   IT=MEF coefficienti (3-yr decree); LV=CSB Latvia; EE=Statistics Estonia
  ceiling: number;                  // in AW multiples
  minimumPension?: number;
}

// MIXED
// Most countries with mandatory funded Pillar 2 alongside Pillar 1
interface MixedConfig {
  type: 'MIXED';
  pillar1: DBConfig | PointsConfig | NDCConfig;
  pillar2Rate: number;  // % of gross redirected to funded account
}
```

### 2.5 Pillar 2 Config

For countries with funded individual accounts (Estonia, Latvia, Slovakia, Poland OFE, etc.):

```typescript
interface Pillar2Config {
  available: boolean;
  mandatory: boolean;
  contributionRate: number;           // % of gross (may come from SSC redirect)
  defaultAnnualReturnRate: number;    // per-country realistic default
  ceiling?: number;
  fundType: 'individual_account' | 'collective_fund';
}
```

### 2.6 Formula Step — Sidebar Content

```typescript
interface FormulaStep {
  stepNumber: number;
  label: string;           // "Step 3: Pension Assessment Base"
  formula: string;         // "ΣEarnings × CreditRate / CareerYears"
  liveValueFn: (inputs: ScenarioInputs, result: ScenarioResult) => string;
                           // returns live-computed value as string, updates reactively
  explanation: string;     // plain English, jargon-free
  sourceNote: string;      // e.g. "MPSV Decree 2026 / §15 Act 155/1995"
  isKeyInsight?: boolean;  // highlights the "grind" threshold step
}
```

The `liveValueFn` makes the sidebar interactive — every step recomputes when the user changes their wage input.

---

## 3. Calculation Engine

Five pure modules, each independently testable. No module holds state.

### 3.1 `TaxEngine.calculate(country, grossMonthly) → TaxResult`

```typescript
interface TaxResult {
  grossMonthly: number;
  taxableBase: number;          // after personal allowance and SSC deduction if applicable
  incomeTaxMonthly: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  bracketBreakdown: {
    bracket: string;
    amount: number;
    tax: number;
  }[];
}
```

### 3.2 `SSCEngine.calculate(country, grossMonthly) → SSCResult`

```typescript
interface SSCResult {
  employeeTotal: number;
  employerTotal: number;
  employeePensionPortion: number;   // the slice that funds pension specifically
  employerPensionPortion: number;
  components: {
    label: string;
    employeeAmount: number;
    employerAmount: number;
    fundsPension: boolean;
  }[];
  totalEmployerCost: number;        // gross + employer SSC = true cost of employment
}
```

### 3.3 `PensionEngine.calculate(country, grossMonthly, careerYears, retirementAge) → PensionResult`

Dispatches to a sub-calculator based on `pensionSystem.type`:

```typescript
// DB sub-calculator (Czech Republic example)
// Formula: pension = basePension + (výpočtový základ × years × accrualRatePerYear)
// where výpočtový základ (credited) is the monthly assessment base after reduction.
// CZ 2026 params: basePension=4900, thresholds=[21546@99%, 195868@26%, ∞@0%], accrualRate=1.495%/yr
// Source: ČSSZ / Nařízení vlády for pension year 2026; Act 155/1995 Sb § 15-16
function calcDB(config: DBConfig, avgMonthlyEarnings: number, years: number): number {
  let credited = 0;
  let previousThreshold = 0;
  for (const threshold of config.reductionThresholds) {
    const slice = Math.min(avgMonthlyEarnings, threshold.upTo) - previousThreshold;
    credited += Math.max(0, slice) * threshold.creditRate;
    previousThreshold = threshold.upTo;
  }
  // BUG FIX (v2.0): removed erroneous /30 divisor present in v1.0.
  // credited is already a monthly CZK figure; no day-conversion is needed.
  // Validated against Appendix A reference table: 1x AW → 19,792 CZK ✓
  const percentagePension = credited * years * config.accrualRatePerYear;
  return config.basePension + percentagePension;
}

// Pension Account sub-calculator (Austria — Pensionskonto, post-2005)
// Formula: account balance at retirement ÷ Teilungsziffer (life expectancy divisor ÷ 14 months)
// Source: PVA / BMSGPK; ASVG §§ 14-15 (Pensionskontorecht since SVÄG 2003)
function calcPensionAccount(
  config: PensionAccountConfig,
  grossMonthly: number,
  years: number,
  valorisationRate: number,
  retirementAge: number
): number {
  let account = 0;
  for (let y = 0; y < years; y++) {
    const annualCredit =
      Math.min(grossMonthly, config.ceiling) * 12 * config.annualCreditRate;
    account = (account + annualCredit) * (1 + valorisationRate);
  }
  const teilungsziffer = config.annuityDivisor[retirementAge] ?? config.annuityDivisor[65];
  return (account / teilungsziffer) / 14 * 12; // convert 14-payment-months to monthly
}

// Points sub-calculator (Germany example)
function calcPoints(config: PointsConfig, grossMonthly: number, years: number): number {
  const annualPoints = Math.min(grossMonthly * 12 / config.referenceWage, config.ceiling);
  const totalPoints = annualPoints * years;
  return totalPoints * config.pointValue; // + indexation applied
}

// NDC sub-calculator (Poland / Sweden / Italy example)
function calcNDC(
  config: NDCConfig,
  grossMonthly: number,
  years: number,
  returnRate: number,
  retirementAge: number
): number {
  let account = 0;
  for (let y = 0; y < years; y++) {
    const annualContribution =
      Math.min(grossMonthly, config.ceiling) * 12 * config.pillar1ContributionRate;
    account = (account + annualContribution) * (1 + returnRate);
  }
  const divisor = config.annuityDivisor[retirementAge] ?? config.annuityDivisor[65];
  return account / divisor / 12; // monthly pension
}

interface PensionResult {
  monthlyPension: number;
  pillar1Monthly: number;
  pillar2Monthly?: number;           // if funded pillar exists
  replacementRate: number;           // pension / gross salary
  systemType: string;                // 'DB' | 'POINTS' | 'NDC' | 'MIXED'
  formulaInputs: Record<string, number>; // all intermediate values for sidebar
}
```

### 3.4 `TimelineBuilder.build(country, grossMonthly, careerStart, retirementAge) → YearlySnapshot[]`

Produces one record per age from 25 to 90:

```typescript
interface YearlySnapshot {
  age: number;
  phase: 'career' | 'retirement';

  // Career phase
  grossMonthly?: number;
  netTakeHome?: number;
  incomeTax?: number;
  employeeSSC?: number;
  employerSSC?: number;              // overhead above gross
  totalEmployerCost?: number;        // gross + employer SSC

  // Cumulative (career phase)
  cumulativeContributionsPaid?: number;
  cumulativeContributionsInvested?: number; // compounded at per-country Pillar 2 return rate

  // Retirement phase
  monthlyPension?: number;
  fairReturnMonthly?: number;        // annuity if contributions had earned return rate
  cumulativePensionReceived?: number;
  breakEvenReached?: boolean;        // cumulative received >= cumulative paid
}
```

### 3.5 `FairReturnEngine.calculate(...) → FairReturnResult`

The "fair return" concept: what monthly annuity would you receive if your total pension contributions were invested at the per-country Pillar 2 return rate and paid out as a level annuity over retirement?

```typescript
function calculateFairReturn(
  totalContributions: number,    // all SSC that funded pension over career years
  annualReturnRate: number,      // per-country Pillar 2 default
  careerYears: number,
  retirementYears: number
): FairReturnResult {
  // Future value of contributions at retirement
  const fv = buildFutureValue(totalContributions, annualReturnRate, careerYears);
  // Level monthly annuity that exhausts the pot over retirement
  const r = annualReturnRate / 12;
  const n = retirementYears * 12;
  const monthlyAnnuity = fv * r / (1 - Math.pow(1 + r, -n));
  return { accumulatedPot: fv, monthlyAnnuity };
}
```

---

## 4. Wage Input & Cross-Country Comparison

### 4.1 The Two Comparison Intents

The original single `wageInput` conflated two analytically distinct comparison modes. Both are now explicit:

| Mode | Intent | Behaviour |
|---|---|---|
| **Multiplier of AW** | "Show me how the same *relative* position (1.5x AW) is treated in each country" | Each country resolves to its own AW × multiplier — different absolute amounts |
| **Fixed Gross (EUR)** | "Show me how the same *absolute* salary is treated in each country" | Same EUR amount converted to local currency in each country |

### 4.2 Updated Wage Input State

```typescript
type WageMode =
  | { type: 'multiplier'; value: number }         // e.g. 1.5 — resolves differently per country
  | { type: 'fixed_gross_eur'; value: number };   // e.g. 3000 EUR — same amount everywhere

interface AppState {
  selectedCountries: string[];          // ['CZ', 'DE', 'AT'] — max 3
  wageMode: WageMode;
  currency: 'EUR' | 'local';
  careerOverrides: Partial<CareerDefaults>;
  activeFormulaSidebarCountry: string;
  sidebarOpen: boolean;
}
```

### 4.3 Wage Resolution per Country

```typescript
interface ResolvedWage {
  grossLocal: number;
  grossEUR: number;
  referenceLabel: string;
  averageWageLocal: number;
  averageWageEUR: number;
  displayNote: string;
  impliedMultiplier?: number;   // populated in fixed_gross_eur mode
}

function resolveGross(mode: WageMode, country: CountryConfig): ResolvedWage {
  switch (mode.type) {
    case 'multiplier':
      return {
        grossLocal: country.averageWage * mode.value,
        grossEUR: (country.averageWage * mode.value) / country.eurExchangeRate,
        referenceLabel: `${mode.value}x AW`,
        averageWageLocal: country.averageWage,
        averageWageEUR: country.averageWage / country.eurExchangeRate,
        displayNote: `1x AW = ${formatCurrency(country.averageWage, country.currency)}`
      };

    case 'fixed_gross_eur':
      const impliedMultiplier =
        (mode.value * country.eurExchangeRate) / country.averageWage;
      return {
        grossLocal: mode.value * country.eurExchangeRate,
        grossEUR: mode.value,
        referenceLabel: `${formatEUR(mode.value)} fixed`,
        averageWageLocal: country.averageWage,
        averageWageEUR: country.averageWage / country.eurExchangeRate,
        impliedMultiplier,
        displayNote: `= ${impliedMultiplier.toFixed(2)}x AW in ${country.name}`
      };
  }
}
```

### 4.4 Controls Bar — Layout Specification

```
┌────────────────────────────────────────────────────────────────────┐
│ WAGE MODE                                                          │
│  ○ Multiplier of Average Wage    ○ Fixed Gross (EUR)               │
│                                                                    │
│ [MULTIPLIER MODE]                                                  │
│  Multiplier: ──●────────────  1.5x                                 │
│  Presets: [0.5x] [1.0x] [1.5x] [2.0x] [3.0x] [4.0x]             │
│                                                                    │
│  Per-country AW reference (live, per selected countries):          │
│  ┌──────────┬──────────────────┬──────────────┐                   │
│  │ Country  │ 1x AW            │ Your wage    │                   │
│  ├──────────┼──────────────────┼──────────────┤                   │
│  │ 🇨🇿 CZ   │ 48,967 CZK       │ 73,451 CZK   │                   │
│  │          │ ≈ €1,959         │ ≈ €2,938     │                   │
│  ├──────────┼──────────────────┼──────────────┤                   │
│  │ 🇩🇪 DE   │ €4,323           │ €6,485       │                   │
│  └──────────┴──────────────────┴──────────────┘                   │
│                                                                    │
│ [FIXED GROSS MODE]                                                 │
│  Gross salary (EUR/month): [    3,000    ] EUR                     │
│                                                                    │
│  Per-country implied position (live):                              │
│  ┌──────────┬──────────────────┬──────────────┐                   │
│  │ Country  │ 1x AW            │ = X.Xx AW    │                   │
│  ├──────────┼──────────────────┼──────────────┤                   │
│  │ 🇨🇿 CZ   │ €1,959 / mo      │ = 1.53x AW   │                   │
│  │ 🇩🇪 DE   │ €4,323 / mo      │ = 0.69x AW ⚠│                   │
│  └──────────┴──────────────────┴──────────────┘                   │
│  ⚠ = below average wage in this country                           │
└────────────────────────────────────────────────────────────────────┘
```

**Behavioural rules:**
- The AW reference table is always visible when 2+ countries are selected
- In fixed gross mode, a warning badge appears if the entered amount falls below the average wage for a given country
- In fixed gross mode, the implied multiplier updates live as you type
- When 2+ countries are selected with different local currencies, the currency toggle auto-locks to EUR with a tooltip: *"Local currency display is only available for single-country view, as cross-country values are not directly comparable."*

### 4.5 Career Override Panel (collapsible)

```
▼ Career Assumptions
  Career start age:    [─●──────] 25
  Retirement age:      [──────●─] 65  (country default: 65)
  Retirement duration: [────●───] 25 years (to age 90)
```

Country-specific statutory retirement age is the default. The user can override per session. Overrides persist across country switches within the session.

---

## 5. UI Layout & Component Hierarchy

```
App
├── ControlsBar
│   ├── CountrySelector (multi, max 3)
│   ├── WageModeToggle (Multiplier | Fixed Gross EUR)
│   ├── WageInput (multiplier slider + presets OR EUR gross field)
│   ├── AWReferenceTable (always visible when 2+ countries)
│   ├── CurrencyToggle (EUR | Local — disabled in multi-currency comparison)
│   └── CareerOverridePanel (collapsible)
│
├── MainLayout (side-by-side columns per country, max 3)
│   └── CountryCard (×1–3)
│       ├── CountryHeader
│       │   ├── Flag, name, data year
│       │   └── System type badge (DB | POINTS | NDC | MIXED)
│       │
│       ├── KPIRow (3 headline cards)
│       │   ├── [PRIMARY] Total Employer Cost + overhead %
│       │   ├── Contract Gross Salary
│       │   └── Net Take-Home + % of gross
│       │
│       ├── WageBreakdownTable
│       │   ├── Total Employer Cost (headline row, bold)
│       │   ├── Employer SSC — per component
│       │   ├── ─── Gross Salary boundary ───
│       │   ├── Employee SSC — per component
│       │   ├── Income Tax
│       │   └── Net Take-Home
│       │
│       ├── SSCRedistributionTable
│       │   ├── Pension Insurance portion (employee + employer)
│       │   ├── Health Insurance portion
│       │   ├── Other (unemployment, accident, etc.)
│       │   └── Country pension start age (statutory default + override)
│       │
│       ├── Graph1_CareerTimeline (age 25 → 90)
│       └── Graph2_PensionAccumulation
│
└── FormulaSidebar (collapsible, right panel)
    ├── CountrySelector (mirrors active country card)
    ├── SystemTypeBadge + plain-English system description
    └── FormulaStepList
        └── FormulaStepCard (×N steps)
            ├── Step number + label
            ├── Formula expression
            ├── Live computed value (updates reactively on wage change)
            ├── Plain English explanation
            ├── Source / legislation note
            └── [KEY INSIGHT badge if isKeyInsight = true]
```

---

## 6. Graph Specifications

### Graph 1: Age 25–90 Career & Pension Timeline

**Chart type:** Stacked bar chart (career phase) transitioning to line overlay (pension phase). Primary visual axis is **Total Employer Cost** — the true price of the employee.

#### Career Phase Stack (25 → retirement age)

The stack runs from **bottom (Total Employer Cost) upward**, with the gross wage boundary marked explicitly. The mental model is: the employer pays the total bar; the gross salary is a highlighted inner container; net take-home is the residue inside that.

| Layer | Direction | Colour | Label | Tooltip |
|---|---|---|---|---|
| Employer SSC — Pension | Bottom (outside gross) | `#94a3b8` slate | Er Pension | "Paid above your contract — invisible overhead" |
| Employer SSC — Health | Above | `#cbd5e1` light slate | Er Health | "Invisible overhead" |
| Employer SSC — Other | Above | `#e2e8f0` very light | Er Other | "Invisible overhead" |
| **── GROSS WAGE boundary (dashed reference line) ──** | | `#1e293b` | Contract gross | "This is what your employment contract states" |
| Income Tax | Inside gross | `#f87171` red | Income Tax | "PIT paid to state" |
| Employee SSC — Pension | Above | `#facc15` yellow | Ee Pension | "Funds your pension" |
| Employee SSC — Health | Above | `#fb923c` amber | Ee Health | "Funds healthcare" |
| Employee SSC — Other | Above | `#fdba74` light amber | Ee Other | "Unemployment etc." |
| Net Take-Home | Top (innermost) | `#22c55e` bright green | Net Pay | "Arrives in your account" |

**Total bar height = Total Employer Cost = Gross + Employer SSC**

#### The Gross Wage Boundary Marker

A horizontal dashed reference line cuts across each bar at the gross salary level:

```typescript
<ReferenceLine
  y={grossMonthly}
  stroke="#1e293b"
  strokeDasharray="6 3"
  strokeWidth={2}
  label={{
    value: `Gross: ${formatCurrency(grossMonthly)}`,
    position: 'insideTopRight',
    fontSize: 11,
    fill: '#1e293b'
  }}
/>
```

Everything above this line is employer overhead the employee never sees. Everything below is their gross.

#### Hidden Wedge Callout (first load only, dismissible)

> **"Hidden cost: Your employer pays [X,XXX] above your contract salary every month in social charges. This never appears on your payslip."**

After dismissal, this becomes a permanent legend entry.

#### KPI Cards (above Graph 1)

```
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│ TOTAL EMPLOYER COST │  │   CONTRACT GROSS    │  │   NET TAKE-HOME     │
│   109,234 CZK/mo   │  │    73,451 CZK/mo   │  │    52,180 CZK/mo   │
│   (≈ €4,369)        │  │    (≈ €2,938)       │  │    (≈ €2,087)       │
│  Overhead: +48.7%   │  │   of employer cost  │  │   47.7% of gross    │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
     ▲ PRIMARY                                          ▲ PUNCHLINE
```

The "Overhead: +X%" figure is the single most revealing number for cross-country comparison. It is also Step 1 of every country's formula sidebar.

#### Retirement Phase Overlay (retirement age → 90)

Two overlaid lines rendered on the same chart after the retirement age marker:

| Line | Style | Meaning |
|---|---|---|
| Actual monthly pension | Solid | What the state pension system pays |
| Fair Return annuity | Dashed | What you'd receive if contributions had been privately invested |
| Shaded area between | Red or green fill | "Penalty zone" (pension < fair return) or "bonus zone" (pension > fair return) |

A vertical **break-even marker** annotates the age at which cumulative pension received equals cumulative contributions paid.

#### Vertical Phase Separator

A clear vertical line + label at the statutory retirement age: **"Retirement — age 65"** (per country default or override).

---

### Graph 2: Pension Accumulation & Redistribution

**Chart type:** Two-phase line chart, split at the retirement age marker.

#### Phase 1 — Accumulation (career, age 25 → retirement)

| Line | Style | Meaning |
|---|---|---|
| Cumulative raw contributions | Solid | Employee + employer pension-portion SSC, no return |
| Contributions compounded | Dashed | Same contributions at per-country Pillar 2 return rate |

These two lines diverge upward over the career, visually showing the opportunity cost of the PAYG system versus a funded equivalent.

#### Phase 2 — Redistribution (retirement, retirement age → 90)

Both lines reverse direction as the pension is consumed:

| Line | Behaviour |
|---|---|
| Raw contributions line | Descends faster — smaller pot drawn down at same pension rate |
| Compounded line | Descends slower — larger pot, may never reach zero |

Annotations:
- "Contributions exhausted at age X" (raw line hits zero)
- "Compounded pot exhausted at age Y" (or "never exhausted" if the return sustains indefinitely)

Shaded zones:
- Green: contributions not yet exhausted — system has returned value
- Red: contributions exhausted, pension funded by cross-subsidy from current workers (PAYG reality)

#### Per-Country Return Rate Input

Each country with a Pillar 2 shows a small slider directly above Graph 2:

```
Annual return rate: [──●──────] 3.5%  (default: per country)
  ○ Pessimistic (1.5%)  ○ Base (3.5%)  ○ Optimistic (6%)
```

---

## 7. Country Data — System Type Map & Implementation Priority

### OECD EU-22 Pension System Classification

**In scope (22 countries) — OECD members with structured API-sourced data:**

| Country | Model Type | Key Complexity | Config Type |
|---|---|---|---|
| 🇨🇿 Czech Republic | DB | 3 reduction thresholds; base pension; 1.495% accrual/yr (2026) | `DBConfig` |
| 🇩🇪 Germany | POINTS | Entgeltpunkte; annual BBG ceiling; Rentenwert €/point | `PointsConfig` |
| 🇦🇹 Austria | PENSION ACCOUNT | Pensionskonto (post-2005): 1.78% credit/yr; Teilungsziffer divisor; pre-2005 ASVG DB tranche | `MixedConfig` (DB legacy + `PensionAccountConfig`) |
| 🇸🇰 Slovakia | MIXED (POINTS + Pillar 2) | 18% Pillar 1 POMB points + 6% mandatory Pillar 2 DSS | `MixedConfig` (PointsConfig + Pillar2) |
| 🇵🇱 Poland | MIXED (NDC + OFE) | ZUS NDC 19.52%; post-2014: 2.92% OFE / 4.38% sub-account / 12.22% main | `MixedConfig` (NDCConfig + Pillar2) |
| 🇫🇷 France | MIXED (POINTS + AGIRC-ARRCO) | Two-tier mandatory points; AGIRC-ARRCO occupational mandatory | `MixedConfig` (PointsConfig ×2) |
| 🇧🇪 Belgium | DB (wage-history) | 45-yr career assessment; ceiling complex; pension bonus/malus | `DBConfig` |
| 🇱🇺 Luxembourg | POINTS-adjacent | High replacement rates; single mandatory scheme; expat complexity | `PointsConfig` |
| 🇳🇱 Netherlands | AOW flat + occupational | AOW flat-rate state pension + mandatory sector occupational funds (quasi-DB) | `MixedConfig` (DBConfig flat + Pillar2 collective) |
| 🇮🇪 Ireland | DB (flat-rate contributory) | PRSI contribution tiers; flat pension; means-tested supplement | `DBConfig` |
| 🇸🇪 Sweden | MIXED (NDC + premium pension) | Inkomstpension NDC 16% + 2.5% premium funded (PPM) | `MixedConfig` (NDCConfig + Pillar2) |
| 🇫🇮 Finland | DB / TyEL earnings-related | Age-dependent accrual rate; life expectancy *coefficient* (not NDC divisor); employer-run | `DBConfig` + longevityAdjustment ⚠️ (design debt — see §1A.6) |
| 🇩🇰 Denmark | MIXED (ATP flat + occupational) | ATP defined-contribution points; labour-market pensions (ATP/occupational) | `MixedConfig` (PointsConfig + Pillar2 collective) |
| 🇪🇪 Estonia | MIXED (NDC + mandatory Pillar 2) | I pillar NDC 20%; II pillar compulsory 6%; III pillar voluntary | `MixedConfig` (NDCConfig + Pillar2) |
| 🇱🇻 Latvia | MIXED (NDC + funded) | I pillar NDC; II pillar mandatory funded; III pillar voluntary | `MixedConfig` (NDCConfig + Pillar2) |
| 🇱🇹 Lithuania | POINTS | Reformed 2004; optional Pillar 2 accumulation | `PointsConfig` |
| 🇭🇺 Hungary | DB | Pillar 2 nationalised 2010; state DB with 1.65%/yr accrual | `DBConfig` |
| 🇸🇮 Slovenia | DB (ZPIZ-2) | Points-like career indexation; complex reference wage | `DBConfig` |
| 🇮🇹 Italy | NDC (Dini 1996) | Full NDC for post-1996 workers; pro-rata mixed for older | `NDCConfig` (or `MixedConfig` for transitional cohorts) |
| 🇪🇸 Spain | DB | 37-yr assessment base norm; high SSC ceiling; sustainability factor | `DBConfig` |
| 🇵🇹 Portugal | DB (earnings-related) | 40-yr career norm; sustainability factor; valorisation rules | `DBConfig` |
| 🇬🇷 Greece | MIXED (DB + EFKA) | Post-2016 EFKA reform; two-component (national pension flat + earnings-related) | `MixedConfig` (DBConfig flat + DBConfig earnings) |

**Out of scope in v2.0 — Non-OECD EU members (deferred):**

| Country | System | Reason for deferral |
|---|---|---|
| 🇧🇬 Bulgaria | DB + mandatory Pillar 2 | No OECD income tax data; manual bracket extraction required |
| 🇷🇴 Romania | DB (point-value) | No OECD coverage; high parameter volatility |
| 🇭🇷 Croatia | MIXED (NDC + Pillar 2) | No OECD coverage; joined eurozone 2023 |
| 🇨🇾 Cyprus | DB (GSIS) | No OECD coverage; public/private sector split complexity |
| 🇲🇹 Malta | DB (flat-rate contributory) | No OECD coverage; small population |

### Implementation Roadmap

| Tier | Countries | Version | Status | OECD API data? |
|---|---|---|---|---|
| **1** | CZ, DE, AT, SK, PL | V1 | Full data + formula — launch target | ✅ Yes |
| **2** | FR, BE, NL, IE, LU | V2 | Western EU | ✅ Yes |
| **3** | SE, FI, DK, EE, LV, LT | V3 | Nordic + Baltic; FI design debt resolved before start | ✅ Yes |
| **4** | IT, ES, PT, GR, HU, SI | V4 | Southern EU + remaining OECD-22 | ✅ Yes |
| **5** | BG, RO, HR, CY, MT | Future | Non-OECD pack — manual data entry required | ❌ Manual only |

**Stub principle:** All 22 OECD-scope `CountryConfig` objects are created at V1 with correct system type, SSC rates (MISSOC), and AW (Eurostat API). Pension formula parameters are populated tier by tier. The `incomplete: true` flag renders a banner: *"Pension formula data for this country is being verified — tax and SSC breakdown is accurate, pension estimate is approximate."*

---

## 8. Self-Employment Architecture (Stub — No Data in V1)

The data slot exists on every `CountryConfig`. The UI toggle is built but disabled. This allows Phase 7 data to be dropped in without architectural changes.

```typescript
interface SelfEmploymentConfig {
  available: boolean;      // false for all countries in V1
  modes: SelfEmploymentMode[];
}

interface SelfEmploymentMode {
  name: string;                    // "OSVČ Band 3", "Sole Trader", "Freelancer"
  sscMonthlyFixed?: number;        // flat monthly SSC (Czech OSVČ model)
  sscRate?: number;                // % of declared income (standard model)
  pensionBasisRate: number;        // % of income forming pension assessment base
  incomeTaxOverride?: IncomeTaxConfig;
  pillar2Eligible: boolean;
}
```

When `available === false`, the comparison toggle renders as greyed-out with a tooltip: *"Self-employment data for this country is planned for a future release."*

---

## 9. Personal Circumstances Layer (Out of Scope — Reserved for Phase 7)

The following tax modifications are **not modelled** in this version. The system assumes a single adult earner with no personal circumstances that alter the tax base or rate.

**Excluded from all calculations:**

- **Child tax credits / family allowances** — significant in CZ (15,204 CZK/year first child), DE (Kindergeld), FR (Quotient Familial), BE, PL
- **Married couple / joint filing** — material in DE (Ehegattensplitting can halve the marginal rate), FR, LU
- **Disability or carer credits** — present in most EU27 systems
- **Mortgage interest relief** — NL, IT, PT, ES
- **Voluntary pension contribution relief** — most EU27 countries allow tax deduction on private pension top-ups (Pillar 3)
- **Church tax** — DE, AT, FI (levied as % of income tax)
- **Local/municipal income tax** — SE, FI, DK (significant — up to 35% in Sweden)

**Phase 7 design note:** The `IncomeTaxConfig` surcharges array and a future `PersonalCircumstances` input object are the intended extension points. No structural changes to the engine will be required.

---

## 10. State Management

```typescript
// Global app state — managed with useReducer
interface AppState {
  selectedCountries: string[];          // ['CZ', 'DE', 'AT'] — max 3
  wageMode: WageMode;
  currency: 'EUR' | 'local';
  careerOverrides: Partial<CareerDefaults>;
  activeFormulaSidebarCountry: string;
  sidebarOpen: boolean;
}

// Derived state — computed on every render from AppState + CountryRegistry
// No cached/stored results — pure functions are fast enough for this data volume
type DerivedScenarios = Record<string, ScenarioResult>;

interface ScenarioResult {
  resolvedWage: ResolvedWage;
  taxResult: TaxResult;
  sscResult: SSCResult;
  pensionResult: PensionResult;
  timeline: YearlySnapshot[];
  fairReturn: FairReturnResult;
}
```

---

## 11. Known Risks & Mitigations

| Risk | Description | Mitigation |
|---|---|---|
| **OECD API data availability** | OECD Data Explorer SDMX-REST API has known intermittent availability; Eurostat API response format changes between releases | Primary: download OECD Excel annexes directly as fallback. Eurostat: pin API format version in URL. All data is static at build time — a live API outage does not affect the running app. |
| **Annual parameter drift** | ~400 individual parameters across 22 countries — SSC rates, tax brackets, pension formula params, ceilings, AW | `dataSourceRefs.retrievedDate` + `dataYear` on every `CountryConfig` field. UI shows data year per country. Tiered rollout. `incomplete` flag for unverified countries. |
| **NDC annuity divisor tables** | Life expectancy divisor changes annually and varies by country; no unified API | Use official published tables per country, stamped with year and source URL. `dataSourceRefs` links directly to source document. |
| **Finland TyEL design debt** | Finland's TyEL is an earnings-accrual DB with a longevity multiplier, not a capital-division NDC. `NDCConfig.annuityDivisor` cannot model it correctly | Flagged in §1A.6 and §2.4. Tier 3 (SE/FI/DK) implementation must resolve this by adding `longevityAdjustment` to `DBConfig` or creating `TyELConfig` before coding begins. |
| **Austria Pensionskonto transitional cohorts** | Workers with pre-2005 service have a split pension: old ASVG DB formula + new Pensionskonto account | Model as `MixedConfig` with DB pillar1 (legacy tranche, years before 2005) + PensionAccountConfig (years from 2005). Tier 1 implementation assumes full Pensionskonto career (40-year workers born ~1990+). |
| **3-country layout + sidebar** | 4 columns of content on desktop may be cramped | Desktop-first design. At 3 countries, sidebar collapses to icon-only strip. Charts stack vertically within cards. |
| **Currency toggle in multi-country mode** | Comparing CZK vs PLN makes no sense | EUR-only when 2+ countries with different currencies. Toggle auto-disables with tooltip explanation. |
| **Employer SSC visibility** | Users are conditioned to think in gross salary terms | Total Employer Cost is the primary KPI card and the primary graph axis. Formula sidebar Step 1 always opens with the employer overhead calculation. Hidden Wedge callout on first load. |
| **Pension formula accuracy vs simplification** | Full-accuracy goal creates risk of error in complex systems (FR AGIRC-ARRCO, NL occupational) | Each formula step in the sidebar cites its legislative source. Community/expert review flagged as part of each tier release. |
| **PAYG vs funded conflation** | NDC and funded Pillar 2 are often confused by users | System type badge always visible. Formula sidebar includes a plain-English explainer of the system type at the top, before the formula steps. |
| **Non-OECD country deferred scope** | BG, RO, HR, CY, MT have no OECD structured data; their parameters require manual scraping | Deferred to Phase 6 (Non-OECD Pack). UI stub with `incomplete: true` shows tax/SSC only. No pension estimate displayed until parameters are manually verified. |

---

## 12. Deliverable Phasing

| Phase | Scope | Deliverable |
|---|---|---|
| **1** | CZ full data object + all five calculation engines | Validated pure functions — output matches Appendix A table exactly |
| **2** | Wage breakdown table + SSC redistribution table + Controls bar | Static UI, no charts |
| **3** | Graph 1 (Career Timeline, employer-cost-primary) + Graph 2 (Accumulation) for CZ | Charts working end-to-end |
| **4** | Formula Sidebar with live values for CZ | Transparency layer complete |
| **5** | Multi-country comparison layout (2–3 countries) + AW reference table | Full comparison mode |
| **6** | DE, AT, SK, PL full data populated | V1 release — Tier 1 countries |
| **7** | FR, BE, NL, IE, LU data + Tier 2 UI refinements | V2 release |
| **8** | SE, DK, EE, LV, LT data (Tier 3) + FI design debt resolved | V3 release |
| **9** | IT, ES, PT, GR, HU, SI data (Tier 4) | V4 release — all 22 OECD EU countries complete |
| **Future** | BG, RO, HR, CY, MT — Non-OECD country pack | Phase 6 — manual data entry |
| **Future** | Personal circumstances layer (kids, married, disability) | Phase 7 — reserved |
| **Future** | Self-employment / freelancer comparison data | Phase 7 — reserved |

---

## Appendix A: Czech Republic Reference Validation (Phase 1 — 2026 Parameters)

The Phase 1 engine output must match this reference table exactly before any UI work begins.

### A.1 Confirmed 2026 MPSV Decree Parameters

| Parameter | Value | Source | Notes |
|---|---|---|---|
| Average wage (`averageWage`) | **48,967 CZK/month** | MPSV Nařízení vlády (Government Decree) 2026 | Equals 1st threshold ÷ 0.44% and 2nd threshold ÷ 4.0 |
| Base pension (`basePension`) | **4,900 CZK/month** | Nařízení vlády 2026 | Statutory = 10% of average wage (rounded per decree; 10% × 48,967 = 4,896.70, rounded to 4,900) |
| 1st reduction threshold | **≤21,546 CZK** @ **99%** | Nařízení vlády 2026 | Equals 44% of AW (44% × 48,967 = 21,545.48 ≈ 21,546). Reduced from 100% → 99% as of 1 Jan 2026 důchodová reforma |
| 2nd reduction threshold | **21,546–195,868 CZK** @ **26%** | Nařízení vlády 2026 | Equals 4× AW (4 × 48,967 = 195,868) |
| Above 2nd threshold | **>195,868 CZK** @ **0%** | Onž | Nothing credited above this level |
| Accrual rate (`accrualRatePerYear`) | **1.495%** per year | Zkon č. 155/1995 Sb. (as amended by důchodová reforma) | Reduced from 1.500% in 2025; decreasing 0.005 pp/year until 1.450% in 2035 |
| Contribution ceiling | **195,868 CZK/month** (= 2nd threshold) | §§15a zákona č. 589/1992 Sb. | Annual: 48 × AW = 2,350,416 CZK/year |
| Employee SSC pension rate | **6.5%** of gross (pension insurance portion) | Zákon č. 589/1992 Sb. |
| Employer pension SSC rate | **24.8%** of gross (pension insurance + sick pay combined) | Zákon č. 589/1992 Sb. | Split: 21.5% pension + 2.1% sick leave + 1.2% state policy of employment |
| Reference source (secondary) | Peníze.cz articles Jan 2026 citing ČSSZ | `https://www.penize.cz/starobni-duchod/483580` | Cross-checked against parameter back-derivations (all consistent) |

### A.2 Formula Derivation (1x AW = 48,967 CZK walk-through)

```
Step 1 — Reduction of assessment base (výpočtový základ / credited)
  Band 1: min(48,967, 21,546) × 99% = 21,546 × 0.99    =  21,330.54 CZK
  Band 2: (48,967 − 21,546) × 26% = 27,421 × 0.26       =   7,129.46 CZK
  Band 3: above 195,868 × 0%                               =       0.00 CZK
  výpočtový základ (credited)                            =  28,460.00 CZK

Step 2 — Percentage component (procentní výměra)
  credited × years × accrualRate
  = 28,460 × 35 × 0.01495                                =  14,892.65 CZK

Step 3 — Total monthly pension
  basePension + percentagePension
  = 4,900 + 14,892.65                                     =  19,792.65 CZK
                                                           ≈  19,792 CZK ✓

Note: Slight rounding in reference table reflects that the Czech system applies
small rounding rules (halers) at each step – the formula above matches to < 1 CZK.
```

### A.3 Phase 1 Validation Table

The Phase 1 engine output must match all rows in this table (tolerance ±1 CZK per cell).

| Multiple | Gross Salary | Monthly Social Paid | Monthly Pension | Total Paid (35y) | Total Rec’d (20y) | Profit/Loss |
|---|---|---|---|---|---|---|
| 0.5× AW | 24,484 CZK | 7,663 CZK | 16,461 CZK | 3.2m CZK | 3.9m CZK | +0.7m CZK |
| 1.0× AW | 48,967 CZK | 15,327 CZK | 19,792 CZK | 6.4m CZK | 4.7m CZK | −1.7m CZK |
| 1.5× AW | 73,450 CZK | 22,990 CZK | 23,123 CZK | 9.7m CZK | 5.5m CZK | −4.2m CZK |
| 2.0× AW | 97,934 CZK | 30,653 CZK | 26,453 CZK | 12.9m CZK | 6.3m CZK | −6.6m CZK |
| 3.0× AW | 146,901 CZK | 45,980 CZK | 33,115 CZK | 19.3m CZK | 7.9m CZK | −11.4m CZK |
| 4.0× AW | 195,868 CZK | 61,307 CZK | 39,777 CZK | 25.8m CZK | 9.5m CZK | −16.2m CZK |

**Parameters used for this table (all from 2026 MPSV Decree):**
- AW = 48,967 CZK/month
- Base pension = 4,900 CZK
- Reduction thresholds: ≤21,546 CZK @ 99%; 21,546–195,868 CZK @ 26%; >195,868 CZK @ 0%
- Accrual rate = 1.495%/year
- Career = 35 years | Retirement duration = 20 years
- Monthly Social Paid = Employee SSC pension (6.5%) + Employer pension portion (24.8%) of gross
- Total Paid cumulative = Monthly Social Paid × 12 months × 35 years (nominal, no compounding)
- Total Rec’d cumulative = Monthly Pension × 12 months × 20 years (nominal)

**v1.0 formula bug note:** In v1.0, `calcDB` contained an erroneous `/30` divisor. The validation numbers above could not have been produced by the v1.0 formula code; they were calculated using the correct formula. v2.0 corrects the code to match.

---

*End of Technical Design v2.0*
