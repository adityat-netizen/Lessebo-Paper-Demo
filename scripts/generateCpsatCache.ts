/**
 * Precompute Google OR-Tools CP-SAT solutions for standard synthetic campaign presets.
 * Ensures 100% offline availability and zero-latency loading on static Vercel demos.
 * Uses the EXACT calculateChangeover function to guarantee ONE cost function rule.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateChangeover } from '../src/engine/changeoverCalculator';
import { optimizeSequence } from '../src/engine/sequenceOptimizer';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../src/types/lossModel';
import type { CampaignOrder, MachineId } from '../src/types';
import type { PrecomputedCpsatRegistry, PrecomputedCpsatEntry } from '../src/types/cpsat';

import upcomingOrdersRaw from '../src/data/upcoming_order_book.json' with { type: 'json' };
import conflictOrdersRaw from '../src/data/conflict_order_book.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function solveViaApi(payload: any): Promise<any> {
  const res = await fetch('http://127.0.0.1:8000/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Solver API error: ${res.statusText}`);
  }
  return res.json();
}

async function precomputePreset(
  presetName: 'standard' | 'conflict',
  machineId: MachineId,
  grammagePenalty: number,
  allOrders: CampaignOrder[]
): Promise<PrecomputedCpsatEntry> {
  const machineOrders = allOrders.filter((o) => o.assigned_machine === machineId);
  const n = machineOrders.length;

  const lossConfig = {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    enableGrammageDirectionPenalty: grammagePenalty > 0,
    grammageStepDownPenaltyHours: grammagePenalty,
    grammageLargeJumpThresholdGsm: 40,
    grammageLargeJumpPenaltyHours: grammagePenalty > 0 ? 0.4 : 0.0,
  };

  // 1. Initial setup costs from clean start
  const initialSetupCosts: number[] = [];
  const initialSetupHours: number[] = [];
  for (let j = 0; j < n; j++) {
    const ch = calculateChangeover(null, machineOrders[j], 1.0, 2.4, lossConfig);
    const cost = ch.totalHours * 480 + ch.brokeTonnes * 280;
    initialSetupCosts.push(Math.round(cost * 100) / 100);
    initialSetupHours.push(ch.totalHours);
  }

  // 2. Transition cost and setup hours matrices
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
        const ch = calculateChangeover(machineOrders[i], machineOrders[j], 1.0, 2.4, lossConfig);
        const cost = ch.totalHours * 480 + ch.brokeTonnes * 280;
        costRow.push(Math.round(cost * 100) / 100);
        hoursRow.push(ch.totalHours);
      }
    }
    costMatrix.push(costRow);
    setupHoursMatrix.push(hoursRow);
  }

  // 3. Compute Rule-based Hybrid sequence to warm-start CP-SAT
  const baselineOpt = optimizeSequence(allOrders, machineId, 1.0, 2.4, lossConfig);
  const hybridRuns = baselineOpt.strategies.hybrid.runs;
  const orderIdToIndex = new Map<string, number>();
  machineOrders.forEach((o, idx) => orderIdToIndex.set(o.order_id, idx));
  const hintSequence = hybridRuns.map((r) => orderIdToIndex.get(r.order_id) ?? 0);

  // 4. Call CP-SAT Solver Service
  console.log(`Solving ${presetName} | ${machineId} | penalty=${grammagePenalty}h (${n} runs)...`);
  const payload = {
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
    hint_sequence: hintSequence,
    time_limit_seconds: 5.0,
    gap_limit: 0.005,
    random_seed: 42,
    num_workers: 1,
    enforce_hard_due_dates: false,
  };

  const solveRes = await solveViaApi(payload);

  return {
    scenarioPreset: presetName,
    machineId,
    grammageDownPenaltyHours: grammagePenalty,
    status: solveRes.status,
    orderedOrderIds: solveRes.ordered_order_ids,
    objectiveValueEur: solveRes.objective_value_eur ?? 0,
    bestLowerBoundEur: solveRes.best_lower_bound_eur ?? 0,
    optimalityGapPct: solveRes.optimality_gap_pct ?? 0,
    solveTimeMs: solveRes.solve_time_ms,
    runCount: solveRes.run_count,
    arcCount: solveRes.arc_count,
    dueDateViolations: solveRes.due_date_violations ?? 0,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  console.log('--- Generating CP-SAT Precomputed Solution Cache ---');
  const entries: Record<string, PrecomputedCpsatEntry> = {};

  const targets = [
    { preset: 'standard' as const, machine: 'PM1' as MachineId, penalty: 0.0, orders: upcomingOrdersRaw as CampaignOrder[] },
    { preset: 'standard' as const, machine: 'PM1' as MachineId, penalty: 0.6, orders: upcomingOrdersRaw as CampaignOrder[] },
    { preset: 'conflict' as const, machine: 'PM1' as MachineId, penalty: 0.0, orders: conflictOrdersRaw as CampaignOrder[] },
    { preset: 'conflict' as const, machine: 'PM1' as MachineId, penalty: 0.6, orders: conflictOrdersRaw as CampaignOrder[] },
    { preset: 'standard' as const, machine: 'PM2' as MachineId, penalty: 0.0, orders: upcomingOrdersRaw as CampaignOrder[] },
    { preset: 'conflict' as const, machine: 'PM2' as MachineId, penalty: 0.6, orders: conflictOrdersRaw as CampaignOrder[] },
  ];

  for (const t of targets) {
    const key = `${t.preset}_${t.machine}_${t.penalty.toFixed(1)}`;
    const entry = await precomputePreset(t.preset, t.machine, t.penalty, t.orders);
    entries[key] = entry;
    console.log(`  ✓ Cached: ${key} -> status=${entry.status}, obj=€${entry.objectiveValueEur}, bound=€${entry.bestLowerBoundEur}`);
  }

  const registry: PrecomputedCpsatRegistry = {
    generatedAt: new Date().toISOString(),
    ortoolsVersion: '9.15.6755',
    entries,
  };

  const outPath = path.resolve(__dirname, '../src/data/cpsat_precomputed.json');
  fs.writeFileSync(outPath, JSON.stringify(registry, null, 2), 'utf-8');
  console.log(`\nPrecomputed registry saved to ${outPath}`);
}

main().catch((err) => {
  console.error('Failed to generate CP-SAT cache:', err);
  process.exit(1);
});
