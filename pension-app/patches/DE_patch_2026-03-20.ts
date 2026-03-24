// ═══════════════════════════════════════════════════════════════
// EUROMOD Diff Patch — DE — generated 2026-03-20
// Source: EUROMOD J2.0+ policy parameters Excel
//
// Review each block below, verify against the primary legislative source,
// then apply the proposed change manually to src/data/<country>.ts.
// ═══════════════════════════════════════════════════════════════

// ── Income Tax → Reichensteuer (45%) start — monthly
//    emParam:      $tin_upthres4
//    EUROMOD (2025): 23 152  EUR/mo
//    App     (2026): 48 167  EUR/mo  ← CORRECTED to 23 152 on 2026-03-23
//    Δ:            -51.9%
//    Note:         EUROMOD: 277,825 EUR/year = 23,152 EUR/month. App had 48,167 EUR/month (×2 — data entry error).
//
//    ✅ APPLIED 2026-03-23:  brackets[3].upTo  48_167 → 23_152  in src/data/germany.ts
//
//    Source: EStG §32a Abs.1 Nr.5 (Jahressteuergesetz 2025)
