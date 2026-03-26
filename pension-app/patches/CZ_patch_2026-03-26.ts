// ════════════════════════════════════════════════════════════════════════════
// Legislative Patch — CZ — 2026-03-26
// Babišova novela: minimum OSVČ social insurance advance reduced retroactively
// from January 2026 (Sněmovna vote 25.3.2026; pending Senate + Presidential sign.)
//
// Source: Peníze.cz — Minimální zálohy na sociální pojištění se zpětně sníží
//   https://www.penize.cz/socialni-pojisteni/487450-minimalni-zalohy-na-socialni-
//   pojisteni-se-zpetne-snizi-spocitame-vam-kolik-muzete-dostat-zpatky
//
// Status: Passed Sněmovna (lower house) 2026-03-25. Requires Senate approval
//   + Presidential signature before taking legal effect. Retroactive to Jan 2026.
// ════════════════════════════════════════════════════════════════════════════

// ── OSVČ (Hlavní činnost) — minimum social insurance advance ───────────────
//
//   Parameter:    selfEmployment.modes[OSVČ].minSocialInsuranceBase
//   Old value:    Math.round(0.25 * AW_2026) = 12,242 CZK/month
//                 (original §5b(2) zákon č. 589/1992 Sb. rate — not yet updated
//                 in the app for the 2024–2026 Fiala reform increases)
//   2026 (Fiala): ~40% × AW = 19,589 CZK → advance 5,720 CZK/month
//   New value:    Math.round(5_005 / 0.292) = 17,140 CZK/month
//
//   Minimum monthly záloha:
//     Before (2026 Fiala):  5,720 CZK/month  (29.2% × ~40% AW)
//     After  (Babíš novela): 5,005 CZK/month  (29.2% × 35% AW approx)
//     Δ:  −715 CZK/month
//
//   ✅ APPLIED 2026-03-26: minSocialInsuranceBase updated in src/data/czechRepublic.ts
//      Math.round(0.25 * AW_2026) → Math.round(5_005 / 0.292)  [17,140 CZK]
//
//   Verify at: https://www.cssz.cz/web/portal-osvc (ČSSZ portal for OSVČ)
//              https://www.zakonyprolidi.cz/cs/1992-589#p5b (§5b zákon č. 589/1992 Sb.)

// ── Paušální daň — Pásmo 1: monthly social contribution ────────────────────
//
//   Parameter:    PD_BAND1_SOCIAL_BASE (constant used by selfEmployment.modes[PD Pásmo 1])
//   Old value:    22,527 CZK/month  → social contribution 6,578 CZK/month
//   New value:    Math.round(5_756 / 0.292) = 19,712 CZK/month → ≈5,756 CZK social
//
//   Derivation: PD Band 1 social = 115% × OSVČ minimum advance
//     = 1.15 × 5,005 CZK = 5,755.75 CZK → rounded up = 5,756 CZK
//     Assessment base: Math.round(5,756 / 0.292) = 19,712 CZK
//
//   Monthly PD Band 1 total:
//     Before (Fiala):   9,984 CZK/month  (100 daň + 6,578 soc + 3,306 zdrav)
//     After  (Babíš):   9,162 CZK/month  (100 daň + 5,756 soc + 3,306 zdrav)
//     Δ:  −822 CZK/month
//
//   Health component (3,306 CZK) and tax advance (100 CZK) are unchanged.
//
//   ✅ APPLIED 2026-03-26: PD_BAND1_SOCIAL_BASE updated in src/data/czechRepublic.ts
//      22_527 → Math.round(5_756 / 0.292)  [= 19,712 CZK]
//
//   Verify at: https://www.cssz.cz/osvc-v-pausalnim-rezimu
//              https://financnisprava.gov.cz (Finanční správa — paušální daň)

// ── Paušální daň — Pásmo 2 — NOT affected ──────────────────────────────────
//   PD_BAND2_SOCIAL_BASE (28,050 CZK → 8,191 CZK social) is unchanged.
//   The novela only covers Pásmo 1 and the standard OSVČ minimum advance.
