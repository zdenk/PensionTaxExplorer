/**
 * Country Registry — all 22 OECD EU member states
 *
 * Tier 1 (full data): CZ, DE, AT, SK, PL ✅
 * Tier 2 (full data): FR, BE, NL, IE, LU ✅
 * Tier 3 (full data): SE, FI, DK, EE, LV, LT ✅
 * Tier 4 (full data): IT, ES, PT, GR, HU, SI ✅  ← all 22 OECD EU countries complete
 */

import type { CountryConfig } from '../types';
import { czechRepublic } from './czechRepublic';
import { germany } from './germany';
import { austria } from './austria';
import { slovakia } from './slovakia';
import { poland } from './poland';
import { france } from './france';
import { belgium } from './belgium';
import { netherlands } from './netherlands';
import { ireland } from './ireland';
import { luxembourg } from './luxembourg';
import { sweden } from './sweden';
import { finland } from './finland';
import { denmark } from './denmark';
import { estonia } from './estonia';
import { latvia } from './latvia';
import { lithuania } from './lithuania';
import { italy } from './italy';
import { spain } from './spain';
import { portugal } from './portugal';
import { greece } from './greece';
import { hungary } from './hungary';
import { slovenia } from './slovenia';

/** Ordered list — Tier 1 first, then alphabetical within tiers */
export const ALL_COUNTRIES: CountryConfig[] = [
  // Tier 1
  czechRepublic,
  germany,
  austria,
  slovakia,
  poland,
  // Tier 2
  france,
  belgium,
  netherlands,
  ireland,
  luxembourg,
  // Tier 3
  sweden,
  finland,
  denmark,
  estonia,
  latvia,
  lithuania,
  // Tier 4
  italy,
  spain,
  portugal,
  greece,
  hungary,
  slovenia,
];

/** Fast lookup map: country code → CountryConfig */
export const COUNTRY_MAP: Record<string, CountryConfig> = Object.fromEntries(
  ALL_COUNTRIES.map(c => [c.code, c])
);

/** Flags (Unicode regional indicator sequences) */
export const FLAG: Record<string, string> = {
  AT: '🇦🇹', BE: '🇧🇪', CZ: '🇨🇿', DE: '🇩🇪', DK: '🇩🇰',
  EE: '🇪🇪', ES: '🇪🇸', FI: '🇫🇮', FR: '🇫🇷', GR: '🇬🇷',
  HU: '🇭🇺', IE: '🇮🇪', IT: '🇮🇹', LT: '🇱🇹', LU: '🇱🇺',
  LV: '🇱🇻', NL: '🇳🇱', PL: '🇵🇱', PT: '🇵🇹', SE: '🇸🇪',
  SI: '🇸🇮', SK: '🇸🇰',
};

/** Tier labels for UI display */
export const TIER: Record<string, string> = {
  CZ: 'Tier 1', DE: 'Tier 1', AT: 'Tier 1', SK: 'Tier 1', PL: 'Tier 1',
  FR: 'Tier 2', BE: 'Tier 2', NL: 'Tier 2', IE: 'Tier 2', LU: 'Tier 2',
  SE: 'Tier 3', FI: 'Tier 3', DK: 'Tier 3', EE: 'Tier 3', LV: 'Tier 3', LT: 'Tier 3',
  IT: 'Tier 4', ES: 'Tier 4', PT: 'Tier 4', GR: 'Tier 4', HU: 'Tier 4', SI: 'Tier 4',
};
