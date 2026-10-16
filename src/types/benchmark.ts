/**
 * Types for Sequence Optimization Benchmark Suite & Campaign Generator
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import type { CampaignOrder, SequencingStrategyId } from './index';
import type { SolverStatus } from './cpsat';

export type BenchmarkStructure =
  | 'standard'
  | 'conflict'
  | 'heavy_grammage'
  | 'high_shade_diversity';

export interface BenchmarkInstance {
  instanceId: string;
  name: string;
  runCount: number;
  structure: BenchmarkStructure;
  structureLabel: string;
  description: string;
  seed: number;
  orders: CampaignOrder[];
}

export interface MethodBenchmarkResult {
  strategyId: SequencingStrategyId;
  strategyName: string;
  totalChangeoverCostEur: number;
  totalCostEur: number;
  totalChangeoverHours: number;
  totalBrokeTonnes: number;
  washoutCount: number;
  grammageReversalsCount: number;
  slaCompliancePct: number;
  slaViolationsCount: number;
  solveTimeMs: number;
  bestLowerBoundEur: number | null;
  optimalityGapPct: number | null;
  solverStatus?: SolverStatus;
}

export interface InstanceBenchmarkRow {
  instanceId: string;
  name: string;
  runCount: number;
  structure: BenchmarkStructure;
  structureLabel: string;
  naive: MethodBenchmarkResult;
  colorFirst: MethodBenchmarkResult;
  grammageFirst: MethodBenchmarkResult;
  hybrid: MethodBenchmarkResult;
  cpsat: MethodBenchmarkResult;
  winningStrategyId: SequencingStrategyId;
  winningStrategyName: string;
  cpsatVsNaiveSavingsEur: number;
  cpsatVsNaiveSavingsPct: number;
  cpsatVsHybridSavingsEur: number;
  cpsatVsHybridSavingsPct: number;
  provenOptimal: boolean;
}

export interface BenchmarkScalingSummary {
  totalInstances: number;
  cpsatWinsCount: number;
  hybridWinsCount: number;
  tiesCount: number;
  heuristicWinsCount: number;
  avgCpsatVsNaiveSavingsPct: number;
  avgCpsatVsHybridSavingsPct: number;
  avgHybridVsNaiveSavingsPct: number;
  avgCpsatSolveTimeMs: number;
  avgHybridSolveTimeMs: number;
  avgOptimalityGapPct: number;
  worstCaseOptimalityGapPct: number;
  provenOptimalCount: number;
  optimalRunThreshold: number; // Max size where 100% of instances proved 0% gap within time limit
  totalChangeoverHoursSavedByCpsat: number;
  totalBrokeTonnesAvoidedByCpsat: number;
}

export interface BenchmarkSuiteData {
  generatedAt: string;
  ortoolsVersion: string;
  costFunctionDisclaimer: string;
  summary: BenchmarkScalingSummary;
  instances: InstanceBenchmarkRow[];
}
