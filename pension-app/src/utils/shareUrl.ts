/**
 * shareUrl.ts — encode / decode app state as a URL hash fragment
 *
 * Format: #c=DE,FR&wt=m&wv=1.0&aws=model&rrs=model&rr=0.03&cur=local&cs=25&ra=65&rd=25&sem=<base64>
 *
 * Only non-default values are written to keep URLs short.
 * The hash is used (not query string) so GitHub Pages never needs server routing.
 */

import type { AppState, WageMode } from '../types';
import { INITIAL_STATE } from '../state/appReducer';

// ─── Wage type short codes ────────────────────────────────────────────────────
const WAGE_TYPE_ENC: Record<WageMode['type'], string> = {
  multiplier:               'm',
  fixed_gross_eur:          'fg',
  fixed_employer_cost_eur:  'fe',
};
const WAGE_TYPE_DEC: Record<string, WageMode['type']> = Object.fromEntries(
  Object.entries(WAGE_TYPE_ENC).map(([k, v]) => [v, k as WageMode['type']])
);

function encodeWage(mode: WageMode): URLSearchParams {
  const p = new URLSearchParams();
  p.set('wt', WAGE_TYPE_ENC[mode.type]);
  if ('value' in mode) p.set('wv', String(mode.value));
  return p;
}

function decodeWage(p: URLSearchParams): WageMode | null {
  const wt = p.get('wt');
  if (!wt || !WAGE_TYPE_DEC[wt]) return null;
  const type = WAGE_TYPE_DEC[wt];
  if (type === 'multiplier' || type === 'fixed_gross_eur' || type === 'fixed_employer_cost_eur') {
    const value = parseFloat(p.get('wv') ?? '');
    if (!isFinite(value) || value <= 0) return null;
    return { type, value } as WageMode;
  }
  return null;
}

// ─── Self-employment modes (base64url JSON) ───────────────────────────────────
function encodeSem(sem: AppState['selfEmploymentModes']): string | null {
  if (!sem || Object.keys(sem).length === 0) return null;
  try {
    return btoa(JSON.stringify(sem)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch {
    return null;
  }
}

function decodeSem(s: string): AppState['selfEmploymentModes'] | null {
  try {
    const padded = s + '=='.slice((s.length * 3) % 4 === 0 ? 0 : 4 - ((s.length * 3) % 4));
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

// ─── Encode state → hash string ──────────────────────────────────────────────
export function encodeStateToHash(state: AppState): string {
  const p = new URLSearchParams();

  // Countries (always emit)
  if (state.selectedCountries.length > 0) {
    p.set('c', state.selectedCountries.join(','));
  }

  // Wage mode
  const wageParts = encodeWage(state.wageMode);
  wageParts.forEach((v, k) => p.set(k, v));

  // awSource (omit if default 'model')
  if (state.awSource !== INITIAL_STATE.awSource) p.set('aws', state.awSource);

  // rrSource (omit if default 'model')
  if (state.rrSource !== INITIAL_STATE.rrSource) p.set('rrs', state.rrSource);

  // fairReturnRate (omit if default 0.03)
  if (Math.abs(state.fairReturnRate - INITIAL_STATE.fairReturnRate) > 0.0001) {
    p.set('rr', state.fairReturnRate.toFixed(4));
  }

  // Currency (omit if default 'local')
  if (state.currency !== INITIAL_STATE.currency) p.set('cur', state.currency);

  // Career overrides (only emit changed fields)
  const co = state.careerOverrides;
  if (co.careerStartAge != null) p.set('cs', String(co.careerStartAge));
  if (co.retirementAge != null)  p.set('ra', String(co.retirementAge));
  if (co.retirementDuration != null) p.set('rd', String(co.retirementDuration));

  // Self-employment modes (omit if empty)
  const sem = encodeSem(state.selfEmploymentModes);
  if (sem) p.set('sem', sem);

  return p.toString();
}

// ─── Partial state decoded from hash ─────────────────────────────────────────
export interface DecodedHashState {
  selectedCountries?: string[];
  wageMode?: WageMode;
  awSource?: 'model' | 'oecd';
  rrSource?: 'model' | 'oecd';
  fairReturnRate?: number;
  currency?: 'EUR' | 'local';
  careerOverrides?: AppState['careerOverrides'];
  selfEmploymentModes?: AppState['selfEmploymentModes'];
}

export function decodeHashToState(hash: string): DecodedHashState {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return {};
  const p = new URLSearchParams(raw);
  const result: DecodedHashState = {};

  // Countries
  const c = p.get('c');
  if (c) {
    result.selectedCountries = c
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 3);
  }

  // Wage mode
  const wage = decodeWage(p);
  if (wage) result.wageMode = wage;

  // awSource
  const aws = p.get('aws');
  if (aws === 'model' || aws === 'oecd') result.awSource = aws;

  // rrSource
  const rrs = p.get('rrs');
  if (rrs === 'model' || rrs === 'oecd') result.rrSource = rrs;

  // fairReturnRate
  const rr = parseFloat(p.get('rr') ?? '');
  if (isFinite(rr) && rr >= 0.01 && rr <= 0.03) result.fairReturnRate = rr;

  // Currency
  const cur = p.get('cur');
  if (cur === 'EUR' || cur === 'local') result.currency = cur;

  // Career overrides
  const co: AppState['careerOverrides'] = {};
  const cs = parseInt(p.get('cs') ?? '', 10);
  if (isFinite(cs) && cs >= 18 && cs <= 45) co.careerStartAge = cs;
  const ra = parseInt(p.get('ra') ?? '', 10);
  if (isFinite(ra) && ra >= 50 && ra <= 75) co.retirementAge = ra;
  const rd = parseInt(p.get('rd') ?? '', 10);
  if (isFinite(rd) && rd >= 5 && rd <= 40) co.retirementDuration = rd;
  if (Object.keys(co).length > 0) result.careerOverrides = co;

  // Self-employment modes
  const sem = p.get('sem');
  if (sem) {
    const decoded = decodeSem(sem);
    if (decoded) result.selfEmploymentModes = decoded;
  }

  return result;
}

// ─── Build a shareable URL from current state ─────────────────────────────────
export function buildShareUrl(state: AppState): string {
  const hash = encodeStateToHash(state);
  const base = `${window.location.origin}${window.location.pathname}`;
  return hash ? `${base}#${hash}` : base;
}
