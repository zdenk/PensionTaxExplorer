/**
 * generateCountryPages.ts
 *
 * Build-time script — generates public/{slug}/index.html for all 22 EU countries.
 * Run with:  tsx scripts/generateCountryPages.ts
 * Also runs as part of:  npm run build  (via "prebuild" hook)
 *
 * Each page:
 *  - Has a unique title, meta description, OG tags, and JSON-LD (WebPage + Dataset)
 *  - Contains rich, crawlable static HTML (OECD data table, system description, FAQs)
 *  - Immediately redirects to the SPA with that country pre-selected via URL hash
 *  - Works fully without JavaScript (noscript content stands alone)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const BASE_URL = 'https://zdenk.github.io/PensionTaxExplorer';
const LAST_UPDATED = '2026-03-25';

// ── Country data ─────────────────────────────────────────────────────────────
// rr: [0.5× AW, 1.0× AW, 2.0× AW] gross replacement rates (%)
// Source: OECD Pensions at a Glance 2023, mandatory public pension, men

interface CountryData {
  code: string;
  name: string;
  slug: string;
  flag: string;
  pensionAge: number;
  rr: [number, number, number];
  systemType: string;
  systemDesc: string;
  comparators: string[]; // up to 2 codes to compare in the "How does X compare?" box
  faqs: Array<{ q: string; a: string }>;
}

const COUNTRIES: CountryData[] = [
  {
    code: 'AT', name: 'Austria', slug: 'austria', flag: '🇦🇹',
    pensionAge: 65, rr: [84.8, 86.8, 62.4],
    systemType: 'Defined-benefit — Pensionskonto (account-based DB)',
    systemDesc: `Austria operates an account-based defined-benefit system (Pensionskonto) introduced in 2005, fully phased in by 2014.
Workers accrue 1.78% of gross annual earnings per contribution year, credited to a virtual account revalued annually.
A full 45-year career at average wage yields approximately 80% of gross average earnings.
The system is PAYG-financed: employee SSC is 10.25% of gross wage; employer SSC is 12.55%, both up to a monthly ceiling.
Normal retirement age is 65 for men; women's age is rising from 60 to 65 by 2033.`,
    comparators: ['DE', 'CZ'],
    faqs: [
      { q: 'How does the Austrian pension system work?', a: 'Austria\'s Pensionskonto credits 1.78% of each year\'s gross earnings to a virtual account. At retirement, the accumulated total (revalued with a wage index) is divided by 14 (reflecting 14 monthly payments) to give your monthly pension. A 45-year career at the average wage gives roughly 87% gross replacement.' },
      { q: 'What is the retirement age in Austria?', a: 'Normal pension age for men is 65. For women it is rising from 60 to 65 in annual steps, reaching 65 from 2033. Early retirement (Korridorpension) is available from 62 with at least 40 contribution years, subject to a deduction of 5.1% per year before 65.' },
      { q: 'How do Austria\'s pension contributions compare to Germany?', a: 'Austria\'s total mandatory pension SSC is 22.8% of gross wage (10.25% employee + 12.55% employer), compared to Germany\'s 18.6% (9.3% each side). Austria\'s higher contribution rate supports a notably more generous replacement rate: 86.8% vs 53.3% at the average wage per OECD Pensions at a Glance 2023.' },
    ],
  },
  {
    code: 'BE', name: 'Belgium', slug: 'belgium', flag: '🇧🇪',
    pensionAge: 67, rr: [80.9, 61.1, 42.5],
    systemType: 'Defined-benefit — earnings-related with minimum pension floor',
    systemDesc: `Belgium's statutory pension rewards a full 45-year career at 75% of revalued lifetime earnings.
Below-average earners benefit significantly from the minimum pension floor (minimum pensioenbedrag / montant minimum), which explains
why the replacement rate at half the average wage (80.9%) substantially exceeds that at the average wage (61.1%).
The reference wage is capped at the salary threshold for pension rights (currently around €70,000/year), limiting benefits for high earners.
Normal retirement age rose to 66 in 2025 and will rise to 67 in 2030. Early retirement is possible at 63 with 42 contribution years.
Employee pension contribution is 7.5% of gross wage.`,
    comparators: ['NL', 'FR'],
    faqs: [
      { q: 'Why is the Belgian replacement rate higher for low earners?', a: 'Belgium has a minimum guaranteed pension (minimum pensioenbedrag). A low earner who has completed a full 45-year career receives this floor regardless of actual contributions, pushing their replacement rate to 80.9% at 0.5× average wage. Higher earners receive only the proportional earnings-related benefit, giving them 61.1% at the average wage.' },
      { q: 'What is the retirement age in Belgium?', a: 'The legal retirement age is currently 66 (raised from 65 in 2025) and will rise to 67 in 2030. Early retirement at 63 requires 42 contribution years. Longer careers (44+ years) allow early retirement at 60 under certain conditions.' },
      { q: 'How does Belgium compare to the Netherlands for pensions?', a: 'The Netherlands (96.0% RR at average wage) substantially outperforms Belgium (61.1%) primarily because Dutch workers participate in mandatory sector-level occupational pension funds (Pillar 2) on top of AOW. The OECD figures include these funds for the Netherlands. Belgium has occupational pensions but they are not universally mandatory, so the OECD mandatory-public comparison favours the Netherlands.' },
    ],
  },
  {
    code: 'CZ', name: 'Czech Republic', slug: 'czech-republic', flag: '🇨🇿',
    pensionAge: 67, rr: [71.4, 44.2, 30.6],
    systemType: 'Defined-benefit — flat base (Základní výměra) + earnings-related (Procentní výměra)',
    systemDesc: `The Czech statutory pension (starobní důchod) combines two components.
The flat-rate base (Základní výměra, currently CZK 4,040/month in 2026) is paid to every retiree equally,
providing a redistributive floor. The earnings-related component (Procentní výměra) accrues at 1.5% of the
personal assessment base (výpočtový základ) per year of contribution — with a tapering formula that gives
proportionally more to lower earners. Together, a low earner at 0.5× average wage gets 71.4% gross replacement rate,
while an average earner gets 44.2%. The retirement age is rising to 67 by 2041 (currently approximately 64–66 by birth year).
Employee pension SSC: 6.5% of gross wage; employer: 24.8%.`,
    comparators: ['DE', 'AT'],
    faqs: [
      { q: 'How does the Czech pension system work?', a: 'The Czech state pension has two parts: a flat base amount (identical for everyone, regardless of earnings) plus an earnings-related supplement calculated on your lifetime assessment base with a progressive reduction factor. This produces high replacement rates for low-wage workers and relatively low replacement rates (44.2% at average wage) for typical earners.' },
      { q: 'What will the Czech retirement age be?', a: 'The retirement age is being raised by 2 months per birth year with no upper cap currently legislated, reaching approximately 67 for those born around 1975. A 2024 reform proposal discussed capping at 66 or 67, but no final cap was enacted as of 2026.' },
      { q: 'How does the Czech pension compare to German?', a: 'Both use earnings-related formulas but Czech replacement rates for average earners (44.2%) are lower than Germany\'s (53.3%) at the 1.0× AW level. However, for low earners (0.5× AW), Czechia (71.4%) outperforms Germany (57.7%) due to the flat base component. Czech total pension SSC is considerably higher at 31.3% (combined) vs Germany\'s 18.6%.' },
    ],
  },
  {
    code: 'DK', name: 'Denmark', slug: 'denmark', flag: '🇩🇰',
    pensionAge: 74, rr: [116.7, 77.1, 63.6],
    systemType: 'Flat-rate public pension (Folkepension) + mandatory ATP supplementary',
    systemDesc: `Denmark's public pension (Folkepension) is a flat-rate, residence-based benefit means-tested against other income.
For a low earner with no other income it can fully replace prior wages, producing a 116.7% gross replacement rate at 0.5× average wage.
The ATP (Arbejdsmarkedets Tillægspension) quasi-mandatory funded scheme adds a small earnings-related component.
Crucially, the retirement age is legislatively linked to life expectancy under a 2006 reform — currently 74 in the OECD model —
which is the highest normal pension age in the EU. Contributions from workers to ATP are modest; occupational funded
schemes (carried by employers) dominate as the primary income-replacement vehicle for average earners.`,
    comparators: ['SE', 'NL'],
    faqs: [
      { q: 'Why does Denmark\'s pension replacement rate exceed 100% for low earners?', a: 'Denmark\'s Folkepension is flat-rate and means-tested. For a low-wage worker with no other pension income, the full Folkepension can actually exceed their working wage — producing a gross replacement rate above 100%. Higher earners have a lower replacement rate because the flat pension is an equal amount regardless of prior earnings.' },
      { q: 'What is the Danish pension age?', a: 'Denmark\'s normal pension age is directly linked to average life expectancy, rising automatically every 5 years. Under OECD modelling it reaches 74 for those entering the labour market today — the highest in the EU. Early retirement (voluntary early retirement scheme) exists from 62 under conditions.' },
      { q: 'How does the Danish pension system differ from Sweden\'s?', a: 'Sweden uses an NDC system (earnings-related notional accounts + PPM funded component), giving a fairly flat 66% replacement rate regardless of earnings. Denmark relies on a flat public pension + mandatory sector-level occupational funds. Both systems produce adequate replacement rates but via fundamentally different architectures, with Denmark\'s requiring a much later retirement age.' },
    ],
  },
  {
    code: 'EE', name: 'Estonia', slug: 'estonia', flag: '🇪🇪',
    pensionAge: 71, rr: [56.2, 37.8, 23.9],
    systemType: 'PAYG state pension (Pillar 1) + mandatory funded Pillar 2',
    systemDesc: `Estonia has a three-pillar pension architecture. Pillar 1 is a PAYG state pension combining a
flat base (€292/month in 2026 for full 43-year career) with an insurance component proportional to years of service.
Pillar 2 is a mandatory funded scheme: employees contribute 2% of gross wage matched by 4% employer social tax, invested in
licensed funds. Following opt-out reform (2021), Pillar 2 is now voluntary for new workers — reducing mandatory contributions for some.
The OECD replacement rates shown reflect Pillar 1 mandatory public pension only.
Estonia's pension age is rising to 71 for those born from 1970 onwards, linked to life expectancy.`,
    comparators: ['LV', 'LT'],
    faqs: [
      { q: 'Does Estonia have a good pension system?', a: 'Estonia\'s gross replacement rate at the average wage (37.8%) is below the EU average. The state pension is designed to provide a basic floor, with the expectation that funded Pillar 2 accounts (mandatory for most workers) supplement it. Including Pillar 2, effective replacement rates are somewhat higher, but Estonia remains among the lower-replacement EU systems for average earners relying only on mandatory schemes.' },
      { q: 'What is the retirement age in Estonia?', a: 'Estonia\'s pension age is rising annually and is linked to life expectancy. For those born in 1970 or later, the pension age under current law will reach 71. This is the second-highest in the EU after Denmark.' },
      { q: 'How does Estonia compare to Latvia and Lithuania on pensions?', a: 'All three Baltic states have relatively low mandatory public replacement rates. Estonia (37.8%) sits between Latvia (52.2%) and Lithuania (28.2%) at the average wage. Estonia\'s Pillar 2 funded scheme partially compensates; Latvia also has an NDC structure with funded elements. Lithuania\'s system provides the lowest replacement rate of the three.' },
    ],
  },
  {
    code: 'FI', name: 'Finland', slug: 'finland', flag: '🇫🇮',
    pensionAge: 68, rr: [63.8, 65.7, 63.9],
    systemType: 'Defined-benefit — TyEL earnings-related, partially funded',
    systemDesc: `Finland's earnings-related pension (TyEL — Työntekijän eläkelaki) is a defined-benefit scheme
with a partially funded structure managed by private pension insurance companies under public regulation.
Workers accrue 1.5% of annual gross earnings per year from age 17 to 52, 1.9% from 53 to 62, and 4.5% from 63 to 67.
The higher accrual in later working years incentivises staying in work. Combined employee + employer contribution is approximately 24% of gross wage (2026).
The near-flat replacement rate (63.8%–65.9%) across all wage levels reflects the strictly proportional benefit formula.
Normal flexible retirement age is 63–68; early pension with actuarial reduction from 63.`,
    comparators: ['SE', 'DK'],
    faqs: [
      { q: 'How does the Finnish pension system work?', a: 'Finland\'s TyEL pension accrues at 1.5% of gross wage per year for younger workers, rising to 4.5% from age 63. This means a 40-year career gives approximately 63% gross replacement rate. Uniquely among Nordic countries, TyEL is managed by competing private insurance companies (Varma, Ilmarinen, Elo, etc.) under a public regulatory framework, blending public mandate with private management.' },
      { q: 'What is the retirement age in Finland?', a: 'Finland operates a flexible retirement window. The earliest retirement age is 63 (with actuarial reduction), the target retirement age (tavoite-eläkeikä) is linked to life expectancy and is currently around 64–66 for different birth years, and the upper age limit is 68. The OECD models Finnish pension age at 68.' },
      { q: 'Does Finland have a guaranteed minimum pension?', a: 'Yes. Workers who have low or no TyEL entitlement receive the national pension (kansaneläke) — a means-tested flat-rate pension that provides a minimum income floor in retirement. This is separate from TyEL and ensures no Finnish retiree is entirely without pension income.' },
    ],
  },
  {
    code: 'FR', name: 'France', slug: 'france', flag: '🇫🇷',
    pensionAge: 65, rr: [66.1, 70.0, 58.9],
    systemType: 'PAYG DB (Régime Général) + mandatory AGIRC-ARRCO points supplementary',
    systemDesc: `France operates a two-tier mandatory PAYG system. The basic Régime Général (CNAV) provides up to 50%
of the best-25-year average salary (SAM), subject to an annual ceiling (plafond de la Sécurité Sociale, approximately €46,368/year in 2026),
at the full rate (taux plein) once 172 quarters (43 years) are validated or at age 67.
The mandatory supplementary AGIRC-ARRCO scheme provides additional benefit via a points system covering all
private-sector workers regardless of earnings level. Together, both tiers give an average earner around 70% gross replacement rate.
Following the 2023 reform (Borne government), the legal earliest retirement age rose from 62 to 64, with full-rate at 67 unchanged.
Total pension SSC is high: employee 10.8%, employer ~16% (on different bases).`,
    comparators: ['DE', 'BE'],
    faqs: [
      { q: 'How does the French pension system work?', a: 'France has two mandatory layers: (1) the Régime Général provides a base pension of up to 50% of your best-25-year average salary if you have 43 full years (172 quarters) of contributions; (2) AGIRC-ARRCO gives all employees supplementary points based on contributions to a second pool. Both are PAYG — current workers fund current retirees. Early retirement before 64 is now restricted since the 2023 reform.' },
      { q: 'What age can you retire in France?', a: 'Since the 2023 pension reform, the minimum legal retirement age is 64 (up from 62). Full pension rate (taux plein without reduction) requires 172 quarters of contributions or reaching age 67. Exceptions exist for long-career workers (carrières longues) who started work before 20 and can retire earlier.' },
      { q: 'Is France\'s pension system sustainable?', a: 'France\'s pension expenditure is among the highest in the EU at around 14% of GDP. The 2023 reform raising the retirement age from 62 to 64 was designed to close a projected financing gap of €13–18 billion by 2030. Pension system sustainability remains a major political issue, with demographic projections showing a declining worker-to-retiree ratio through 2040.' },
    ],
  },
  {
    code: 'DE', name: 'Germany', slug: 'germany', flag: '🇩🇪',
    pensionAge: 67, rr: [57.7, 53.3, 38.8],
    systemType: 'Points-based PAYG — Rentenversicherung (Entgeltpunkte)',
    systemDesc: `Germany's statutory pension (gesetzliche Rentenversicherung, gRV) is a PAYG earnings-related points system.
Workers earn one Entgeltpunkt (pension point) for each year worked at the national average wage; proportionally fewer or more points
at other earnings levels. The Rentenwert (current point value: €40.17/month from July 2025) is adjusted annually.
Monthly pension = total lifetime Entgeltpunkte × Rentenwert × access factor × pension type factor.
A worker at average wage for 40 years accumulates 40 points, giving €40.17 × 40 = €1,607/month gross.
Contributions: 18.6% of gross wage split equally (9.3% employee, 9.3% employer); ceiling at €8,450/month (2026).
Normal retirement age is 67 (increasing from 65 via 2007 reform; fully phased in from 2031 birth year 1964).`,
    comparators: ['AT', 'FR'],
    faqs: [
      { q: 'How is the German pension calculated?', a: 'German pension = Entgeltpunkte × Rentenwert × Zugangsfaktor × Rentenartfaktor. You earn 1.0 Entgeltpunkt per year at the average wage (€47,460/year in 2026). At 40 points × €40.17 Rentenwert = approximately €1,607/month gross. The Zugangsfaktor is 1.0 at normal age, reduced by 3.6% per year of early retirement.' },
      { q: 'Why is Germany\'s replacement rate lower than Austria\'s?', a: 'Germany (53.3%) vs Austria (86.8%) at average wage reflects different contribution rates and benefit formulas. Germany\'s total pension SSC is 18.6% vs Austria\'s 22.8%. Austria also uses the entire career earnings base to produce a more generous benefit. Germany targets a 48% pension level (Rentenniveau) as a legal minimum floor, meaning the gap is also political — Germany relies more on voluntary occupational and private supplement.' },
      { q: 'Is the German pension system sustainable?', a: 'Germany faces significant demographic pressure: the ratio of contributors to pensioners will fall sharply as the baby-boom generation retires from the late 2020s through 2030s. The contribution rate is legally capped at 22% through 2045 (Rentenversicherungsbericht 2023), but bridging the gap will require either higher contributions, lower benefits, later retirement, or the new Aktienrente (equity fund) supplement introduced in 2023.' },
    ],
  },
  {
    code: 'GR', name: 'Greece', slug: 'greece', flag: '🇬🇷',
    pensionAge: 67, rr: [75.5, 53.7, 44.1],
    systemType: 'Defined-benefit — EFKA (national flat pension + earnings-related)',
    systemDesc: `Greece restructured its pension system under Law 4387/2016 (the Katseli reform), replacing multiple fragmented funds with EFKA.
The new design has two components: (1) a national pension (εθνική σύνταξη) — a flat-rate amount currently around €360/month for
a full 40-year insurance record — providing strong redistribution; and (2) an earnings-related (ανταποδοτική) component
proportional to lifetime payable contributions. This two-component structure explains the strongly redistributive pattern:
low earners at 0.5× AW receive 75.5% gross replacement; average earners receive 53.7%.
Employee pension contribution is 6.67% of gross wage; employer 13.33%; total 20%.`,
    comparators: ['IT', 'PT'],
    faqs: [
      { q: 'How was the Greek pension reformed?', a: 'Greece undertook sweeping pension reform in 2016 (Law 4387) as part of its adjustment program. The reform consolidated over 100 pension funds into EFKA and replaced rights earned under different schemes with a unified two-component formula (flat national pension + earnings-related component). A sustainability factor (reduction coefficient) applied to pensions above €1,300/month for early retirees.' },
      { q: 'What is the Greek national pension?', a: 'The national pension (εθνική σύνταξη) is a flat-rate amount — currently €360.83/month (2026) at full entitlement (40 contributing years). Workers with fewer than 40 years receive a fraction. This flat component benefits low earners most, raising their replacement rate above that of higher earners.' },
      { q: 'Does Greece have early retirement options?', a: 'Early retirement is available from age 62 with at least 40 years of insurance, subject to a penalty. Standard retirement is 67 (since 2019 for those with a minimum of 15 contribution years) or 62 with 40 years. Extended career exceptions exist for heavy and hazardous work categories.' },
    ],
  },
  {
    code: 'HU', name: 'Hungary', slug: 'hungary', flag: '🇭🇺',
    pensionAge: 65, rr: [76.9, 73.4, 73.4],
    systemType: 'Defined-benefit — proportional (pure DB, no funded Pillar 2 since 2010)',
    systemDesc: `Hungary's statutory pension is a proportional defined-benefit PAYG system.
After the abolition of the mandatory funded second pillar in 2010 (assets transferred to the state), the entire mandatory
pension is Pillar 1 PAYG. The accrual rate varies by career length: 33% of average monthly earnings for a 10-year career,
reaching 80% for a 40-year career — giving a high and nearly earnings-independent replacement rate.
The nearly flat replacement rate across earnings multiples (76.9% at 0.5×, 73.4% at both 1.0× and 2.0× AW) reflects
the purely proportional benefit — one of the least redistributive systems in the EU.
Employee contribution: 10% of gross wage; employer: 13%; total: 23%.`,
    comparators: ['AT', 'SK'],
    faqs: [
      { q: 'What happened to Hungary\'s pension funds in 2010?', a: 'In 2010 the Orbán government nationalised the mandatory funded second pillar (private pension funds), transferring approximately HUF 3 trillion of accumulated assets to the state. Workers who did not return to the state system lost their private pension rights. Since 2010 all mandatory pension is PAYG Pillar 1 only.' },
      { q: 'How is the Hungarian pension calculated?', a: 'The pension is a percentage of the average monthly earnings over the career (revalued by a wage index). The accrual rate increases with career length: 10 years → 33%, 25 years → 56%, 40 years → 80% of average revalued earnings. Early retirement without penalty requires at least 40 years of service.' },
      { q: 'Is Hungary\'s pension inflation-protected?', a: 'Hungarian pensions are indexed using the "Swiss indexation" formula: 50% CPI + 50% net wage growth. This partial indexation means that if real wages grow, pensioners receive less than the full real wage growth, gradually eroding the relative value of older pensions.' },
    ],
  },
  {
    code: 'IE', name: 'Ireland', slug: 'ireland', flag: '🇮🇪',
    pensionAge: 66, rr: [56.5, 33.7, 20.1],
    systemType: 'Flat-rate State Pension Contributory — not earnings-related',
    systemDesc: `Ireland's State Pension Contributory (SPC) is a flat-rate benefit — the same weekly amount regardless of earnings,
based solely on PRSI contribution record. The maximum rate is €289.41/week (2026) ≈ €15,049/year for a full contribution record (520 paid weeks, approximately 10 years).
Because the pension amount is fixed, replacement rates fall sharply with earnings: a half-average earner gets 56.5% gross replacement
rate while an earner at twice the average wage receives only 20.1%. High earners must rely on occupational or private schemes (ARFs/RACs).
Contributions: employee PRSI 4% (no ceiling), employer 11.15%.
State pension age is 66 (reduced from 67/68 planned — 2020 election pledge kept it at 66).`,
    comparators: ['BE', 'DK'],
    faqs: [
      { q: 'How much is the Irish State Pension?', a: 'The State Pension Contributory maximum rate is €289.41/week (€15,049/year) in 2026 for a full PRSI record. A living alone increase of €22/week plus fuel allowance can add €1,144/year. There is also means-tested State Pension Non-Contributory for those without PRSI records, at a lower rate.' },
      { q: 'How do I qualify for the full Irish State Pension?', a: 'You need at least 520 paid PRSI contributions (10 years working). The maximum pension requires a Yearly Average of 48+ contributions (currently being replaced by a Total Contributions Approach under 2024 reforms). Home carer credits can fill some gaps.' },
      { q: 'Why is Ireland\'s pension replacement rate so low for average earners?', a: 'Because the State Pension is a flat amount — it does not scale with your earnings. An average earner (approximately €46,000/year gross) receives the same €15,049/year pension as someone earning €25,000 — giving them only 33.7% replacement. Ireland explicitly assumes workers will supplement with occupational pensions (through auto-enrolment, launching 2024) and private savings.' },
    ],
  },
  {
    code: 'IT', name: 'Italy', slug: 'italy', flag: '🇮🇹',
    pensionAge: 71, rr: [91.1, 91.1, 91.1],
    systemType: 'NDC — Notional Defined Contribution (sistema contributivo puro)',
    systemDesc: `Italy migrated to a pure NDC (Notional Defined Contribution) system with the Dini reform of 1995.
Workers born before 1946 received the old DB formula (retributivo); those born 1946–1955 received a pro-rata mix;
those born after 1955 are fully under the NDC system (contributivo puro) as of 2012.
Contributions of 33% of gross wage (9.19% employee + 23.81% employer) are credited to a notional account,
grown annually by a 5-year moving average nominal GDP growth rate. At retirement the account is divided by an
annuity conversion coefficient (coefficiente di trasformazione) linked to life expectancy at retirement age.
Because the formula is strictly proportional, every euro contributes equally — producing the identical 91.1% replacement rate at all wage levels.
The OECD models pension age at 71 (life-expectancy-linked effective retirement age); the statutory age is 67.`,
    comparators: ['ES', 'PT'],
    faqs: [
      { q: 'Why is Italy\'s pension replacement rate 91% at every wage level?', a: 'Italy\'s NDC formula credits contributions as a fixed 33% of every euro earned, grows it at GDP rate, then divides by a life-expectancy annuity factor at retirement. Since every step is proportional to earnings, the ratio of pension to pre-retirement wage is mathematically identical regardless of wage level — hence 91.1% at 0.5×, 1.0×, and 2.0× average wage.' },
      { q: 'What is Italy\'s retirement age?', a: 'The statutory normal retirement age is 67 (Legge Fornero 2011). Earlier retirement is possible from 62 with 20 contribution years under Quota 103 (with penalties). The OECD models at 71, reflecting the effective retirement age under life-expectancy linkage built into Italian law.' },
      { q: 'Is Italy\'s 91% gross replacement rate financially sustainable?', a: 'Italy\'s pension spending is the highest in the EU as a share of GDP (~16%). The high replacement rate combined with demographic aging creates severe long-term financing pressure. However, the NDC formula is self-adjusting: as life expectancy rises, the annuity conversion coefficient falls, automatically reducing the replacement rate for each cohort — so the 91.1% figure will decline for younger workers.' },
    ],
  },
  {
    code: 'LV', name: 'Latvia', slug: 'latvia', flag: '🇱🇻',
    pensionAge: 65, rr: [64.5, 52.2, 51.4],
    systemType: 'NDC (Pillar 1) + optional mandatory funded Pillar 2',
    systemDesc: `Latvia introduced one of the first NDC systems in the world in 1996. The Pillar 1 PAYG NDC credits 20% of gross wage
to a notional account (indexed to nominal wage growth). Separately, a funded Pillar 2 requires workers to contribute to a licensed
fund manager; the contribution rate to Pillar 2 was 6% (of which 2% from employee, 4% from employer social contribution) during
gradual implementation. At retirement the NDC account is annuitised using life expectancy at that age.
The relatively flat replacement rate across wage levels (64.5% at 0.5× AW, 51.4% at 2× AW) reflects NDC proportionality
with a residual flat supplement for low earners.
Pension age: 65 (since 2025, rising from 63 under 2012 reform law with life-expectancy linkage).`,
    comparators: ['EE', 'LT'],
    faqs: [
      { q: 'How does Latvia\'s NDC pension system work?', a: 'Latvia\'s NDC system credits 20% of your gross wage to a notional account each year. This account grows by the average wage index (not investment returns). At retirement, the accumulated notional capital is divided by your expected remaining lifetime (annuity factor) to give your monthly pension. It is PAYG, not funded — contributions from today\'s workers fund current pensions.' },
      { q: 'Does Latvia have a funded pension pillar?', a: 'Yes — Latvia\'s Pillar 2 is a mandatory funded scheme managed by private pension funds (8 licensed operators). Workers can choose their fund; contributions are invested in financial markets. The Pillar 2 fund was partially suspended during the 2009 economic crisis and later reinstated at a lower rate. OECD replacement rate figures typically reflect Pillar 1 mandatory public pension only.' },
      { q: 'What is Latvia\'s pension age?', a: 'Latvia\'s pension age reached 65 in 2025 after gradually rising from 62. The 2012 law links future increases to life expectancy changes, so pension age may continue rising. Early retirement with a penalty is available from 2 years before normal age with at least 15 contribution years.' },
    ],
  },
  {
    code: 'LT', name: 'Lithuania', slug: 'lithuania', flag: '🇱🇹',
    pensionAge: 65, rr: [36.9, 28.2, 21.0],
    systemType: 'Defined-benefit — basic flat + supplementary earnings-related PAYG',
    systemDesc: `Lithuania has one of the lowest mandatory public pension replacement rates in the EU.
The system combines a basic (flat-rate) state social insurance pension and a small supplementary earnings-related component.
Workers who opt into the funded Pillar 2 (kaupimo pensija) redirect 3% of their social insurance contributions to a private fund.
The strongly redistributive structure — 36.9% at 0.5× AW vs 21.0% at 2× AW — means high earners face a significant retirement income gap.
Employee social insurance contribution: 12.52% (of which 3% optionally to Pillar 2); employer: 1.77%.
Normal retirement age is 65 (fully reached in 2026 for men; women reaching 65 by 2026 in annual steps from 60).`,
    comparators: ['LV', 'EE'],
    faqs: [
      { q: 'Why is Lithuania\'s pension replacement rate the lowest in the Baltics?', a: 'Lithuania\'s state pension formula produces only 28.2% gross replacement at average wage. The benefit structure emphasises the flat basic component, which is low in absolute terms, plus a small earnings supplement. This reflects Lithuania\'s policy choice to keep mandatory PAYG pensions modest and encourage voluntary supplementary savings (Pillar 3 IKI accounts).' },
      { q: 'Does Lithuania have a funded pension pillar?', a: 'Yes — Lithuanian workers can opt into Pillar 2, redirecting 3% of their social insurance contribution base to a licensed private pension fund. The state adds a matching contribution for participants. As of 2019, new labour market entrants are automatically enrolled with an opt-out option.' },
      { q: 'What is the Lithuanian state pension age?', a: 'Lithuania\'s normal pension age is 65 for men (since 2026) and is rising annually to 65 for women (reaching 65 in 2026). Early retirement from 3 years before normal age is possible with at least 30 years of service, subject to a 0.4% monthly reduction.' },
    ],
  },
  {
    code: 'LU', name: 'Luxembourg', slug: 'luxembourg', flag: '🇱🇺',
    pensionAge: 62, rr: [97.2, 87.7, 79.4],
    systemType: 'Defined-benefit — generous career-based with early retirement at 62',
    systemDesc: `Luxembourg combines very high replacement rates with the lowest normal pension age in the OECD EU (62).
The system includes: a flat-rate forfait de base (flat amount), an earnings-related forfait proportionnel (1.85% per year),
and a special revalorisation bonus. At 40 years of contributions the combined formula yields approximately 87.7% gross replacement
for an average earner. High contribution rates fund this generosity: employee 8%, employer 8% (pension only).
Long-career workers with 40+ contribution years can retire at 60 under certain conditions. The high replacement rates
and early exit age make Luxembourg's pension system the most generous in the EU by this measure.`,
    comparators: ['BE', 'FR'],
    faqs: [
      { q: 'Why does Luxembourg have such a high pension replacement rate?', a: 'Luxembourg\'s pension is calculated as flat base + 1.85% × years × reference wage. With 40 years this gives ~74% from the proportional component alone, and the flat forfait adds more. Combined employer+employee contribution of 16% of wage (plus 8% state contribution) funds the generous formula. Luxembourg\'s status as a financial centre and high-wage economy means absolute pension amounts are high.' },
      { q: 'Can you retire early in Luxembourg?', a: 'Yes — retirement at 60 is possible with 40 years of insurance (Préretraite de vieillesse). Standard retirement is 65 with 10 years of insurance, or 62 with 40 years (Retraite anticipée). OECD modelling uses 62 as the effective early retirement age given the incentive structure.' },
      { q: 'How does Luxembourg compare to France and Belgium?', a: 'Luxembourg (87.7% gross RR at average wage) substantially outperforms France (70.0%) and Belgium (61.1%). The key differences are Luxembourg\'s higher flat base component, higher contribution rate, and long-career bonuses. Luxembourg also allows full pension from 62, whereas France requires 67 for full rate without sufficient quarters.' },
    ],
  },
  {
    code: 'NL', name: 'Netherlands', slug: 'netherlands', flag: '🇳🇱',
    pensionAge: 70, rr: [97.2, 96.0, 89.7],
    systemType: 'Flat-rate AOW public pension + mandatory sector occupational funds (Pillar 2)',
    systemDesc: `The Netherlands is widely considered to have one of the world's strongest pension systems.
The public AOW (Algemene Ouderdomswet) is a flat-rate residence-based pension worth approximately €1,406/month
for a single person (full entitlement, 2026). This alone gives relatively high replacement for average earners.
Separately, nearly all employees participate in mandatory sector-level defined-contribution (or CDC) pension funds (Pillar 2),
which are among the largest in the world by assets under management. The OECD replacement rate figures include both.
Employer pension contributions commonly exceed 20% of gross wage. Normal AOW age reached 67 in 2024;
OECD models at 70 reflecting the life-expectancy linkage built into Dutch law from 2025.
The 2023 WTP reform transitioned most funds from DB to individualised DC structures.`,
    comparators: ['BE', 'DK'],
    faqs: [
      { q: 'Why does the Netherlands have 96% pension replacement rate?', a: 'The Netherlands\' figure combines the AOW flat-rate public pension (~€17,000/year single) with mandatory occupational pension fund benefits. Together, most average-wage employees receive around 70–80% of final salary from their pension fund on top of AOW. The OECD figure of 96% at average wage reflects having both a strong state base and one of the best-funded occupational systems in the world.' },
      { q: 'What is the Dutch AOW pension?', a: 'AOW (Algemene Ouderdomswet) is a flat-rate state pension: €1,406/month (2026, single person, gross, full entitlement). It is built up at 2% per year of residence in the Netherlands between ages 15 and 67, so 50 years of residence = 100% AOW. Gaps reduce AOW proportionally — a major consideration for expats.' },
      { q: 'What is the WTP pension reform in the Netherlands?', a: 'The Wet Toekomst Pensioenen (WTP, 2023) reformed the occupational pension system. Old collective defined-benefit promises were replaced by individual investment accounts (persoonlijk pensioenvermogen) within collective frameworks. All major funds must transition by 2028. For individual workers this increases investment risk but improves transparency; for the system it removes large collective balance sheet risks.' },
    ],
  },
  {
    code: 'PL', name: 'Poland', slug: 'poland', flag: '🇵🇱',
    pensionAge: 65, rr: [40.9, 40.6, 37.2],
    systemType: 'NDC (ZUS) + optional funded OFE Pillar 2',
    systemDesc: `Poland reformed to an NDC system in 1999. The mandatory Pillar 1 (ZUS) credits 19.52% of gross wage
to a notional account indexed to nominal wage growth. Separately, after the 2014 reform, the funded Pillar 2 (OFE — Otwarty Fundusz Emerytalny)
became opt-in; contributions are 2.92% of wage for those who opt in (otherwise credited to ZUS sub-account). At retirement
the NDC account is annuitised based on life expectancy at retirement age. The nearly flat replacement rate across
wage levels (40.9% at 0.5× AW, 40.6% at 1.0× AW, 37.2% at 2× AW) reflects the purely proportional NDC design.
Employee contribution: 13.71%; employer: 16.26% (of which pension shares 11.39% + 3.32% to OFE or sub-account).
Retirement age: 65 for men (reduced from 67 in 2017 by PiS government rollback).`,
    comparators: ['CZ', 'SK'],
    faqs: [
      { q: 'How does the Polish NDC pension work?', a: 'Each year, 19.52% of your gross wage is credited to your ZUS notional account (a virtual ledger, not invested). This account is indexed to growth in total covered wages economy-wide. At retirement, your accumulated notional capital is divided by the statistical remaining lifetime for your age cohort to give a monthly pension. The system is PAYG — current contributions fund current pensions.' },
      { q: 'What happened to Poland\'s OFE pension funds?', a: 'Poland\'s funded OFE funds were created in 1999 as a mandatory Pillar 2. In 2013–2014, the government transferred approximately 51% of fund assets (mainly government bonds) to ZUS and made future participation opt-in. As of 2026, workers under 55 can choose whether to direct 2.92% of contribution to OFE (invested markets) or to a ZUS sub-account (virtual, wage-indexed).' },
      { q: 'Why is Poland\'s retirement age only 65?', a: 'Poland\'s retirement age was raised to 67 for men in 2012 under the Tusk government, but the PiS government rolled it back to 65 for men (and 60 for women) in 2017, citing labour market concerns. Women\'s full pension age remains 60, which is the lowest in the EU and significantly reduces the average career length feeding into pension calculations.' },
    ],
  },
  {
    code: 'PT', name: 'Portugal', slug: 'portugal', flag: '🇵🇹',
    pensionAge: 67, rr: [79.4, 67.9, 62.0],
    systemType: 'Defined-benefit — earnings-related DB (with sustainability factor)',
    systemDesc: `Portugal's statutory pension (pensão de velhice) is an earnings-related DB PAYG scheme.
The benefit is calculated on revalued lifetime career earnings with an accrual rate of 2% per year for the first 40 years.
A sustainability factor (fator de sustentabilidade) — linked to the ratio of life expectancy in 2000 to life expectancy
at retirement — reduces early retirement pensions; it was suspended in 2024 and 2025 for standard retirement, and this OECD benchmark
includes the factor. Employee SSC is 11%; employer 23.75%, one of the highest employer SSC rates in the EU.
The strong redistribution (79.4% at 0.5× AW vs 62.0% at 2× AW) reflects both a minimum pension floor and the proportional formula.`,
    comparators: ['ES', 'GR'],
    faqs: [
      { q: 'How is the Portuguese pension calculated?', a: 'Portuguese pension = revalued average career earnings × accrual rate × years of contribution. The accrual rate is 2.0% for the first 40 years (→ 80% of reference earnings at full career), slightly higher for longer careers. Career earnings are revalued by a mixed wage/inflation index. The sustainability factor may reduce this further for early retirees.' },
      { q: 'What is Portugal\'s sustainability factor?', a: 'Portugal\'s fator de sustentabilidade is applied to early retirement pensions and equals life expectancy in 2000 divided by life expectancy at the year of retirement. As life expectancy rises, this factor falls, automatically reducing early retirement benefits. For standard retirement at 67 the factor was suspended in 2024–2025. Future application depends on legislation.' },
      { q: 'How does Portugal compare to Spain on pensions?', a: 'Portugal (67.9% at average wage) and Spain (72.3%) are close in terms of gross replacement rate, both significantly above the EU average. Both have DB systems. Portugal\'s employer SSC (23.75%) is notably higher than Spain\'s (23.6% social security). Spain\'s formula uses the best 25 years; Portugal uses the full career, which can disadvantage workers with interrupted careers.' },
    ],
  },
  {
    code: 'SE', name: 'Sweden', slug: 'sweden', flag: '🇸🇪',
    pensionAge: 70, rr: [67.4, 66.3, 84.4],
    systemType: 'NDC inkomstpension (16% of wage) + funded premium pension PPM (2.5%)',
    systemDesc: `Sweden's 1998 pension reform created a two-component mandatory system.
The inkomstpension is an NDC scheme: 16% of pensionable income is credited to a notional account indexed to average wage growth.
The premiepension (PPM) directs 2.5% of income to a worker-chosen investment fund. Both are funded through the ceiling (~8× average wage).
The unusual pattern where replacement rates are higher at twice the average wage (84.4%) than at the average wage (66.3%)
reflects the PPM funded component: stock-market returns over a 40-year career typically grow faster than average wages,
producing a larger annuity at retirement relative to a higher-earner's final wage in the model.
Retirement is flexible from 63 (2023 reform from 62); OECD models at 70 gross replacement.
Guarantee pension (garantipension) supplements those with low or no inkomstpension.`,
    comparators: ['FI', 'DK'],
    faqs: [
      { q: 'How does the Swedish pension system work?', a: 'Sweden has three layers: (1) the inkomstpension — NDC accounts credited at 16% of wage, indexed to average wages, annuitised at retirement; (2) the premiepension (PPM) — 2.5% of wage invested in market funds of your choice, also annuitised; (3) the guarantee pension for those with low inkomstpension, funded by taxes. Workers can retire flexibly from 63.' },
      { q: 'What is the Swedish PPM premium pension?', a: 'The premiepension allocates 2.5% of your gross wage to a personal account invested in funds you choose from a regulated marketplace (AP7 default fund for non-choosers). At retirement it is converted to a variable annuity. The PPM is unusual globally — most NDC countries have this component as a notional account, not an actual invested fund.' },
      { q: 'Does Sweden have a minimum guaranteed pension?', a: 'Yes — the garantipension provides a minimum pension for those with low or no inkomstpension. From 2023 the minimum pension also includes a tilläggspension (supplement) for those with zero supplementary rights. The guarantee pension is funded by government transfers, not social contributions, and is means-tested against inkomstpension income.' },
    ],
  },
  {
    code: 'SI', name: 'Slovenia', slug: 'slovenia', flag: '🇸🇮',
    pensionAge: 65, rr: [57.4, 56.1, 47.0],
    systemType: 'Points-based defined-benefit (ZPIZ, PAYG)',
    systemDesc: `Slovenia's statutory pension (pokojnina) is administered by ZPIZ (Zavod za pokojninsko in invalidsko zavarovanje).
Workers accumulate pension rights as a percentage of the personal pension base (povprečna osebna pokojninska osnova),
calculated on the most favourable consecutive 24-year earnings window in the career, revalued by a mixed wage/inflation index.
A 40-year career gives 57.25% of the personal base. Accrual bonuses apply for additional years (1.5% per year beyond 40);
early retirement before 65 with 40 years of contributions incurs a 0.3% monthly deduction.
Employee contribution: 15.5% of gross wage; employer: 8.85%. Total 24.35%.`,
    comparators: ['AT', 'CZ'],
    faqs: [
      { q: 'How is the Slovenian pension calculated?', a: 'Slovenian pension = pension base × accrual % × potential bonuses. The pension base is the average of the best 24 consecutive years of revalued earnings. After 40 contribution years, accrual is 57.25% of the base; each additional year adds 1.5%. Shorter careers give proportionally lower rates on a reduced base.' },
      { q: 'What is the retirement age in Slovenia?', a: 'Standard retirement is 65 with at least 15 years of insurance. Early retirement from 60 is possible with 40 years of paid insurance (no penalty). If exiting before 65 with fewer than 40 years, a 0.3% per month early retirement penalty applies.' },
      { q: 'How does Slovenia compare to Austria on pensions?', a: 'Austria (86.8% gross RR at average wage) is considerably more generous than Slovenia (56.1%). Both use work-history-based DB formulas, but Austria\'s Pensionskonto credits 1.78% annually applied across the full career, while Slovenia uses the best-24-year window with lower headline accrual. Austria\'s higher total SSC (22.8% vs Slovenia\'s 24.35% total) is comparable, but produces a more generous outcome because of the 1.78% annual growth and flat account approach.' },
    ],
  },
  {
    code: 'SK', name: 'Slovakia', slug: 'slovakia', flag: '🇸🇰',
    pensionAge: 69, rr: [85.7, 76.3, 68.2],
    systemType: 'Points-based PAYG (ADH system) + optional funded Pillar 2',
    systemDesc: `Slovakia uses a points-based PAYG system where the annual pension point value (aktuálna dôchodková hodnota, ADH)
is set by law each year (currently €16.90/point in 2026, increased annually). Workers earn pension points equal to the ratio of their
pensionable income to the economy-wide average wage. A 40-year career at average wage gives 40 points × €16.90 × 12 months
≈ €8,112/year gross pension. Slovakia also has a mandatory funded Pillar 2 (starobné dôchodkové sporenie) at 5.5% of gross wage.
The high gross replacement rate (76.3% at average wage) reflects a favourable formula relative to contributions.
Pension age is rising annually with no legislated cap; OECD models at 69. Employee contribution: 4% (+5.5% to Pillar 2); employer: 14% to Pillar 1.`,
    comparators: ['CZ', 'AT'],
    faqs: [
      { q: 'How does the Slovak pension system work?', a: 'Slovak pension = pension points × ADH (point value) × 12. You earn pension points each year equal to your salary ÷ economy average wage. At 40 years and average wage that\'s 40 points. Multiply by the ADH (€16.90 in 2026) to get annual pension. The ADH rises each year by wage growth, maintaining value in real terms.' },
      { q: 'Does Slovakia have a funded pension pillar?', a: 'Yes — Slovakia\'s Pillar 2 (starobné dôchodkové sporenie, DSS) directs 5.5% of gross wage to a privately managed pension fund. Workers above 35 can opt out. DSS funds invest in fixed income, mixed, or equity strategies. At retirement, the accumulated balance is converted to a pension annuity or drawn down. The OECD replacement rates shown reflect Pillar 1 mandatory public only.' },
      { q: 'Why is Slovakia\'s replacement rate higher than Czechia\'s?', a: 'Slovakia (76.3%) significantly outperforms Czechia (44.2%) at average wage. Key reason: Slovakia\'s ADH point system produces a more generous formula for average earners relative to contributions. Czechia\'s formula uses a progressive reduction on the assessment base, which reduces the proportional benefit for middle and upper earners. Both countries have similar total SSC rates.' },
    ],
  },
  {
    code: 'ES', name: 'Spain', slug: 'spain', flag: '🇪🇸',
    pensionAge: 67, rr: [80.1, 72.3, 50.6],
    systemType: 'Defined-benefit — earnings-related DB (pensión contributiva)',
    systemDesc: `Spain's contributory pension (pensión contributiva de jubilación) is calculated on the best 25 years of
contribution bases (bases de cotización), revalued by the CPI. The benefit rate rises with career length:
reaching 100% of the regulatory base (base reguladora) at 37 years of contributions (36.5 years from 2027 under the 2023 Escrivá reform).
A social security ceiling limits contribution bases at high earners (currently approximately €4,909/month in 2026),
which explains why replacement rates drop from 80.1% at 0.5× AW to 50.6% at 2× AW.
Employee SSC for pension: 4.7% of gross wage; employer: 23.6%.
The 2023 intergenerational equity mechanism (MEI) adds 0.6–1.25% SSC to fund future commitments.`,
    comparators: ['PT', 'FR'],
    faqs: [
      { q: 'How is the Spanish pension calculated?', a: 'Spanish pension = regulatory base × percentage. Regulatory base = average of best 25 years of contribution bases (CPI-revalued). Percentage: 50% at 15 years, rising by 0.19%/month to 25 years then 0.18%/month to 37 years, reaching 100%. Early retirement from 63 with 38.5+ years: penalty of 1.625–1.875% per quarter early.' },
      { q: 'What is Spain\'s retirement age?', a: 'Standard retirement age is 67 (since 2027 for all — being phased in from 65 since 2013). Early retirement from 63 is possible with 38.5 years of contributions (Jubilación ordinaria anticipada). Extended career workers with 38+ years can retire at 65. Women with labour market gaps may have career credit supplements under recent reforms.' },
      { q: 'How sustainable is Spain\'s pension system?', a: 'Spain\'s pension expenditure is approximately 12% of GDP and rising rapidly as the large baby-boom cohort (born 1957–1977) approaches retirement. The 2023 Escrivá reform raised the full-rate career from 35 to 37 years and introduced the intergenerational equity mechanism (MEI), a 0.6% additional levy to fund a long-term reserve buffer, rising to 1.25% if needed. Structural challenges remain given Spain\'s demographic trajectory.' },
    ],
  },
];

// ── EU ranking by replacement rate at 1.0× AW ──────────────────────────────
const RANKED = [...COUNTRIES].sort((a, b) => b.rr[1] - a.rr[1]);

// ── Template helpers ─────────────────────────────────────────────────────────

function rrRank(code: string): number {
  return RANKED.findIndex(c => c.code === code) + 1;
}

function comparatorRow(code: string): string {
  const c = COUNTRIES.find(x => x.code === code);
  if (!c) return '';
  return `
            <tr>
              <td style="padding:.4rem .6rem;border:1px solid #e2e8f0">${c.flag} ${c.name}</td>
              <td style="text-align:center;border:1px solid #e2e8f0">${c.pensionAge}</td>
              <td style="text-align:center;border:1px solid #e2e8f0">${c.rr[0]}%</td>
              <td style="text-align:center;border:1px solid #e2e8f0"><strong>${c.rr[1]}%</strong></td>
              <td style="text-align:center;border:1px solid #e2e8f0">${c.rr[2]}%</td>
            </tr>`;
}

function generatePage(c: CountryData): string {
  const canonicalUrl = `${BASE_URL}/${c.slug}/`;
  const appUrl = `${BASE_URL}/#c=${c.code}&wt=m&wv=1.0`;
  const title = `${c.name} Pension System 2026: ${c.rr[1]}% Replacement Rate | EU Comparison`;
  const description = `${c.name} statutory pension: ${c.rr[1]}% gross replacement rate at average wage (OECD 2023), retirement age ${c.pensionAge}. Compare to all 22 EU countries — free interactive tool.`;
  const rank = rrRank(c.code);
  const rankSuffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';

  const faqs = c.faqs.map(f => `
          <h3>${f.q}</h3>
          <p>${f.a}</p>`).join('');

  const comparatorRows = c.comparators
    .filter(code => COUNTRIES.some(x => x.code === code))
    .map(comparatorRow)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Primary meta -->
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${c.name} pension system, ${c.name} retirement age, ${c.name} pension replacement rate, European pension comparison, EU pension ${c.code}" />
    <meta name="author" content="zdenk" />
    <meta name="robots" content="index, follow" />

    <!-- Canonical -->
    <link rel="canonical" href="${canonicalUrl}" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${BASE_URL}/og-preview.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="EU27 Pension &amp; Tax Burden Explorer" />
    <meta property="og:locale" content="en_US" />

    <!-- Twitter / X card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${BASE_URL}/og-preview.png" />

    <!-- JSON-LD: WebPage -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "${title}",
      "description": "${description}",
      "url": "${canonicalUrl}",
      "dateModified": "${LAST_UPDATED}",
      "inLanguage": "en",
      "isPartOf": { "@type": "WebSite", "url": "${BASE_URL}/", "name": "EU27 Pension &amp; Tax Burden Explorer" },
      "author": { "@type": "Person", "name": "zdenk", "url": "https://github.com/zdenk" },
      "mainEntity": {
        "@type": "Dataset",
        "name": "${c.name} Statutory Pension &amp; Tax Parameters 2026",
        "description": "Statutory pension formula parameters, income tax brackets, SSC rates, and replacement rates for ${c.name}. Source: OECD Pensions at a Glance 2023, OECD Taxing Wages 2025, MISSOC.",
        "temporalCoverage": "2025/2026",
        "spatialCoverage": { "@type": "Country", "name": "${c.name}" },
        "isAccessibleForFree": true,
        "license": "https://opensource.org/licenses/MIT",
        "creator": { "@type": "Person", "name": "zdenk", "url": "https://github.com/zdenk" }
      }
    }
    </script>

    <!-- JSON-LD: FAQPage -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        ${c.faqs.map(f => `{
          "@type": "Question",
          "name": "${f.q.replace(/"/g, '\\"')}",
          "acceptedAnswer": { "@type": "Answer", "text": "${f.a.replace(/"/g, '\\"')}" }
        }`).join(',\n        ')}
      ]
    }
    </script>

    <!-- Redirect to SPA with country pre-selected -->
    <script>window.location.replace('${appUrl}');</script>
    <noscript>
      <meta http-equiv="refresh" content="0;url=${appUrl}" />
    </noscript>

    <link rel="icon" type="image/svg+xml" href="${BASE_URL}/favicon.svg" />
    <meta name="theme-color" content="#0f172a" />
  </head>
  <body style="font-family:sans-serif;max-width:780px;margin:2rem auto;padding:0 1.25rem;color:#1e293b;line-height:1.6">

    <p style="font-size:.9rem;color:#2563eb;margin-bottom:1rem">
      ← <a href="${appUrl}" style="color:#2563eb">Open the interactive comparison tool for ${c.name}</a>
         &nbsp;|&nbsp; <a href="${BASE_URL}/" style="color:#2563eb">Compare all 22 EU countries</a>
    </p>

    <h1 style="font-size:1.75rem;margin-bottom:.25rem">${c.flag} ${c.name} Pension System 2026</h1>
    <p style="margin:0 0 1.5rem;font-size:1.05rem;color:#334155">
      Gross replacement rate: <strong>${c.rr[1]}%</strong> at average wage &middot;
      Pension age: <strong>${c.pensionAge}</strong> &middot;
      Ranked <strong>${rank}${rankSuffix}</strong> of 22 EU OECD countries
    </p>

    <h2 style="margin-top:1.5rem">Key pension parameters — ${c.name}</h2>
    <table style="border-collapse:collapse;width:100%;font-size:.9rem;margin-bottom:1rem">
      <thead>
        <tr style="background:#0f172a;color:#f8fafc">
          <th style="text-align:left;padding:.45rem .6rem;border:1px solid #334155">Metric</th>
          <th style="text-align:center;padding:.45rem .6rem;border:1px solid #334155">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">System type</td><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">${c.systemType}</td></tr>
        <tr style="background:#f8fafc"><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">Normal pension age (OECD model)</td><td style="text-align:center;border:1px solid #e2e8f0">${c.pensionAge}</td></tr>
        <tr><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">Gross replacement rate at 0.5× avg wage</td><td style="text-align:center;border:1px solid #e2e8f0">${c.rr[0]}%</td></tr>
        <tr style="background:#f8fafc"><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">Gross replacement rate at 1.0× avg wage</td><td style="text-align:center;border:1px solid #e2e8f0"><strong>${c.rr[1]}%</strong></td></tr>
        <tr><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">Gross replacement rate at 2.0× avg wage</td><td style="text-align:center;border:1px solid #e2e8f0">${c.rr[2]}%</td></tr>
        <tr style="background:#f8fafc"><td style="padding:.4rem .6rem;border:1px solid #e2e8f0">EU rank (by RR at avg wage, 22 countries)</td><td style="text-align:center;border:1px solid #e2e8f0">${rank} / 22</td></tr>
      </tbody>
    </table>
    <p style="font-size:.8rem;color:#64748b">Source: OECD <em>Pensions at a Glance 2023</em>, mandatory public pension, gross replacement rates, men at normal pension age. For illustrative purposes only.</p>

    <h2 style="margin-top:2rem">How the ${c.name} pension system works</h2>
    ${c.systemDesc.split('\n').map(p => p.trim()).filter(Boolean).map(p => `<p>${p}</p>`).join('\n    ')}

    <h2 style="margin-top:2rem">How ${c.name} compares to other EU countries</h2>
    <table style="border-collapse:collapse;width:100%;font-size:.9rem;margin-bottom:.5rem">
      <thead>
        <tr style="background:#0f172a;color:#f8fafc">
          <th style="text-align:left;padding:.45rem .6rem;border:1px solid #334155">Country</th>
          <th style="text-align:center;padding:.45rem .6rem;border:1px solid #334155">Pension age</th>
          <th style="text-align:center;padding:.45rem .6rem;border:1px solid #334155">RR at 0.5× AW</th>
          <th style="text-align:center;padding:.45rem .6rem;border:1px solid #334155">RR at 1.0× AW</th>
          <th style="text-align:center;padding:.45rem .6rem;border:1px solid #334155">RR at 2.0× AW</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background:#eff6ff">
          <td style="padding:.4rem .6rem;border:1px solid #e2e8f0"><strong>${c.flag} ${c.name} (this page)</strong></td>
          <td style="text-align:center;border:1px solid #e2e8f0"><strong>${c.pensionAge}</strong></td>
          <td style="text-align:center;border:1px solid #e2e8f0"><strong>${c.rr[0]}%</strong></td>
          <td style="text-align:center;border:1px solid #e2e8f0"><strong>${c.rr[1]}%</strong></td>
          <td style="text-align:center;border:1px solid #e2e8f0"><strong>${c.rr[2]}%</strong></td>
        </tr>
        ${comparatorRows}
      </tbody>
    </table>
    <p style="font-size:.8rem;color:#64748b;margin-bottom:1rem">
      <a href="${BASE_URL}/" style="color:#2563eb">Compare all 22 EU countries side-by-side →</a>
    </p>

    <h2 style="margin-top:2rem">Frequently asked questions — ${c.name} pension</h2>
    ${faqs}

    <h2 style="margin-top:2rem">Explore interactively</h2>
    <p>The <a href="${appUrl}" style="color:#2563eb">EU27 Pension &amp; Tax Burden Explorer</a> lets you:
    <ul>
      <li>Compare ${c.name}'s pension against any other EU country side-by-side</li>
      <li>See net (after-tax) replacement rates, not just gross</li>
      <li>Adjust wage level, career length, and retirement age</li>
      <li>View SSC breakdown, income tax burden, and a full career timeline</li>
    </ul>
    All calculations run in your browser. Free, no login required.
    </p>

    <p style="margin-top:2rem;font-size:.8rem;color:#64748b;border-top:1px solid #e2e8f0;padding-top:1rem">
      Last updated: March 2026. Data sources: OECD Taxing Wages 2025, OECD Pensions at a Glance 2023, MISSOC, Eurostat, national social insurance authorities.
      Parameters not independently audited. For illustrative and educational purposes only. Not financial or actuarial advice.
      <a href="https://github.com/zdenk/PensionTaxExplorer" style="color:#2563eb">View source on GitHub</a>.
    </p>
  </body>
</html>`;
}

// ── Sitemap entry builder ─────────────────────────────────────────────────────
function buildSitemap(): string {
  const mainEntry = `  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${LAST_UPDATED}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`;

  const countryEntries = COUNTRIES.map(c => `  <url>
    <loc>${BASE_URL}/${c.slug}/</loc>
    <lastmod>${LAST_UPDATED}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mainEntry}
${countryEntries}
</urlset>
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  let generated = 0;

  for (const country of COUNTRIES) {
    const dir = path.join(PUBLIC_DIR, country.slug);
    fs.mkdirSync(dir, { recursive: true });
    const htmlPath = path.join(dir, 'index.html');
    fs.writeFileSync(htmlPath, generatePage(country), 'utf-8');
    console.log(`  ✓ ${country.flag}  public/${country.slug}/index.html`);
    generated++;
  }

  // Update sitemap
  const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, buildSitemap(), 'utf-8');
  console.log(`  ✓  public/sitemap.xml updated (${COUNTRIES.length + 1} URLs)`);

  console.log(`\nDone — generated ${generated} country pages.`);
}

main();
