# EU27 Pension & Tax Burden Explorer

An interactive, fully client-side single-page application for exploring and comparing pension outcomes and tax burdens across the **22 EU OECD member states**. No backend required — all country data, tax tables, SSC rates and pension formula parameters are encoded as static TypeScript and computed entirely in the browser. For information and learning purposes only, not to be used for any calculations of personal finance estimations. Made with AI agent.

**Live demo:** https://zdenk.github.io/PensionTaxExplorer/

---

## ⚠️ Disclaimers

> **This tool is for illustrative and educational purposes only. It is not financial, tax, legal, or actuarial advice. Do not make retirement or financial planning decisions based on its outputs.**

### Illustrative model — not a personal pension forecast
All calculations model a stylised, standard employee and should be read as order-of-magnitude illustrations of how different countries' statutory systems compare structurally. Individual outcomes will differ materially based on personal circumstances, actual career history, future legislative changes, and employer arrangements.

### Present values only — no wage growth and no inflation adjustment
All monetary figures are expressed in **today's (present-value) terms** using current-year wage and parameter data. The model does **not** project future nominal amounts and makes the following simplifying assumptions:

- **Constant real wage throughout the entire career.** Real wages typically grow 2–3 % per year in the early career and flatten with age; ignoring this understates lifetime pension-eligible earnings.
- **No post-retirement pension indexation.** PAYG pensions in most countries are indexed annually to wages or prices; the replacement rate shown is the rate *at the point of retirement only* and will diverge from actual purchasing power as retirement progresses.
- **No explicit discount rate.** Future pension cash flows are not discounted back to a present value, so the "break-even age" metric is a simple nominal payback and not a financially rigorous NPV measure.

### Tax credits and personal circumstances not modelled
The income tax calculations implement **basic statutory brackets and standard employee SSC rates only**. The following are explicitly excluded and will produce materially different real-world results in many countries:

- Child tax credits and family allowances (e.g. Czech Republic, Germany Ehegattensplitting, France Quotient Familial)
- Married couple / joint filing benefits
- Disability or carer allowances
- Housing deductions and mortgage interest relief
- Voluntary private pension contribution tax relief
- Any means-tested benefits or top-ups
- **Regional and municipal income tax variation** (e.g. French communes range from approximately 29 % to 35 % in combined marginal rate; the model uses a population-weighted national average)
- **13th / 14th month bonuses** (Austria, Germany and others), which are subject to preferential tax treatment; these are flattened into an equivalent constant monthly rate

### Pension data complexity — not independently verified
Statutory pension systems across 22 countries involve hundreds of parameters (accrual rates, ceilings, indexation rules, early-retirement penalties, survivor rules, transition provisions, Pillar 2 / Pillar 3 interactions, and more). The parameters encoded in this application have been sourced in good faith from OECD, MISSOC, and national authorities, but **have not been independently audited or verified by a qualified actuary or pension specialist**.

> **Czech Republic focus:** This tool was developed primarily with the Czech system in mind. The Czech tax, SSC, and pension parameters have been verified in detail against official sources (MPSV, ČSSZ, MF ČR). Parameters for all other countries are based on OECD and MISSOC data but **have not been cross-checked with the same level of rigour** — treat non-CZ outputs with additional caution and verify key figures against national authorities before drawing conclusions. Known limitations include:

- **Finland (TyEL):** Modelled as a DB system with a longevity adjustment coefficient. This is a simplification; the correct treatment requires a dedicated `TyELConfig` type (flagged as design debt).
- **NDC annuity divisors:** Life expectancy divisors (Poland, Sweden, Italy, Latvia, Estonia) are taken from published tables but may not reflect the precise cohort-specific figures that will apply at an individual's actual retirement date. Non-standard retirement ages (e.g. age 62) fall back to the nearest available divisor rather than being interpolated, which can slightly over- or understate the pension.
- **Transition cohorts:** Most countries have transition rules for workers born before a certain year. This model applies the mature steady-state formula and does not model transition cohort adjustments.
- **Indexation:** Post-retirement pension indexation (price, wage, or mixed) is not modelled. Replacement rates shown are at the point of retirement only.
- **Second and third pillar pensions:** Voluntary or quasi-mandatory funded pillars (e.g. Danish ATP/occupational schemes, Dutch sector pension funds, Swedish PPM) are either excluded or only partially captured.
- **France AGIRC-ARRCO:** The supplementary PAYG points system is modelled as a funded-account equivalent (3 % real return) rather than as the actual PAYG points mechanism. The calibration factors are reverse-engineered to match OECD *Pensions at a Glance* replacement-rate targets, not derived from the official point pricing, and may become stale if OECD revises its methodology.
- **DB minimum pension floor:** The statutory minimum pension is applied as a flat floor with no proration for career length. Workers with a partial career (e.g. < 40 years) may see a modestly overstated minimum-pension outcome.
- **Pillar 2 funded annuity horizon:** All funded second-pillar accounts are annuitised over a fixed 20-year horizon. Some occupational schemes use a lifetime annuity (e.g. Netherlands) or a shorter fixed-term payout; the 20-year assumption is a simplification.

---

## Screenshot

![Wage distribution — average vs median](docs/mzda-distribuce-prumer-median.png)

*Source: [kurzy.cz — Průměr a medián mzdy](https://zpravy.kurzy.cz/826074-ostre-sledovana-mzda--prumer-a-median/)*

> **Note on wage distribution:** The shape of the wage distribution — and therefore the gap between the mean, median, and mode — is highly country-specific. In most EU countries the distribution is right-skewed, meaning the **average (mean) wage is significantly higher than the median**, and both are above the most common (mode) wage. Before interpreting any calculation, check the median and mode for the country in question: using the average wage as the "typical" worker benchmark can be misleading in countries with high wage inequality. Where possible, run the tool at 67 % AW (≈ median in many countries) alongside 100 % AW to understand how the system treats ordinary earners vs higher earners.

---

## Features

- **Side-by-side country comparison** — select up to three countries at once and compare them across all metrics
- **Career timeline modelling** — projects gross wage, net wage, SSC contributions, and pension accrual year-by-year over a full career
- **Pension outcome simulation** — calculates projected pension benefit using each country's actual statutory formula (DB, NDC, points-based, or flat-rate)
- **Replacement rate curves** — visualises net replacement rates across the wage distribution (50 % – 200 % of average wage)
- **SSC redistribution breakdown** — shows how employee and employer social security contributions are split across pension, health, unemployment, and other schemes
- **Wage breakdown table** — gross → SSC → taxable income → income tax → net at every wage level
- **Self-employment modes** — side-by-side employed vs self-employed comparison where modelled
- **Fair-return analysis** — estimates the internal rate of return on mandatory pension contributions
- **OECD benchmark comparison** — validates results against published *Pensions at a Glance* replacement rates

### Country Coverage (22 OECD EU members)

| | | | | |
|---|---|---|---|---|
| 🇦🇹 Austria | 🇧🇪 Belgium | 🇨🇿 Czech Republic | 🇩🇰 Denmark | 🇪🇪 Estonia |
| 🇫🇮 Finland | 🇫🇷 France | 🇩🇪 Germany | 🇬🇷 Greece | 🇭🇺 Hungary |
| 🇮🇪 Ireland | 🇮🇹 Italy | 🇱🇻 Latvia | 🇱🇹 Lithuania | 🇱🇺 Luxembourg |
| 🇳🇱 Netherlands | 🇵🇱 Poland | 🇵🇹 Portugal | 🇸🇰 Slovakia | 🇸🇮 Slovenia |
| 🇪🇸 Spain | 🇸🇪 Sweden | | | |

> Bulgaria, Croatia, Cyprus, Malta, and Romania (non-OECD EU members) are deferred to a future data phase.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Charts | [Recharts](https://recharts.org/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Build tool | [Vite 5](https://vitejs.dev/) |
| Deployment | [GitHub Pages](https://pages.github.com/) via GitHub Actions |

No runtime API calls. All computation happens in the browser using pure functions with zero side effects — every result is fully reproducible and auditable.

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Install & Run

```bash
# Clone the repository
git clone https://github.com/<your-github-username>/pension-tax-explorer.git
cd pension-tax-explorer/pension-app

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open http://localhost:5173 in your browser.

### Build

```bash
npm run build
```

The production build is output to `pension-app/dist/`.

### Preview Production Build

```bash
npm run preview
```

### Validation Scripts

Run the Phase 1 validation suite (checks all country configs compile and produce sane outputs):

```bash
npm run validate
```

---

## Project Structure

```
pension-app/
├── src/
│   ├── components/          # React UI components
│   │   ├── ControlsBar.tsx         # Country selector, wage mode, AW source
│   │   ├── CountryCard.tsx         # Per-country result column
│   │   ├── ComparisonCharts.tsx    # Multi-country chart panel
│   │   ├── Graph1_CareerTimeline.tsx
│   │   ├── Graph2_Accumulation.tsx
│   │   ├── Graph3_ReplacementRateCurve.tsx
│   │   ├── KPIRow.tsx
│   │   ├── SSCRedistributionTable.tsx
│   │   └── WageBreakdownTable.tsx
│   ├── data/               # Static country configs (one file per country)
│   │   ├── countryRegistry.ts
│   │   └── <country>.ts    # austria.ts, germany.ts, …
│   ├── engines/            # Pure-function calculation engines
│   │   ├── TaxEngine.ts           # Income tax (brackets, credits)
│   │   ├── SSCEngine.ts           # Social security contributions
│   │   ├── PensionEngine.ts       # Pension benefit projection
│   │   ├── TimelineBuilder.ts     # Career year-by-year timeline
│   │   └── FairReturnEngine.ts    # IRR on pension contributions
│   ├── state/
│   │   └── appReducer.ts          # React useReducer state management
│   ├── utils/
│   │   ├── computeScenario.ts
│   │   ├── formatCurrency.ts
│   │   └── resolveWage.ts
│   └── validation/         # Offline validation scripts (run with tsx)
│       ├── phase1Validate.ts
│       ├── pensionBenchmark.ts
│       └── oecdComparison.ts
└── package.json
```

---

## Data Sources

All parameters are sourced from authoritative, openly licensed datasets. The majority of values are taken directly from official publications; however, a small number are projections or calibrations:

- **Projected 2026 values** — some parameters (e.g. German Rentenwert, Durchschnittsentgelt, Polish GUS wage averages) are forward-projected from the latest available official data and will differ from the actuals once published.
- **Calibrated factors** — supplementary pension parameters for systems such as France AGIRC-ARRCO are calibrated to match OECD *Pensions at a Glance* replacement-rate benchmarks rather than derived from official point-pricing documents.

| Parameter | Source |
|---|---|
| Income tax brackets | [OECD Taxing Wages SDMX API](https://data-api.oecd.org/datasource/DSD_TAXWAGES@DF_TAXWAGES) |
| SSC rates | [MISSOC Comparative Tables](https://www.missoc.org/missoc-database/comparative-tables/) |
| Average wages | [Eurostat `earn_ses_monthly`](https://ec.europa.eu/eurostat/databrowser/view/earn_ses_monthly) / [OECD Average Wages](https://data-api.oecd.org/datasource/AV_AN_WAGE) |
| EUR exchange rates | [ECB SDMX-REST API](https://data-api.ecb.europa.eu/service/data/EXR/) |
| Pension formula parameters | [OECD *Pensions at a Glance*](https://www.oecd-ilibrary.org/finance-and-investment/pensions-at-a-glance_19991363) + national authorities |

See [EU27_Pension_Tax_Explorer_Technical_Design.md](./EU27_Pension_Tax_Explorer_Technical_Design.md) for full source documentation, API endpoints, and the annual data refresh workflow.

---

## Deploying to GitHub Pages

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically builds and deploys the app to GitHub Pages on every push to `main`.

### First-time setup

1. Push this repository to GitHub.
2. Go to **Settings → Pages** in your repository.
3. Under **Source**, select **GitHub Actions**.
4. Push to `main` — the workflow will build and publish automatically.

The live URL will be:
```
https://<your-github-username>.github.io/<repo-name>/
```

---

## Scope & Limitations

- Models a **single adult employee** with no tax-modifying personal circumstances (no children, not married, no disability).
- **Out of scope in this version:** child tax credits, married couple filing, disability allowances, housing deductions, voluntary private pension top-ups.
- Finland's TyEL system is modelled as DB with a longevity adjustment coefficient — a dedicated `TyELConfig` variant is flagged as design debt.
- Non-OECD EU members (BG, RO, HR, CY, MT) are deferred to a future Phase 6 data pack.
- **Model precision:** The validation suite compares outputs against OECD *Pensions at a Glance* benchmarks with a tolerance of ±8–12 percentage points to account for structural differences (OECD uses a career with wage growth; this model uses a constant wage). The tool is designed for **comparative illustration**, not actuarial precision.
- **Funded Pillar 2 / fair-return returns are deterministic:** All funded account projections assume a constant 3 % real annual return with no volatility, no sequence-of-returns risk, and no management fees. Actual long-term outcomes will differ materially depending on market conditions and the timing of retirement.

---

## Credited Non-Contributory Periods (not modelled)

Most EU pension systems credit periods during which no contributions are paid — the state or employer either pays contributions on the worker's behalf or assigns notional earnings for that period. **None of these periods are currently modelled by this application**, which assumes a fully continuous career from start age to retirement age.

The table below documents what each country credits in principle, as a reference for interpreting the gap between model output and real-world outcomes.


The engine currently uses `careerYears = retirementAge − careerStartAge` as a flat number — none of the non-contributory periods below are modelled. This table documents the real-world rules for each country; a `creditedBonusYears` field per life-event type is planned for a future phase.


| Country | University / Study | Military Service | Parental / Child-Rearing | Unemployment | Sickness |
|---|---|---|---|---|---|
| 🇩🇪 Germany | Pre-1992: up to 7 semesters (Anrechnungszeit); **post-1992: abolished** | ✅ Wehrdienst/Zivildienst — full credit at avg wage | ✅ **3 years/child** at 100 % avg wage (Kindererziehungszeit) — most generous in EU | ✅ ALG I periods | ✅ |
| 🇦🇹 Austria | Pre-2005 old system: yes. **Post-2005 Pensionskonto: no** (voluntary buyback available) | ✅ Präsenzdienst | ✅ Up to 4 years/child (at ~⅓ avg contrib base) | ✅ | ✅ |
| 🇫🇷 France | Not automatic; can be **purchased** (rachat de trimestres) | ✅ | ✅ Maternity quarters + AVPF for stay-at-home parents | ✅ Trimestres assimilés | ✅ |
| 🇧🇪 Belgium | Not automatic; purchasable | ✅ | ✅ Maternity, time-crédit assimilated | ✅ Full assimilation | ✅ |
| 🇳🇱 Netherlands | ✅ **AOW is residence-based** (2 %/yr age 15–67) — study years in NL count as residence | ✅ (residence) | ✅ (residence) | ✅ (residence) | ✅ |
| 🇩🇰 Denmark | ✅ **Folkepension is residence-based** — same as NL | ✅ | ✅ | N/A (residence) | N/A |
| 🇸🇪 Sweden | ❌ No direct credit | ✅ Short service (small) | ✅ Parental benefit (föräldrapenning) credited | ✅ A-kassa periods | ✅ |
| 🇫🇮 Finland | ❌ Abolished | ✅ Flat amount | ✅ At 117 % of parental benefit | ✅ 75 % of benefit | ✅ 75 % of benefit |
| 🇮🇹 Italy | ❌ (NDC — only actual contributions count) | ✅ State pays minimal flat | ✅ Maternity (state credit) | ✅ State integrates | ✅ |
| 🇪🇸 Spain | ❌ | ✅ Up to 2 years | ✅ Maternity/paternity full credit | ✅ Only if cotizando | ✅ |
| 🇵🇹 Portugal | ❌ | ✅ | ✅ Maternity/paternity | ✅ Períodos de equivalência | ✅ |
| 🇬🇷 Greece | ⚠️ Pre-2016: up to 4 years first degree; **post-2016 reform: mostly abolished** | ✅ | ✅ Maternity | ✅ | ✅ |
| 🇨🇿 Czech Republic | ⚠️ Pre-2010: up to 6 years credited; **post-2010: only with voluntary contributions** | ✅ | ✅ Up to 4 years/child (parental leave) | ✅ Up to 3 years | ✅ |
| 🇵🇱 Poland | ⚠️ Counted as **non-contributory** (nieskładkowy) — accrues at 0.7 % vs contributory 1.3 %; capped at ⅓ of contributory years | ✅ Credited as contributory | ✅ Maternity/parental | ✅ Non-contributory | ✅ |
| 🇭🇺 Hungary | ⚠️ Pre-2009: credited; **post-2009 reform: abolished** | ✅ | ✅ GYES/GYED — up to 3 years/child | ✅ | ✅ |
| 🇸🇰 Slovakia | ⚠️ First degree up to 3 years credited at state expense (post-reform reduced) | ✅ | ✅ Up to 6 years | ✅ | ✅ |
| 🇸🇮 Slovenia | ⚠️ Up to 6 years first degree — **buyback option** | ✅ | ✅ | ✅ | ✅ |
| 🇪🇪 Estonia | ❌ | ✅ 12 months | ✅ State pays parental leave contributions | ✅ If benefit drawn | ✅ |
| 🇱🇻 Latvia | ❌ (NDC — only actual contributions) | ✅ State pays | ✅ State pays | ✅ State pays | ✅ |
| 🇱🇹 Lithuania | ❌ | ✅ State pays | ✅ State pays | ✅ | ✅ |
| 🇮🇪 Ireland | ❌ | ✅ | ✅ Up to 20 years home-caring credits | ✅ PRSI credits | ✅ |
| 🇱🇺 Luxembourg | ⚠️ Up to 6 semesters — **purchasable** (rachat) | ✅ | ✅ 4 years/child | ✅ | ✅ |


### Key patterns


- **Residence-based systems** (🇳🇱 NL, 🇩🇰 DK): the question is irrelevant — any year you live in the country counts, whether working, studying, or caring.
- **Germany stands out most**: 3 years per child at full average wage (Kindererziehungszeit) can add 6–9 pension points for a parent of two — the most generous child-rearing credit in the EU.
- **Study credit is disappearing**: most countries reformed it away post-2000 (CZ, HU, AT, FI, SE). Greece and Austria had significant study credits that were reduced or abolished.


> These rules are subject to change and vary significantly in duration, base amount, and eligibility conditions. Sources: MISSOC Comparative Tables, OECD *Pensions at a Glance*, national social security legislation. The Czech Republic entries have been verified in detail; entries for all other countries should be independently confirmed before use.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

Data reproduced from OECD, Eurostat, MISSOC, and ECB sources is subject to their respective open-data licences (OECD Terms, CC BY 4.0, ECB open data). See the technical design document for full attribution.
