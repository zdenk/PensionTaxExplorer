/**
 * Engine barrel — single import point for all calculation engines and result types.
 *
 * Result type interfaces live in types.ts (no circular dependency).
 * This barrel re-exports them alongside the engine objects for convenience.
 */

// ─── Engine objects ───────────────────────────────────────────────────────────
export { TaxEngine } from './TaxEngine';
export { SSCEngine } from './SSCEngine';
export { PensionEngine } from './PensionEngine';
export { TimelineBuilder } from './TimelineBuilder';
export { FairReturnEngine } from './FairReturnEngine';

// ─── Result types (sourced from types.ts — no cycle) ─────────────────────────
export type {
  BracketBreakdown,
  TaxResult,
  SSCComponentResult,
  SSCResult,
  PensionResult,
  YearlySnapshot,
  FairReturnResult,
  ScenarioResult,
} from '../types';
