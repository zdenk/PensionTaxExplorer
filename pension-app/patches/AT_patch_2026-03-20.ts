// ═══════════════════════════════════════════════════════════════
// EUROMOD Diff Patch — AT — generated 2026-03-20
// Source: EUROMOD J2.0+ policy parameters Excel
//
// Review each block below, verify against the primary legislative source,
// then apply the proposed change manually to src/data/<country>.ts.
// ═══════════════════════════════════════════════════════════════

// ── Employee SSC → Accident (UV) employee rate
//    emParam:      $tsceeho_rate
//    EUROMOD (2025): 0.50%  %
//    App     (2026): 0.10%  %
//    Δ:            +400.0%
//    Note:         EUROMOD $tsceeho_rate = 0.5%. App has 0.1%. Note: employee UV in AT is a nominal flat levy; confirm current law.
//
//    → Proposed value: 0.50%
//      Replace:        0.10%
//
//    Verify at: [add primary source URL here]
