// ═══════════════════════════════════════════════════════════════
// EUROMOD Diff Patch — FR — generated 2026-03-20
// Source: EUROMOD J2.0+ policy parameters Excel
//
// Review each block below, verify against the primary legislative source,
// then apply the proposed change manually to src/data/<country>.ts.
// ═══════════════════════════════════════════════════════════════

// ── Employee SSC → AGIRC-ARRCO Tranche 1 employee rate
//    emParam:      $tsceepi_rate3
//    EUROMOD (2025): 3.15%  %
//    App     (2026): 3.75%  %
//    Δ:            -16.0%
//    Note:         EUROMOD $tsceepi_rate3 = 3.15% (T1 employee). App uses AGIRC convention 3.75% (includes CET contributions). Check convention source.
//
//    → Proposed value: 3.15%
//      Replace:        3.75%
//
//    Verify at: [add primary source URL here]

// ── Employer SSC → AGIRC-ARRCO Tranche 1 employer rate
//    emParam:      $tscerpi_rate4
//    EUROMOD (2025): 4.72%  %
//    App     (2026): 5.65%  %
//    Δ:            -16.5%
//    Note:         EUROMOD $tscerpi_rate4 = 4.72% (T1 employer). App uses AGIRC convention 5.65% (includes CET+APEC). Check convention source.
//
//    → Proposed value: 4.72%
//      Replace:        5.65%
//
//    Verify at: [add primary source URL here]
