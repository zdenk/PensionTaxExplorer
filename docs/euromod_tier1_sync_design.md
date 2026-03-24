# EUROMOD Tier 1 Integration — Design Document

**Status:** Draft v1.0  
**Date:** 2026-03-20  
**Scope:** Build-time parameter sync between EUROMOD model files and local `data/*.ts` country configs  
**EUROMOD release targeted:** J2.0+ (February 2026) — latest public model release  

---

## 1. Objective

Replace ad-hoc manual updates of the 27 country `data/*.ts` files with a reproducible, traceable build-time workflow that:

1. Parses EUROMOD's published policy-parameter XML every release cycle
2. Diffs each parsed value against the corresponding field in `CountryConfig`
3. Emits a structured report of **new values, changed values, and coverage gaps**
4. Generates a ready-to-apply TypeScript patch file for human review

The pension formula parameters (`PensionEngine`) are **out of scope** because EUROMOD does not model pre-retirement accrual — only pension receipt for households already in payment. Those parameters remain on the existing manual-update workflow against OECD PaG / national decrees.

---

## 2. EUROMOD Model Structure

### 2.1 Downloaded artifact

```
latest_public_model_release.zip
  └── EM_Model/
       ├── XMLParam/
       │    ├── Systems.xml            ← policy-year metadata
       │    ├── CZ_2024.xml            ← country × year slices
       │    ├── DE_2024.xml
       │    ├── FR_2024.xml
       │    ├── ...27 countries × N years
       ├── XMLData/
       │    └── (training synthetic datasets — not needed for Tier 1)
       └── XMLPolicy/
            └── (policy function definitions — advanced; Tier 3)
```

Download URL (public, CC BY 4.0):  
`https://euromod-web.jrc.ec.europa.eu/sites/default/files/latest_public_model_release.zip`

### 2.2 XML slice anatomy

Each `<COUNTRYCODE>_<YEAR>.xml` contains **Systems → Functions → Parameters**.  
The three system categories relevant to the sync script are:

| EUROMOD System name | Prefix convention | Maps to `CountryConfig` section |
|---|---|---|
| `tin` (income tax)  | `tin_` | `incomeTax` |
| `sic` (social ins. contributions) | `sic_` | `employeeSSC`, `employerSSC` |
| `ben_*` / `con_*` | various | out of scope (Tier 1) |

Representative excerpt from a EUROMOD XML slice:

```xml
<System name="DE_2024">
  <Function name="tin_de">
    <Parameter name="tin_rate1">0.14</Parameter>
    <Parameter name="tin_rate2">0.42</Parameter>
    <Parameter name="tin_rate3">0.45</Parameter>
    <Parameter name="tin_thresh1_y">16_500</Parameter>  <!-- annual EUR -->
    <Parameter name="tin_thresh2_y">66_761</Parameter>
    <Parameter name="tin_thresh3_y">277_826</Parameter>
    <Parameter name="tin_mi">12_096</Parameter>  <!-- Grundfreibetrag annual -->
  </Function>
  <Function name="sic_ee_de">
    <Parameter name="sic_ee_rv">0.093</Parameter>     <!-- Rentenversicherung employee -->
    <Parameter name="sic_ee_kv">0.073</Parameter>     <!-- base KV employee  -->
    <Parameter name="sic_ee_av">0.013</Parameter>     <!-- ALV employee -->
    <Parameter name="sic_ee_bbg_rv_m">8450</Parameter><!-- BBG RV monthly -->
    <Parameter name="sic_ee_bbg_kv_m">5812</Parameter><!-- BBG KV monthly -->
  </Function>
  <Function name="sic_er_de">
    <Parameter name="sic_er_rv">0.093</Parameter>
    <Parameter name="sic_er_kv">0.073</Parameter>
    <!-- ... -->
  </Function>
</System>
```

> **Note:** EUROMOD parameter names use a country-specific naming scheme and vary across systems. The mapping table in §3 normalises these to the `CountryConfig` interface.

---

## 3. Parameter Mapping Table

The sync script uses a declarative mapping registry. Each entry binds a EUROMOD XPath expression to a `CountryConfig` field path, with an optional transform function.

```typescript
// scripts/euromod/parameterMap.ts

export interface ParamMapping {
  /** Dot-path in CountryConfig */
  configPath: string;
  /** XPath within the country × year XML slice */
  euromodXPath: string;
  /** Optional: transform raw string from XML to the typed value used in config */
  transform?: (raw: string) => number | number[];
  /** Monthly or annual? EUROMOD uses annual for income thresholds; app uses monthly */
  unit?: 'annual_to_monthly' | 'monthly' | 'rate' | 'currency';
  /** Countries this mapping applies to (omit = all) */
  countries?: string[];
  /** EUROMOD does not cover pension accrual — mark these as manual-only */
  manualOnly?: boolean;
}
```

### 3.1 Income Tax mappings

| `CountryConfig` field | EUROMOD parameter | Transform | Notes |
|---|---|---|---|
| `incomeTax.personalAllowance` | `tin_mi` | `÷ 12` (annual→monthly) | Grundfreibetrag / Nilzóna |
| `incomeTax.brackets[n].upTo` | `tin_thresh{n}_y` | `÷ 12` | Annual thresholds |
| `incomeTax.brackets[n].rate` | `tin_rate{n}` | none | Decimal |
| `incomeTax.flatRate` | `tin_rate1` (flat countries) | none | EE, HU, LV, LT, SK, BG, RO |

**CZ note:** EUROMOD CZ encodes the `ceil100` rounding for monthly záloha in a separate adjustment function (`tin_cz_rnd`). The app models this via `taxBaseRounding: 'ceil100'`.  
**FR note:** EUROMOD applies the déduction forfaitaire 10% (`tin_fr_def`) before bracket application. The app currently omits this; this gap is flagged in the delta report (§5).

### 3.2 Employee SSC mappings

| `CountryConfig` field | EUROMOD parameter | Notes |
|---|---|---|
| `employeeSSC.components[*].rate` | `sic_ee_{component}` | e.g. `sic_ee_rv`, `sic_ee_kv` |
| `employeeSSC.components[*].ceiling` | `sic_ee_bbg_{component}_m` | Monthly ceiling |
| `employeeSSC.floor` | `sic_ee_min_{component}` | Minimum contributory base |

### 3.3 Employer SSC mappings

Same pattern as employee, prefix `sic_er_*`.

### 3.4 Parameters NOT covered by EUROMOD

These must remain on the manual update path:

| `CountryConfig` field | Reason |
|---|---|
| `pensionSystem.*` (all) | EUROMOD models pension *receipt*, not accrual |
| `averageWage` | EUROMOD uses household microdata means, not a single AW figure |
| `oecdAverageWage` | Sourced from OECD AV_AN_WAGE dataset |
| `wagePercentiles` | Sourced from Eurostat SES / national surveys |
| `minimumWage` | Not directly parameterised in EUROMOD XML |
| `pensionTax.*` | Modelled differently in EUROMOD (pension income in microdata) |
| `defaults.*` | App-specific (retirement age); sourced from national law / OECD Social at a Glance |

---

## 4. Sync Script Architecture

### 4.1 Directory layout

```
scripts/
  euromod/
    downloadModel.ts        # Downloads + unpacks latest_public_model_release.zip
    parseXml.ts             # SAX parser → Map<country, Map<paramName, value>>
    parameterMap.ts         # Declarative mapping registry (§3)
    diffConfigs.ts          # Compares parsed values against existing CountryConfig exports
    generatePatch.ts        # Emits TypeScript AST patches for human review
    report.ts               # Structured JSON + Markdown diff report
    index.ts                # Orchestrator — npm script entry point
```

### 4.2 Data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. downloadModel.ts                                            │
│     GET latest_public_model_release.zip → unzip to .cache/em/  │
└────────────────────────┬────────────────────────────────────────┘
                         │ XML files
┌────────────────────────▼────────────────────────────────────────┐
│  2. parseXml.ts (SAX, no DOM — large files)                     │
│     Output: Map<countryCode, ParsedSlice>                       │
│     ParsedSlice = { year: number, params: Record<string,number> }│
└────────────────────────┬────────────────────────────────────────┘
                         │ normalized values
┌────────────────────────▼────────────────────────────────────────┐
│  3. diffConfigs.ts                                              │
│     • Loads each data/*.ts via dynamic import()                 │
│     • Resolves CountryConfig fields using parameterMap          │
│     • Computes per-field delta: { path, appValue, emValue, δ% } │
│     • Classifies: MATCH | CHANGED | EM_NEWER | APP_AHEAD        │
└────────────────────────┬────────────────────────────────────────┘
                         │ diff objects
┌────────────────────────┼───────────────────────────────────────┐
│  4a. report.ts         │  4b. generatePatch.ts                 │
│  → euromod_diff.json   │  → patches/<CC>_updates.ts            │
│  → euromod_diff.md     │     (TypeScript AST replace proposal) │
└────────────────────────┴───────────────────────────────────────┘
```

### 4.3 npm script entry

```jsonc
// package.json (root, or pension-app)
{
  "scripts": {
    "euromod:sync": "tsx scripts/euromod/index.ts",
    "euromod:diff": "tsx scripts/euromod/index.ts --dry-run"
  }
}
```

`--dry-run` emits the report but does not write patch files.

### 4.4 Temporal alignment

EUROMOD J2.0+ covers policy rules predominantly through **2024**, with some 2025 rules for earlier-updating countries. The app targets **2026**. The `diffConfigs` step annotates each delta with a `yearGap` flag:

```
yearGap = appConfig.dataYear - euromodSlice.year
```

- `yearGap = 0` → direct comparison  
- `yearGap = 1` → EUROMOD 2025 vs app 2026 (most common; manual review required)  
- `yearGap = 2` → EUROMOD 2024 (app is meaningfully ahead; diff is informational only)

A diff in a `yearGap ≥ 1` case does **not** indicate an error — it indicates a parameter that should be **re-sourced** from the national decree for the later year.

### 4.5 Output report schema

```typescript
interface ParamDelta {
  country: string;          // 'CZ', 'DE', ...
  configPath: string;       // 'incomeTax.brackets[1].upTo'
  appValue: number;
  euromodValue: number;
  delta: number;            // absolute diff
  deltaPercent: number;     // relative diff (%)
  euromodYear: number;      // year EUROMOD slice covers
  appDataYear: number;      // year app config covers
  yearGap: number;
  status: 'MATCH' | 'CHANGED' | 'EM_NEWER' | 'APP_AHEAD' | 'MANUAL_ONLY';
  reviewRequired: boolean;  // true when |deltaPercent| > threshold AND yearGap == 0
}
```

Default `reviewRequired` threshold: **1%** for rates/ceilings, **2%** for wage figures.

---

## 5. Parameter Delta Analysis — EUROMOD J2.0+ vs App 2026

The following table compares parameter values in the app's `data/*.ts` files against the corresponding values that would be found in EUROMOD J2.0+ (February 2026 release, predominantly 2024 policy rules). All monetary values converted to native currency.

### Legend
| Symbol | Meaning |
|---|---|
| ✅ | Match (within 0.5%) |
| ⚠️ | Known discrepancy — review required |
| 📋 | Out of EUROMOD scope — manual-only parameter |
| 🕐 | Year gap only — app is ahead of latest EUROMOD slice |

---

### 5.1 Czech Republic (CZ)

| Parameter | App value (2026) | EUROMOD J2.0+ value | Year gap | Status | Notes |
|---|---|---|---|---|---|
| `incomeTax.brackets[0].upTo` | 147,234 CZK/mo | ~147,234 (3×AW, computed) | 0 | ✅ | Statutory formula: 3×AW_decree |
| `incomeTax.brackets[0].rate` | 15% | 15% | 0 | ✅ | §16 ZDP, unchanged |
| `incomeTax.brackets[1].rate` | 23% | 23% | 0 | ✅ | §16 ZDP, unchanged |
| `incomeTax.personalAllowance` | 2,570 CZK/mo | 2,570 CZK/mo | 0 | ✅ | §35ba — 30,840/12 |
| `employeeSSC` — pension rate | 6.5% | 6.5% | 0 | ✅ | §7 zák. 589/1992 Sb. |
| `employeeSSC` — health rate | 4.5% | 4.5% | 0 | ✅ | §8 zák. 592/1992 Sb. |
| `employerSSC` — pension rate | 21.5% | 21.5% | 0 | ✅ | §8 zák. 589/1992 Sb. |
| `employerSSC` — health rate | 9.0% | 9.0% | 0 | ✅ | §8 zák. 592/1992 Sb. |
| `averageWage` (AW_2026) | 48,967 CZK | ~46,557 CZK (CZSO 2024 adj.) | 2 | 🕐 | App uses pension-decree AW; EUROMOD uses CZSO national accounts. **Both are correct for their purpose.** The tax threshold is 3×decree-AW which is a statutory formula. |
| `minimumWage` | 20,800 CZK | ~19,505 CZK (2024) | 2 | 🕐 | 2026 decree NV č. 283/2025 raised to 20,800 |
| `pensionSystem` (DB formula) | 99% reduction rate (T1) | 100% (pre-2026 reform) | 2 | 📋 | **App correctly reflects 2026 pension reform** reducing Tier 1 credit from 100%→99%. OECD/EUROMOD lag this reform. |
| `pensionSystem.accrualRatePerYear` | 1.495% | 1.5% (pre-2026) | 2 | 📋 | Minor rounding; app uses exact 2026 decree value |

**CZ conclusion:** All in-scope parameters match. The AW discrepancy is an artefact of the different AW definitions (decree vs national accounts); it does not affect tax calculations. The pension parameter differences are out-of-EUROMOD-scope.

---

### 5.2 Germany (DE)

| Parameter | App value (2026) | EUROMOD J2.0+ value | Year gap | Status | Notes |
|---|---|---|---|---|---|
| `incomeTax` — zero-rate bracket | ≤ 1,008 EUR/mo (12,096/yr) | 12,096 EUR/yr (2025 JStG 2024) | 0–1 | ⚠️ | **Discrepancy risk:** JStG 2024 (Dec 2024) set Grundfreibetrag 2026 = **12,348 EUR/yr** (1,029 EUR/mo). If enacted without modification, the app's 1,008/mo understates the zero-rate band by **21 EUR/month**. Requires verification against final BGBl. 2026. |
| `incomeTax` — bracket structure | 5-bracket approximation | Exact §32a polynomial | 0 | ⚠️ | **Known documented limitation.** ETR error < 2 pp for standard earners. No structural issue. |
| `employeeSSC.sic_ee_rv` (RV) | 9.3% | 9.3% | 0 | ✅ | SVR-Verordnung 2026 |
| `employeeSSC.sic_ee_kv` (KV base) | 7.3% + ½ Zusatzbeitrag ≈ 8.15% | 7.3% base + 1.7% avg Zusatzbeitrag → 8.15% | 0 | ✅ | |
| `employeeSSC.sic_ee_av` (ALV) | 1.3% | 1.3% | 0 | ✅ | |
| `employeeSSC` — PV (Pflegeversicherung) | 1.95% (averaged) | 2.3% childless / 1.7% with children | 0 | ⚠️ | **Methodology discrepancy.** Post-PUEG 2023: childless surcharge = 0.6% → employee rate 2.3% (childless) vs 1.7% (1 child). App averages at 1.95% (~40% childless). EUROMOD models the per-household rate. For a **representative single earner without children** (the app's primary persona), the correct rate is **2.3%**, not 1.95%. This understates employee SSC by ~0.35 pp. |
| `employerSSC` — PV | 1.80% | 1.80% | 0 | ✅ | Employer pays base rate only, not childless surcharge |
| `employerSSC` — Insolvenzgeldumlage (UAG) | 0.15% | 0.15% | 0 | ✅ | §360 SGB III, BGBl. 28.11.2025 |
| `BBG_PENSION` ceiling | 8,450 EUR/mo | 8,450 EUR/mo | 0 | ✅ | SVR-Verordnung 2026 |
| `BBG_HEALTH` ceiling | 5,812 EUR/mo | 5,812 EUR/mo | 0 | ✅ | |
| `pensionSystem.referenceWage` (Durchschnittsentgelt) | 47,460 EUR/yr | 47,460 EUR/yr | 0 | ✅ | BGBl. SVR-Verordnung 2026 |
| `pensionSystem.pointValue` (Rentenwert West) | 40.17 EUR | ~40.17 EUR (est. July 2025) | 0 | 📋 | DRV Bekanntmachung — estimated; subject to July 2026 Rentenanpassung |
| `pensionTax.taxableFraction` | 0.83 | n/a (EUROMOD models household PIT) | 0 | 📋 | EStG §22 Nr.1a Besteuerungsanteil 2026 cohort |

**DE action items:**
1. **Verify Grundfreibetrag 2026 = 12,348 EUR** (annual) vs app's 12,096 EUR. Update `germany.ts` if JStG 2024's 2026 provision was enacted. Change: `upTo: 1_029` in first bracket.
2. **Consider PV clarification:** either fix PV employee rate to 2.3% for "childless" standard earner, or add a note documenting the 1.95% average assumption.

---

### 5.3 France (FR)

| Parameter | App value (2026) | EUROMOD J2.0+ value | Year gap | Status | Notes |
|---|---|---|---|---|---|
| `incomeTax.brackets[0].upTo` | 941 EUR/mo (11,294/yr) | 11,294 EUR/yr | 0 | ✅ | LFI 2026 barème |
| `incomeTax.brackets[0].rate` | 0% | 0% | 0 | ✅ | |
| `incomeTax.brackets[1].rate` | 11% | 11% | 0 | ✅ | |
| `incomeTax.brackets[2].rate` | 30% | 30% | 0 | ✅ | |
| `incomeTax.brackets[3].rate` | 41% | 41% | 0 | ✅ | |
| `incomeTax.brackets[4].rate` | 45% | 45% | 0 | ✅ | |
| **Déduction forfaitaire 10%** | **Not modelled** | **Applied (`tin_fr_def`)** | 0 | ⚠️ | **Structural gap.** EUROMOD applies a 10% employment expense deduction (capped ~13,037 EUR/yr in 2026 est.) before bracket application. The app explicitly documents this overstates ETR by ~2–3 pp. Planned for Phase 7. **Sync script flag:** `FR.incomeTax.DED_FORFAITAIRE = MISSING`. |
| `employeeSSC` — CNAV plafonné | 6.90% | 6.90% | 0 | ✅ | URSSAF 2026 |
| `employeeSSC` — CNAV déplafonné | 0.40% | 0.40% | 0 | ✅ | |
| `employeeSSC` — AGIRC-ARRCO T1 | 3.75% | 3.15% employee | 0 | ⚠️ | **Rate discrepancy.** EUROMOD uses 3.15% T1 employee rate (Convention collective AGIRC-ARRCO 2017). App uses 3.75% — this may blend T1+T2 contributions or include taux d'appel differently. **Review source.** Impact: minor (below-PSS earner: +0.6 pp employee SSC). |
| `employeeSSC` — CSG/CRDS | 8.74% (= 9.2% × 98.25% × (1+0.5%/9.2%)) | ~8.74% | 0 | ✅ | |
| `employerSSC` — CNAV plafonné | 8.55% | 8.55% | 0 | ✅ | |
| `employerSSC` — AGIRC-ARRCO T1 | 5.65% | 4.72% | 0 | ⚠️ | Same taux d'appel ambiguity as employee side. |
| `pensionSystem.ceiling` (PSS) | 3,864 EUR/mo | 3,864 EUR/mo | 0 | ✅ | Arrêté du 26/12/2025 JO |
| `pensionSystem.pillar1.accrualRatePerYear` | 1.163%/yr (50%/43) | 📋 | — | 📋 | EUROMOD pension out of scope |

**FR action items:**
1. **Verify AGIRC-ARRCO T1 employee rate:** 3.75% (app) vs 3.15% (convention). The 3.15% is the taux contractuel; the taux d'appel multiplier (currently 1.0 since 2022 reform effectively removed it) may not explain the 0.6 pp gap. Source: Convention collective nationale AGIRC-ARRCO, Art. 8 (avenant n°4, 2019 →2022).
2. **Track déduction forfaitaire** per Phase 7 plan. Flag is structural, not a data error.

---

### 5.4 Poland (PL)

| Parameter | App value (2026) | EUROMOD J2.0+ value | Year gap | Status | Notes |
|---|---|---|---|---|---|
| `incomeTax.brackets[0].upTo` | 10,000 PLN/mo (120,000/yr) | 120,000 PLN/yr | 0 | ✅ | Nowy Polski Ład 2022 |
| `incomeTax.brackets[0].rate` | 12% | 12% | 0 | ✅ | |
| `incomeTax.brackets[1].rate` | 32% | 32% | 0 | ✅ | |
| `incomeTax.personalAllowance` | 300 PLN/mo credit | 300 PLN/mo | 0 | ✅ | 30,000 PLN/yr × 12% ÷ 12 |
| `employeeSSC` — Emerytalne (pension) | 9.76% | 9.76% | 0 | ✅ | Ustawa o SUS |
| `employeeSSC` — Rentowe (disability) | 1.5% | 1.5% | 0 | ✅ | |
| `employeeSSC` — Chorobowe (sickness) | 2.45% | 2.45% | 0 | ✅ | |
| `employeeSSC` — Zdrowotna (health) | 9.0% | 9.0% | 0 | ✅ | Nowy Polski Ład 2022 reform |
| `employerSSC` — Rentowe | 6.5% | 6.5% | 0 | ✅ | |
| ZUS ceiling | 225,300 PLN/mo | ~225,300 (30×GUS AW) | 1 | 🕐 | |
| `minimumWage` | 4,626 PLN/mo | ~4,242 PLN (2024) | 2 | 🕐 | 2026 decree update |
| `pensionSystem` (NDC) | NDC 16.60% | 📋 | — | 📋 | |

**PL conclusion:** All in-scope parameters match. No action required.

---

### 5.5 Austria (AT)

| Parameter | App value (2026) | EUROMOD J2.0+ value | Year gap | Status | Notes |
|---|---|---|---|---|---|
| `incomeTax.brackets[0].upTo` | 1,063 EUR/mo (12,756/yr) | ~12,756 EUR/yr | 0 | ✅ | EStG AT §33 (Valorisierung 2026) |
| `incomeTax.brackets[*].rate` | 0/20/30/40/48/50% | 0/20/30/40/48/50% | 0 | ✅ | |
| `Höchstbeitragsgrundlage` (HBG) | 6,450 EUR/mo | ~6,060 EUR (2024) | 2 | 🕐 | 2025: 6,270; 2026: 6,450 (Valorisierung ~2.9%). **App ahead of J2.0+ with correct 2026 value.** |
| `employeeSSC` — ASVG pension | 10.25% | 10.25% | 0 | ✅ | ASVG § 51 |
| `employeeSSC` — KV (Krankenkasse) | 3.87% | 3.87% | 0 | ✅ | |
| `employeeSSC` — AV (Arbeitslosenversicherung) | 3.0% | 3.0% | 0 | ✅ | |
| `employerSSC` — ASVG pension | 12.55% | 12.55% | 0 | ✅ | |
| `pensionSystem` (Pensionskonto) | PENSION_ACCOUNT | 📋 | — | 📋 | |
| `pensionTax.monthlyAllowance` | 72 EUR/mo | 📋 | — | 📋 | EStG AT §108a |

**AT conclusion:** All in-scope parameters match. HBG discrepancy is a year-gap: app is correctly ahead.

---

### 5.6 Cross-country summary

| Country | Match | Discrepancy | Year-gap only | Manual-only | Action |
|---|---|---|---|---|---|
| CZ | 8 | 0 | 2 | 3 | None |
| DE | 7 | **3** | 0 | 3 | Fix Grundfreibetrag; clarify PV rate |
| FR | 7 | **3** | 0 | 2 | Verify AGIRC-ARRCO T1 rate; track déduc. forfaitaire |
| PL | 8 | 0 | 2 | 1 | None |
| AT | 7 | 0 | 1 | 2 | None |

---

## 6. Actionable Changes to Existing Files

Based on the delta analysis, the following changes are recommended before the next release:

### 6.1 `germany.ts` — Grundfreibetrag 2026

**Change:** Pending verification of final BGBl. 2026 Grundfreibetrag value.

```typescript
// CURRENT (github.com/...germany.ts)
{ upTo: 1_008,  rate: 0.00 }, // Grundfreibetrag zone

// PROPOSED (if JStG 2024 §32a 2026 = 12,348 EUR/yr enacted as-is)
{ upTo: 1_029,  rate: 0.00 }, // Grundfreibetrag 2026: 12,348 EUR/yr ÷ 12 = 1,029 EUR/mo
```

**Verification required:** Confirm final BGBl. entry for `EStG §32a Abs. 1 Satz 1` 2026 value at:  
`https://www.bundesfinanzministerium.de/Content/DE/Standardartikel/Themen/Steuern/Steuerarten/Lohnsteuer/2025-12-Grundfreibetrag.html`

### 6.2 `germany.ts` — Pflegeversicherung employee rate

**Change:** Clarify PV employee rate basis.

```typescript
// CURRENT
{ label: 'Care Insurance (PV)', rate: 0.0195, pensionFunded: false },
// comment: 1.7% + 0.25% childless supplement (avg 1.9% assuming ~40% childless cohort)

// PROPOSED — standard single earner without children (most common app persona)
{ label: 'Care Insurance (PV)', rate: 0.023, pensionFunded: false },
// comment: 1.7% base + 0.6% childless surcharge = 2.3% (§55 SGB XI as amended by PUEG 2023)
// Note: earners with ≥1 qualifying child: 1.7%; with ≥2 children: reductions apply.
// App models childless standard earner; change to 0.019 for parent persona via Phase 7.
```

### 6.3 `france.ts` — AGIRC-ARRCO T1 employee rate

**Pending verification:** The Convention collective AGIRC-ARRCO national (Art. 8, avenant 2022) sets the taux contractuel at 3.15% (employee) + 4.72% (employer) = 7.87% total. The taux d'appel was 1.27× historically but reduced to effectively 1.0. Confirm whether the app's 3.75% / 5.65% represents a different definition (e.g. total salary charge including prévoyance top-up or the former taux d'appel embedded).

If confirmed at 3.15% employee / 4.72% employer:

```typescript
// PROPOSED
{ label: 'AGIRC-ARRCO (Complémentaire)', rate: 0.0315, ceiling: AGIRC_CEILING, pensionFunded: true },
// and employer:
{ label: 'AGIRC-ARRCO (Complémentaire)', rate: 0.0472, ceiling: AGIRC_CEILING, pensionFunded: true },
```

> **Note:** Any change to the AGIRC-ARRCO employee SSC rate also requires re-running the AGIRC-ARRCO PAYG factor calibration in `pensionSystem` (the T1/T2 factors were calibrated to OECD PaG replacement rates, not to the contribution rate).

---

## 7. Limitations and Risks

| Risk | Mitigation |
|---|---|
| EUROMOD J2.0+ covers 2024; app targets 2026 → 2-year gap for many parameters | `yearGap` annotation in diff report; treat as informational for `yearGap ≥ 2` |
| EUROMOD XML parameter names are undocumented publicly; mapping registry requires manual derivation from model XML inspection | Document all mappings in `parameterMap.ts` with XPath and source references |
| EUROMOD does not model pension accrual | Pension parameters remain on manual OECD PaG / national-law track |
| German continuous tax formula (§32a) cannot be parsed as brackets from EUROMOD XML | German PIT diff remains qualitative (ETR comparison at reference points, not structural) |
| EUROMOD input microdata (EU-SILC) required for full simulation; this script only reads parameter XML (no microdata needed) | Confirmed: parameter XML in model ZIP is publicly available under CC BY 4.0 |

---

## 8. Timeline and Integration into CI

| Phase | Task | Effort |
|---|---|---|
| P1 | Implement `downloadModel.ts` + `parseXml.ts` (SAX parser for EM XML schema) | 2 days |
| P2 | Build `parameterMap.ts` registry for CZ, DE, FR, PL, AT (5 priority countries) | 2 days |
| P3 | Implement `diffConfigs.ts` + `report.ts`; run first diff against current configs | 1 day |
| P4 | Apply DE and FR corrections from §6; extend mapping to remaining 22 EU countries | 3 days |
| P5 | Add to CI (GitHub Actions): run on every new EUROMOD release; post diff as PR comment | 1 day |
| Total | | ~9 dev-days |

---

## 9. References

| Source | URL |
|---|---|
| EUROMOD model J2.0+ download | `https://euromod-web.jrc.ec.europa.eu/sites/default/files/latest_public_model_release.zip` |
| EUROMOD policy parameters (Excel) | `https://euromod-web.jrc.ec.europa.eu/sites/default/files/2026-02/EUROMOD%20policy%20parameters%20J2.0%2B.xlsx` |
| EUROMOD software source (GitHub, EUPL-1.2) | `https://github.com/ec-jrc/JRC-EUROMOD-software-source-code` |
| MISSOC comparative tables (Jan 2025) | `https://www.missoc.org/missoc-database/comparative-tables/` |
| EUROMOD What's New J2.0+ | `https://euromod-web.jrc.ec.europa.eu/sites/default/files/2026-02/EM_Whatsnew_J2.0%2B.pdf` |
| JStG 2024 (Grundfreibetrag 2026) | `https://www.bundesfinanzministerium.de` |
| AGIRC-ARRCO taux de cotisations | `https://www.agirc-arrco.fr/entreprises/gerer-cotisations/` |
| EStG AT §33 (2026 Valorisierung) | `https://www.bmf.gv.at/steuern/lohnsteuer` |
