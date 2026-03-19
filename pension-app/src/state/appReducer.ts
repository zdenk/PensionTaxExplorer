/**
 * App state — useReducer actions and initial state
 */

import type { AppState, WageMode, CareerDefaults } from '../types';

export type AppAction =
  | { type: 'SET_COUNTRIES'; codes: string[] }
  | { type: 'ADD_COUNTRY'; code: string }
  | { type: 'REMOVE_COUNTRY'; code: string }
  | { type: 'SET_WAGE_MODE'; mode: WageMode }
  | { type: 'SET_AW_SOURCE'; source: 'model' | 'oecd' }
  | { type: 'SET_RR_SOURCE'; source: 'model' | 'oecd' }
  | { type: 'SET_CURRENCY'; currency: 'EUR' | 'local' }
  | { type: 'SET_CAREER_OVERRIDE'; key: keyof CareerDefaults; value: number }
  | { type: 'RESET_CAREER_OVERRIDES' }
  | { type: 'SET_ACTIVE_SIDEBAR_COUNTRY'; code: string }
  | { type: 'TOGGLE_SIDEBAR' }
  /**
   * Toggle a self-employment mode on/off for a country.
   * - If modeName is already active for the country it is removed.
   *   If it was the last active mode, the country reverts to [null] (employee).
   * - If not active, it is added only if total card count across all countries < MAX_CARDS.
   * modeName = null means standard employee mode.
   */
  | { type: 'SET_SELF_EMPLOYMENT_MODE'; countryCode: string; modeName: string | null };

/** Maximum simultaneous (country × mode) card columns. */
export const MAX_CARDS = 3;

/** Count total active card columns across all selected countries. */
export function totalActiveCards(state: Pick<AppState, 'selectedCountries' | 'selfEmploymentModes'>): number {
  return state.selectedCountries.reduce(
    (sum, code) => sum + (state.selfEmploymentModes[code]?.length ?? 1),
    0
  );
}

export const INITIAL_STATE: AppState = {
  selectedCountries: ['CZ'],
  wageMode: { type: 'multiplier', value: 1.0 },
  awSource: 'model',
  rrSource: 'model',
  currency: 'local',
  careerOverrides: {},
  activeFormulaSidebarCountry: 'CZ',
  sidebarOpen: false,
  selfEmploymentModes: {},        // all countries start in standard employee mode
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_COUNTRIES':
      return {
        ...state,
        selectedCountries: action.codes.slice(0, 3),
        currency: needsEurLock(action.codes) ? 'EUR' : state.currency,
      };

    case 'ADD_COUNTRY': {
      if (state.selectedCountries.includes(action.code)) return state;
      // Block add when the total card count is already at max
      // (adding a country always adds at least 1 card for its default employee mode)
      if (totalActiveCards(state) >= MAX_CARDS) return state;
      const updated = [...state.selectedCountries, action.code];
      return {
        ...state,
        selectedCountries: updated,
        currency: needsEurLock(updated) ? 'EUR' : state.currency,
      };
    }

    case 'REMOVE_COUNTRY': {
      const updated = state.selectedCountries.filter(c => c !== action.code);
      // Also sweep out this country's mode entries so they don't consume card slots later
      const { [action.code]: _removed, ...remainingModes } = state.selfEmploymentModes;
      return {
        ...state,
        selectedCountries: updated,
        selfEmploymentModes: remainingModes,
        activeFormulaSidebarCountry:
          state.activeFormulaSidebarCountry === action.code
            ? (updated[0] ?? '')
            : state.activeFormulaSidebarCountry,
      };
    }

    case 'SET_WAGE_MODE':
      return { ...state, wageMode: action.mode };

    case 'SET_AW_SOURCE':
      return { ...state, awSource: action.source };

    case 'SET_RR_SOURCE':
      return { ...state, rrSource: action.source };

    case 'SET_CURRENCY':
      // Enforce EUR-only when multiple non-EUR currencies are selected
      if (action.currency === 'local' && needsEurLock(state.selectedCountries)) {
        return state;
      }
      return { ...state, currency: action.currency };

    case 'SET_CAREER_OVERRIDE':
      return {
        ...state,
        careerOverrides: { ...state.careerOverrides, [action.key]: action.value },
      };

    case 'RESET_CAREER_OVERRIDES':
      return { ...state, careerOverrides: {} };

    case 'SET_ACTIVE_SIDEBAR_COUNTRY':
      return { ...state, activeFormulaSidebarCountry: action.code, sidebarOpen: true };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'SET_SELF_EMPLOYMENT_MODE': {
      const { countryCode, modeName } = action;
      const current: (string | null)[] = state.selfEmploymentModes[countryCode] ?? [null];
      const isActive = current.includes(modeName);

      if (isActive) {
        // Remove: keep at least [null] (employee) as fallback
        const next = current.filter(m => m !== modeName);
        return {
          ...state,
          selfEmploymentModes: {
            ...state.selfEmploymentModes,
            [countryCode]: next.length > 0 ? next : [null],
          },
        };
      } else {
        // Add only when total card count is below cap
        const total = totalActiveCards(state);
        if (total >= MAX_CARDS) return state;
        return {
          ...state,
          selfEmploymentModes: {
            ...state.selfEmploymentModes,
            [countryCode]: [...current, modeName],
          },
        };
      }
    }

    default:
      return state;
  }
}

/**
 * Returns true when the current selection contains 2+ different non-EUR currencies,
 * which means the currency toggle must be locked to EUR.
 */
export function needsEurLock(codes: string[]): boolean {
  // Non-EUR currencies in OECD-22 scope: CZK, PLN, HUF, SEK, DKK
  const NON_EUR: Record<string, string> = {
    CZ: 'CZK', PL: 'PLN', HU: 'HUF', SE: 'SEK', DK: 'DKK',
  };
  const nonEurCurrencies = new Set(
    codes.filter(c => c in NON_EUR).map(c => NON_EUR[c])
  );
  // Lock if multiple different non-EUR currencies, or mixing EUR + non-EUR
  const hasEurCountry = codes.some(c => !(c in NON_EUR));
  const hasNonEur = nonEurCurrencies.size > 0;
  return (hasNonEur && hasEurCountry) || nonEurCurrencies.size > 1;
}
