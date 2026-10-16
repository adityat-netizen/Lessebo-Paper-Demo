/**
 * Generate Comprehensive Benchmark Suite Results across 28 Seeded Campaigns.
 * Evaluates Naive, Colour-First, Grammage-First, Hybrid, and Google OR-Tools CP-SAT.
 * Scored strictly through the single shared evaluator: calculateChangeover, scheduleRunList, computeMetrics.
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAllBenchmarkInstances } from '../src/engine/campaignGenerator';
import { calculateChangeover } from '../src/engine/changeoverCalculator';
import { evaluateHybrid, evaluateBenchmarkRow, computeScalingSummary } from '../src/engine/benchmarkHarness';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../src/types/lossModel';
import type { CampaignOrder } from '../src/types';
import type { BenchmarkSuiteData, InstanceBenchmarkRow } from '../src/types/benchmark';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOLVER_API_URL = 'http://127.0.0.1:8000';

async function solveInstanceWithCpsat(
  orders: CampaignOrder[],
  timeLimitSec: number = 3.0
): Promise<{
  orderedOrders: CampaignOrder[];
  solveTimeMs: number;
  bestLowerBoundEur: number;
  optimalityGapPct: number;
  status: any;
}> {
  const n = orders.length;
  const config = DEFAULT_LOSS_MODEL_CONFIG;

  // 1. Initial costs
  const initialSetupCosts: number[] = [];
  const initialSetupHours: number[] = [];
  for (let j = 0; j < n; j++) {
    const ch = calculateChangeover(null, orders[j], 1.0, 2.4, config);
    const cost = ch.totalHours * 480 + ch.brokeTonnes * 280;
    initialSetupCosts.push(Math.round(cost * 100) / 100);
    initialSetupHours.push(ch.totalHours);
  }

  // 2. Transition cost matrix
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
        const ch = calculateChangeover(orders[i], orders[j], 1.0, 2.4, config);
        const cost = ch.totalHours * 480 + ch.brokeTonnes * 280;
        costRow.push(Math.round(cost * 100) / 100);
        hoursRow.push(ch.totalHours);
      }
    }
    costMatrix.push(costRow);
    setupHoursMatrix.push(hoursRow);
  }

  // 3. Warm start hint from Rule-based Hybrid
  const hybridEval = evaluateHybrid(orders, config);
  const orderIdToIndex = new Map<string, number>();
  orders.forEach((o, idx) => orderIdToIndex.set(o.order_id, idx));
  const hintSequence = hybridEval.runs.map((r: any) => orderIdToIndex.get(r.order_id) ?? 0);

  // 4. Call FastAPI Solver
  const payload = {
    runs: orders.map((o) => ({
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
    time_limit_seconds: timeLimitSec,
    gap_limit: 0.005,
    random_seed: 42,
    num_workers: 1,
    enforce_hard_due_dates: false,
  };

  const res = await fetch(`${SOLVER_API_URL}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Solver service responded with HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const orderMap = new Map<string, CampaignOrder>();
  orders.forEach((o) => orderMap.set(o.order_id, o));

  const orderedOrders = data.ordered_order_ids.map((id: string) => orderMap.get(id)!);

  return {
    orderedOrders,
    solveTimeMs: data.solve_time_ms,
    bestLowerBoundEur: data.best_lower_bound_eur ?? 0,
    optimalityGapPct: data.optimality_gap_pct ?? 0,
    status: data.status,
  };
}

async function main() {
  console.log('======================================================================');
  console.log('Generating 28-Instance Benchmark Suite (Single Shared Cost Function)');
  console.log('Illustrative / Synthetic - Not actual Lessebo results.');
  console.log('======================================================================\n');

  const instances = generateAllBenchmarkInstances(42, 'PM1');
  console.log(`Generated ${instances.length} benchmark instances across 7 size tiers (10-100 runs).\n`);

  const rows: InstanceBenchmarkRow[] = [];

  for (let idx = 0; idx < instances.length; idx++) {
    const inst = instances[idx];
    const timeLimit = inst.runCount <= 20 ? 1.5 : inst.runCount <= 40 ? 2.5 : 3.0;

    process.stdout.write(
      `[${idx + 1}/${instances.length}] Solving ${inst.instanceId} (${inst.runCount} runs, ${inst.structureLabel}, limit=${timeLimit}s)... `
    );

    const t0 = Date.now();
    try {
      const cpsatResult = await solveInstanceWithCpsat(inst.orders, timeLimit);
      const row = evaluateBenchmarkRow(inst, cpsatResult, DEFAULT_LOSS_MODEL_CONFIG);
      rows.push(row);

      const elapsed = Date.now() - t0;
      console.log(
        `✓ DONE (${elapsed}ms) | Winner: ${row.winningStrategyName} | Naive: €${row.naive.totalChangeoverCostEur} -> CP-SAT: €${row.cpsat.totalChangeoverCostEur} (-${row.cpsatVsNaiveSavingsPct}%) | Gap: ${row.cpsat.optimalityGapPct?.toFixed(2)}%`
      );
    } catch (err: any) {
      console.error(`\n❌ Error solving ${inst.instanceId}:`, err.message);
      throw err;
    }
  }

  const summary = computeScalingSummary(rows);

  console.log('\n======================================================================');
  console.log('BENCHMARK SUMMARY ROLLUP:');
  console.log(`  Total Instances Evaluated: ${summary.totalInstances}`);
  console.log(`  CP-SAT Wins:               ${summary.cpsatWinsCount}`);
  console.log(`  Ties:                      ${summary.tiesCount}`);
  console.log(`  Hybrid Wins:               ${summary.hybridWinsCount}`);
  console.log(`  Avg CP-SAT vs Naive:       -${summary.avgCpsatVsNaiveSavingsPct}%`);
  console.log(`  Avg CP-SAT vs Hybrid:      -${summary.avgCpsatVsHybridSavingsPct}%`);
  console.log(`  Proven Optimal Count:      ${summary.provenOptimalCount}/${summary.totalInstances}`);
  console.log(`  Optimal Horizon Threshold: N <= ${summary.optimalRunThreshold} runs (100% proven optimal)`);
  console.log(`  Average Optimality Gap:    ${summary.avgOptimalityGapPct}%`);
  console.log(`  Worst-case Optimality Gap: ${summary.worstCaseOptimalityGapPct}%`);
  console.log(`  Avg CP-SAT Solve Time:     ${summary.avgCpsatSolveTimeMs} ms`);
  console.log(`  Avg Hybrid Solve Time:     ${summary.avgHybridSolveTimeMs} ms`);
  console.log('======================================================================\n');

  const suiteData: BenchmarkSuiteData = {
    generatedAt: new Date().toISOString(),
    ortoolsVersion: '9.15.6755',
    costFunctionDisclaimer:
      'Evaluator: Single Shared Cost Function (calculateChangeover: 480 EUR/h, 280 EUR/t broke). Illustrative / Synthetic - Not actual Lessebo results.',
    summary,
    instances: rows,
  };

  const outPath = path.resolve(__dirname, '../src/data/benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify(suiteData, null, 2), 'utf-8');
  console.log(`Benchmark suite successfully saved to ${outPath}\n`);
}

main().catch((err) => {
  console.error('Benchmark generation failed:', err);
  process.exit(1);
});
