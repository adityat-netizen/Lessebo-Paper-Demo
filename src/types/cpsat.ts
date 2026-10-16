/**
 * Types for Google OR-Tools CP-SAT Optimizer Integration
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import type { StrategyResult } from './index';

export type SolverStatus =
  | 'OPTIMAL'
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'TIMED_OUT'
  | 'MODEL_INVALID'
  | 'OFFLINE_CACHE'
  | 'FALLBACK_HEURISTIC';

export interface CpsatSolverSettings {
  timeLimitSeconds: number; // default: 4.0s
  gapLimit: number;         // default: 0.005 (0.5%)
  randomSeed: number;       // default: 42
  numWorkers: number;       // default: 1 (deterministic)
  enforceHardDueDates: boolean; // default: false (soft with heavy penalty)
}

export const DEFAULT_CPSAT_SETTINGS: CpsatSolverSettings = {
  timeLimitSeconds: 4.0,
  gapLimit: 0.005,
  randomSeed: 42,
  numWorkers: 1,
  enforceHardDueDates: false,
};

export interface CpsatSolveTelemetry {
  status: SolverStatus;
  objectiveValueEur: number | null;
  bestLowerBoundEur: number | null;
  optimalityGapPct: number | null;
  solveTimeMs: number;
  runCount: number;
  arcCount: number;
  dueDateViolations: number | null;
  message: string;
  isPrecomputedCache?: boolean;
}

export interface CpsatStrategyResult extends StrategyResult {
  telemetry: CpsatSolveTelemetry;
  solverSettings: CpsatSolverSettings;
}

export type ActiveOptimizer = 'hybrid' | 'cpsat' | 'routing' | 'mip';

export interface AlgorithmOption {
  id: ActiveOptimizer;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  family: 'Heuristic' | 'Constraint Programming' | 'Local Search / Metaheuristic' | 'Mathematical Programming';
}

export const ALGORITHM_OPTIONS: AlgorithmOption[] = [
  {
    id: 'hybrid',
    name: 'Rule-Based Hybrid Sequencer',
    badge: 'Default (<2ms)',
    badgeColor: '#E2E8F0',
    description: 'Grammage-band partitioning, light-to-dark colour sorting within bands, and windowed 2-opt search. Instant, deterministic, and highly transparent.',
    family: 'Heuristic',
  },
  {
    id: 'cpsat',
    name: 'Google OR-Tools CP-SAT',
    badge: 'Proven Lower Bound',
    badgeColor: '#CCFBF1',
    description: 'Exact Asymmetric TSP formulation with circuit constraints, dual-bound branch-and-cut, and SLA penalty weighting.',
    family: 'Constraint Programming',
  },
  {
    id: 'routing',
    name: 'Google OR-Tools Routing Solver',
    badge: 'Guided Local Search',
    badgeColor: '#FEF3C7',
    description: 'Asymmetric vehicle routing formulation with open-path depot, soft due dates via time dimension, and guided local search heuristics.',
    family: 'Local Search / Metaheuristic',
  },
  {
    id: 'mip',
    name: 'Mixed-Integer Programming (MIP - SCIP)',
    badge: 'Dual Bound Branch & Cut',
    badgeColor: '#EDE9FE',
    description: 'Asymmetric TSP with Miller-Tucker-Zemlin flow constraints, completion time propagation, and branch-and-cut dual lower bound.',
    family: 'Mathematical Programming',
  },
];

export interface PrecomputedCpsatEntry {
  scenarioPreset: string;
  machineId: string;
  grammageDownPenaltyHours: number;
  status: SolverStatus;
  orderedOrderIds: string[];
  objectiveValueEur: number;
  bestLowerBoundEur: number;
  optimalityGapPct: number;
  solveTimeMs: number;
  runCount: number;
  arcCount: number;
  dueDateViolations: number;
  timestamp: string;
}

export interface PrecomputedCpsatRegistry {
  generatedAt: string;
  ortoolsVersion: string;
  entries: Record<string, PrecomputedCpsatEntry>;
}
