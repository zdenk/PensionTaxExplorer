/**
 * OECD Gross Replacement Rate Lookup
 *
 * Source: OECD Pensions at a Glance 2023
 *         Table: "Individual earnings, multiple of mean for men (women where different)"
 *         Source note: "OECD pension models"
 *
 * Values: gross replacement rates (%) at 0.5×, 1.0×, 2.0× country mean earnings.
 * Career assumption: start age 22, retire at country's OECD reference pension age (men).
 *
 * For PL: OECD shows total including OFE opt-in, but since 2014 OFE is opt-in;
 *          comparison kept as full mandatory (ZUS NDC + OFE) per OECD table.
 *          pillar1OnlyForTotal removed — OECD figure here IS the total mandatory.
 *
 * Only countries modelled in this app are included.
 * Interpolation: piecewise linear between the three anchor points [0.5, 1.0, 2.0].
 * Outside the [0.5, 2.0] range: returns null (displayed as N/A).
 */

type Triple = [number, number, number]; // [0.5×, 1.0×, 2.0×]

interface OECDRREntry {
  pensionAge: number;          // OECD reference pension age (men)
  rr: Triple;                  // gross RR (%) at [0.5×, 1.0×, 2.0×] mean earnings
  /** When true, model comparison uses Pillar 1 only (not currently needed with PaG 2023 individual-earnings table) */
  pillar1OnlyForTotal?: boolean;
}

/**
 * OECD PaG 2023 — "Individual earnings, multiple of mean for men"
 * Covers all countries modelled in this app.
 */
export const OECD_RR_TABLE: Record<string, OECDRREntry> = {
  AT: { pensionAge: 65, rr: [84.8,  86.8,  62.4] },
  BE: { pensionAge: 67, rr: [80.9,  61.1,  42.5] },
  CZ: {
    pensionAge: 67,
    rr: [71.4, 44.2, 30.6],
    // Note: OECD PaG 2023 "Individual earnings" table shows 84.4/55.9/40.1 for CZ,
    // but those figures include voluntary pillar III contributions.
    // Mandatory-only schemes (OECD Full Table, mandatoryPublic column) give 71.4/44.2/30.6,
    // which better matches the Czech Republic's mandatory DB pillar modelled here.
  },
  DK: { pensionAge: 74, rr: [116.7, 77.1,  63.6] },
  EE: { pensionAge: 71, rr: [56.2,  37.8,  23.9] },
  FI: { pensionAge: 68, rr: [63.8,  65.7,  63.9] },
  FR: { pensionAge: 65, rr: [66.1,  70.0,  58.9] },
  DE: { pensionAge: 67, rr: [57.7,  53.3,  38.8] },
  GR: { pensionAge: 67, rr: [75.5,  53.7,  44.1] },
  // Note: OECD Greece gross RR reflects post-2016 EFKA reform (Law 4387/2016);
  // two-component: national flat pension (large relative share at 0.5×AW) + earnings-related.
  HU: { pensionAge: 65, rr: [76.9,  73.4,  73.4] },
  // Note: Hungarian gross RR is nearly flat across earnings levels — pure proportional DB.
  IE: { pensionAge: 66, rr: [56.5,  33.7,  20.1] },
  IT: { pensionAge: 71, rr: [91.1,  91.1,  91.1] },
  // Note: Italy NDC (sistema contributivo puro) is strictly proportional; all earnings multiples
  // give the same gross RR. OECD pension age = 71 (life-expectancy linkage; statutory age = 67).
  LV: { pensionAge: 65, rr: [64.5,  52.2,  51.4] },
  LT: { pensionAge: 65, rr: [36.9,  28.2,  21.0] },
  LU: { pensionAge: 62, rr: [97.2,  87.7,  79.4] },
  NL: { pensionAge: 70, rr: [97.2,  96.0,  89.7] },
  PL: { pensionAge: 65, rr: [40.9,  40.6,  37.2] },
  PT: { pensionAge: 67, rr: [79.4,  67.9,  62.0] },
  // Note: Portugal DB with sustainability factor suspended 2026; OECD PaG 2023 value includes factor.
  SE: { pensionAge: 70, rr: [67.4,  66.3,  84.4] },
  SI: { pensionAge: 65, rr: [57.4,  56.1,  47.0] },
  SK: { pensionAge: 69, rr: [85.7,  76.3,  68.2] },
  ES: { pensionAge: 67, rr: [80.1,  72.3,  50.6] },
  // Note: Spain DB — earnings below SS ceiling get full proportional accrual; 2×AW may partially
  // hit the contribution ceiling, reducing RR at upper earnings multiples.
};

/**
 * Look up the OECD gross replacement rate (%) for a given country and wage multiple.
 *
 * @param countryCode  ISO-2 code, e.g. "CZ", "DE"
 * @param wageMultiple AW multiple, e.g. 0.5, 1.0, 1.5, 2.0
 * @returns { rrPct, pensionAge, isP1Only } — or null if outside [0.5, 2.0] or data unavailable
 */
export function lookupOecdRR(
  countryCode: string,
  wageMultiple: number,
): { rrPct: number; pensionAge: number; isP1Only: boolean } | null {
  const entry = OECD_RR_TABLE[countryCode];
  if (!entry) return null;

  // Only defined in [0.5, 2.0]
  if (wageMultiple < 0.5 || wageMultiple > 2.0) return null;

  const [v05, v10, v20] = entry.rr;

  let rrPct: number;
  if (wageMultiple <= 1.0) {
    // Interpolate between 0.5× and 1.0×
    const t = (wageMultiple - 0.5) / 0.5;
    rrPct = v05 + t * (v10 - v05);
  } else {
    // Interpolate between 1.0× and 2.0×
    const t = (wageMultiple - 1.0) / 1.0;
    rrPct = v10 + t * (v20 - v10);
  }

  return {
    rrPct,
    pensionAge: entry.pensionAge,
    isP1Only: !!entry.pillar1OnlyForTotal,
  };
}

/** Returns the known exact OECD wage multiples [0.5, 1.0, 2.0] for tooltip display */
export const OECD_RR_MULTIPLES = [0.5, 1.0, 2.0] as const;

/** True if the given multiple is exactly one of the OECD tabulated points */
export function isExactOecdMultiple(m: number): boolean {
  return m === 0.5 || m === 1.0 || m === 2.0;
}
