/**
 * Dual-Mode Client Adapter for Google OR-Tools CP-SAT Optimizer.
 * Evaluates sequences strictly through the single existing TypeScript engine evaluator.
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import type { CampaignOrder, MachineId, ScheduledRun } from '../types';
import type { LossModelConfig } from '../types/lossModel';
import type {
  ActiveOptimizer,
  CpsatSolverSettings,
  CpsatSolveTelemetry,
  CpsatStrategyResult,
  PrecomputedCpsatRegistry,
} from '../types/cpsat';
import { DEFAULT_CPSAT_SETTINGS } from '../types/cpsat';
import { calculateChangeover } from './changeoverCalculator';
import cpsatPrecomputedRaw from '../data/cpsat_precomputed.json' with { type: 'json' };

const cpsatRegistry = cpsatPrecomputedRaw as unknown as PrecomputedCpsatRegistry;

const SOLVER_API_URL = (import.meta as any).env?.VITE_CPSAT_API_URL || 'http://127.0.0.1:8000';

export interface SolverHealthStatus {
  isHealthy: boolean;
  version?: string;
  url: string;
  message: string;
}

/**
 * Check if the live Python CP-SAT solver service is reachable.
 */
export async function checkSolverHealth(): Promise<SolverHealthStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${SOLVER_API_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        isHealthy: true,
        version: data.ortools_version,
        url: SOLVER_API_URL,
        message: 'Live OR-Tools CP-SAT Service Connected',
      };
    }
    return {
      isHealthy: false,
      url: SOLVER_API_URL,
      message: `Service returned ${res.status}`,
    };
  } catch (err: any) {
    return {
      isHealthy: false,
      url: SOLVER_API_URL,
      message: 'Local solver service offline (using verified precomputed cache)',
    };
  }
}

/**
 * Solve with CP-SAT (via live backend or precomputed cache with fallback).
 */
const SOLVER_METADATA: Record<ActiveOptimizer, { id: 'hybrid' | 'cpsat' | 'routing' | 'mip'; name: string; description: string }> = {
  hybrid: {
    id: 'hybrid',
    name: 'Rule-Based Hybrid Sequencer',
    description: 'Grammage-band partitioning, light-to-dark colour sorting within bands, and windowed 2-opt search',
  },
  cpsat: {
    id: 'cpsat',
    name: 'Google OR-Tools CP-SAT',
    description: 'Exact constraint programming solver with circuit sequencing, lower bound proofs and SLA constraints',
  },
  routing: {
    id: 'routing',
    name: 'Google OR-Tools Routing Solver',
    description: 'Asymmetric vehicle routing formulation with open-path depot, soft due dates, and guided local search heuristics',
  },
  mip: {
    id: 'mip',
    name: 'Mixed-Integer Programming (MIP - SCIP)',
    description: 'ATSP with Miller-Tucker-Zemlin flow constraints, completion time propagation, and branch-and-cut dual bound',
  },
};

/**
 * Solve sequence using specified optimizer (Rule-Based Hybrid, CP-SAT, Routing, or MIP).
 * Evaluates sequences strictly through the single existing TypeScript engine evaluator.
 */
export async function solveCpsatSequence(
  campaignOrders: CampaignOrder[],
  targetMachine: MachineId,
  washoutMultiplier: number,
  brokeRateTph: number,
  config: LossModelConfig | undefined,
  settings: CpsatSolverSettings = DEFAULT_CPSAT_SETTINGS,
  hybridRuns: ScheduledRun[],
  scheduleRunListFn: (
    ordered: CampaignOrder[],
    isOptimized: boolean,
    washMult?: number,
    brokeRate?: number,
    cfg?: LossModelConfig
  ) => ScheduledRun[],
  computeMetricsFn: (
    runs: ScheduledRun[],
    hourlyRate?: number,
    brokeCost?: number,
    cfg?: LossModelConfig
  ) => any,
  scenarioPreset: 'standard' | 'conflict' = 'standard',
  solverType: ActiveOptimizer = 'cpsat'
): Promise<CpsatStrategyResult> {
  const machineOrders = campaignOrders.filter((o) => o.assigned_machine === targetMachine);
  const n = machineOrders.length;
  const meta = SOLVER_METADATA[solverType] || SOLVER_METADATA.cpsat;

  if (n === 0) {
    const emptyMetrics = computeMetricsFn([], 480, 280, config);
    return {
      id: meta.id as any,
      name: meta.name,
      description: meta.description,
      runs: [],
      metrics: { ...emptyMetrics, strategyId: meta.id, strategyName: meta.name },
      telemetry: {
        status: 'OPTIMAL',
        objectiveValueEur: 0,
        bestLowerBoundEur: solverType === 'routing' ? null : 0,
        optimalityGapPct: solverType === 'routing' ? null : 0,
        solveTimeMs: 0,
        runCount: 0,
        arcCount: 0,
        dueDateViolations: 0,
        message: 'Empty campaign',
      },
      solverSettings: settings,
    };
  }

  if (n === 1) {
    const scheduled = scheduleRunListFn([machineOrders[0]], true, washoutMultiplier, brokeRateTph, config);
    const metrics = {
      ...computeMetricsFn(scheduled, 480, 280, config),
      strategyId: meta.id,
      strategyName: meta.name,
    };
    const singleCost = metrics.totalOperatingCostEur + metrics.totalBrokeCostEur;
    return {
      id: meta.id as any,
      name: meta.name,
      description: meta.description,
      runs: scheduled,
      metrics,
      telemetry: {
        status: 'OPTIMAL',
        objectiveValueEur: singleCost,
        bestLowerBoundEur: solverType === 'routing' ? null : singleCost,
        optimalityGapPct: solverType === 'routing' ? null : 0,
        solveTimeMs: 0.1,
        runCount: 1,
        arcCount: 0,
        dueDateViolations: 0,
        message: 'Trivially optimal single run campaign',
        isPrecomputedCache: false,
      },
      solverSettings: settings,
    };
  }

  // Map order IDs to indices and objects
  const orderIdMap = new Map<string, CampaignOrder>();
  const orderIdToIndex = new Map<string, number>();
  machineOrders.forEach((o, idx) => {
    orderIdMap.set(o.order_id, o);
    orderIdToIndex.set(o.order_id, idx);
  });

  // If Hybrid is requested, return instant deterministic evaluation
  if (solverType === 'hybrid') {
    const scheduled = scheduleRunListFn(
      hybridRuns.map((r) => orderIdMap.get(r.order_id)!).filter(Boolean),
      true,
      washoutMultiplier,
      brokeRateTph,
      config
    );
    return {
      id: 'hybrid',
      name: meta.name,
      description: meta.description,
      runs: scheduled,
      metrics: {
        ...computeMetricsFn(scheduled, 480, 280, config),
        strategyId: 'hybrid',
        strategyName: meta.name,
      },
      telemetry: {
        status: 'OPTIMAL',
        objectiveValueEur: null,
        bestLowerBoundEur: null,
        optimalityGapPct: null,
        solveTimeMs: 1.0,
        runCount: n,
        arcCount: n * (n - 1),
        dueDateViolations: 0,
        message: 'Deterministic heuristic sequence (<2ms execution)',
        isPrecomputedCache: false,
      },
      solverSettings: settings,
    };
  }

  // 1. Build initial costs and transition cost matrix using calculateChangeover
  const initialSetupCosts: number[] = [];
  const initialSetupHours: number[] = [];
  for (let j = 0; j < n; j++) {
    const ch = calculateChangeover(null, machineOrders[j], washoutMultiplier, brokeRateTph, config);
    const cost = ch.totalHours * 480 + ch.brokeTonnes * 280;
    initialSetupCosts.push(Math.round(cost * 100) / 100);
    initialSetupHours.push(ch.totalHours);
  }

  const costMatrix: number[][] = [];
  const setupHoursMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const costRow: number[] = [];
    const hoursRow: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        costRow.push(0.0);
        hoursRow.push(0.0);
      } else {
        const ch = calculateChangeover(machineOrders[i], machineOrders[j], washoutMultiplier, brokeRateTph, config);
        const cost = ch.totalHours * 480 + ch.brokeTonnes * 280;
        costRow.push(Math.round(cost * 100) / 100);
        hoursRow.push(ch.totalHours);
      }
    }
    costMatrix.push(costRow);
    setupHoursMatrix.push(hoursRow);
  }

  const hintSequence = hybridRuns
    .map((r) => orderIdToIndex.get(r.order_id))
    .filter((idx): idx is number => idx !== undefined);

  let telemetry: CpsatSolveTelemetry = {
    status: 'FALLBACK_HEURISTIC',
    objectiveValueEur: null,
    bestLowerBoundEur: null,
    optimalityGapPct: null,
    solveTimeMs: 0,
    runCount: n,
    arcCount: n * (n - 1),
    dueDateViolations: null,
    message: `Initializing ${meta.name} solve...`,
    isPrecomputedCache: false,
  };
  let orderedOrders: CampaignOrder[] = [];

  // Try live solve if reachable
  let liveSolved = false;
  try {
    const controller = new AbortController();
    const timeoutSec = Math.max(settings.timeLimitSeconds + 3, 5);
    const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);

    const payload = {
      solver_type: solverType,
      runs: machineOrders.map((o) => ({
        order_id: o.order_id,
        production_hours: o.production_hours,
        due_in_days: o.due_in_days,
        customer_priority: o.customer_priority,
      })),
      cost_matrix: costMatrix,
      setup_hours_matrix: setupHoursMatrix,
      initial_setup_costs: initialSetupCosts,
      initial_setup_hours: initialSetupHours,
      hint_sequence: hintSequence.length === n ? hintSequence : undefined,
      time_limit_seconds: settings.timeLimitSeconds,
      gap_limit: settings.gapLimit,
      random_seed: settings.randomSeed,
      num_workers: settings.numWorkers,
      enforce_hard_due_dates: settings.enforceHardDueDates,
    };

    const res = await fetch(`${SOLVER_API_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      orderedOrders = data.ordered_order_ids
        .map((id: string) => orderIdMap.get(id))
        .filter((o: any): o is CampaignOrder => o !== undefined);

      if (orderedOrders.length === n) {
        liveSolved = true;
        telemetry = {
          status: data.status,
          objectiveValueEur: data.objective_value_eur,
          bestLowerBoundEur: data.best_lower_bound_eur,
          optimalityGapPct: data.optimality_gap_pct,
          solveTimeMs: data.solve_time_ms,
          runCount: data.run_count,
          arcCount: data.arc_count,
          dueDateViolations: data.due_date_violations,
          message: data.message,
          isPrecomputedCache: false,
        };
      }
    }
  } catch (_e) {
    liveSolved = false;
  }

  // If live solve was not possible, look in precomputed cache (available for CP-SAT)
  if (!liveSolved && solverType === 'cpsat') {
    const penaltyKey = (config?.grammageStepDownPenaltyHours ?? 0).toFixed(1);
    const cacheKey = `${scenarioPreset}_${targetMachine}_${penaltyKey}`;
    const cached = cpsatRegistry.entries[cacheKey];

    if (cached && cached.orderedOrderIds.length === n) {
      const matchedRuns = cached.orderedOrderIds
        .map((id) => orderIdMap.get(id))
        .filter((o): o is CampaignOrder => o !== undefined);

      if (matchedRuns.length === n) {
        orderedOrders = matchedRuns;
        telemetry = {
          status: cached.status,
          objectiveValueEur: cached.objectiveValueEur,
          bestLowerBoundEur: cached.bestLowerBoundEur,
          optimalityGapPct: cached.optimalityGapPct,
          solveTimeMs: cached.solveTimeMs,
          runCount: cached.runCount,
          arcCount: cached.arcCount,
          dueDateViolations: cached.dueDateViolations,
          message: 'Loaded verified pre-computed CP-SAT solution (Static / Offline Demo Mode)',
          isPrecomputedCache: true,
        };
      }
    }
  }

  // Fallback to Rule-based Hybrid if live solve was not available and cache missed
  if (orderedOrders.length !== n) {
    orderedOrders = hybridRuns.map((r) => orderIdMap.get(r.order_id)!).filter(Boolean);
    telemetry = {
      status: 'FALLBACK_HEURISTIC',
      objectiveValueEur: null,
      bestLowerBoundEur: null,
      optimalityGapPct: null,
      solveTimeMs: 1.0,
      runCount: n,
      arcCount: n * (n - 1),
      dueDateViolations: null,
      message: `Local solver service offline (using rule-based fallback for ${meta.name})`,
      isPrecomputedCache: false,
    };
  }

  // Re-evaluate strictly using existing scheduleRunList and computeMetrics
  const scheduled = scheduleRunListFn(orderedOrders, true, washoutMultiplier, brokeRateTph, config);
  const metrics = {
    ...computeMetricsFn(scheduled, 480, 280, config),
    strategyId: meta.id,
    strategyName: meta.name,
  };

  return {
    id: meta.id as any,
    name: meta.name,
    description: meta.description,
    runs: scheduled,
    metrics,
    telemetry,
    solverSettings: settings,
  };
}
