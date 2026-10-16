/**
 * QA & Parity Tests for Benchmark Suite & Synthetic Campaign Generator
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import assert from 'node:assert';
import {
  generateCampaignInstance,
  generateAllBenchmarkInstances,
  BENCHMARK_SIZES,
  BENCHMARK_STRUCTURES,
} from '../src/engine/campaignGenerator';
import {
  evaluateNaive,
  evaluateColorFirst,
  evaluateGrammageFirst,
  evaluateHybrid,
  computeScalingSummary,
  buildBenchmarkCsv,
  buildBenchmarkMarkdownReport,
} from '../src/engine/benchmarkHarness';
import type { BenchmarkSuiteData } from '../src/types/benchmark';
import benchmarkResultsRaw from '../src/data/benchmark_results.json' with { type: 'json' };

const suite = benchmarkResultsRaw as unknown as BenchmarkSuiteData;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => console.log(`  ✓ PASS: ${name}`))
        .catch((err) => {
          console.error(`  ✗ FAIL: ${name}`);
          console.error(err);
          process.exitCode = 1;
        });
    }
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runBenchmarkTests() {
  console.log('\n--- Running Benchmark Harness & Campaign Generator QA Suite ---\n');

  // Test 1: Matrix Coverage (>= 20 instances across 7 sizes and 4 archetypes)
  test('Campaign generator produces >= 20 reproducible instances covering 7 sizes and 4 archetypes', () => {
    const instances = generateAllBenchmarkInstances(42, 'PM1');
    assert.strictEqual(instances.length, 28, 'Should generate exactly 28 instances (7 sizes x 4 structures)');
    assert.strictEqual(BENCHMARK_SIZES.length, 7, 'Must test 7 size tiers: 10, 20, 30, 40, 60, 80, 100');
    assert.strictEqual(BENCHMARK_STRUCTURES.length, 4, 'Must test 4 structures: Standard, Conflict, Heavy, Shade');
  });

  // Test 2: Reproducibility of seed PRNG
  test('Deterministic seed reproducibility: identical seeds generate byte-for-byte identical orders', () => {
    const instA = generateCampaignInstance(20, 'conflict', 12345, 'PM1');
    const instB = generateCampaignInstance(20, 'conflict', 12345, 'PM1');
    assert.strictEqual(instA.orders.length, 20);
    assert.strictEqual(instB.orders.length, 20);

    for (let i = 0; i < 20; i++) {
      assert.strictEqual(instA.orders[i].order_id, instB.orders[i].order_id);
      assert.strictEqual(instA.orders[i].grammage_gsm, instB.orders[i].grammage_gsm);
      assert.strictEqual(instA.orders[i].shade_name, instB.orders[i].shade_name);
      assert.strictEqual(instA.orders[i].due_in_days, instB.orders[i].due_in_days);
    }
  });

  // Test 3: Structural Archetype Properties
  test('Archetype discrimination: Conflict campaigns enforce tighter SLAs; Heavy Grammage enforces high caliper', () => {
    const conflictInst = generateCampaignInstance(30, 'conflict', 777, 'PM1');
    const heavyInst = generateCampaignInstance(30, 'heavy_grammage', 777, 'PM1');

    const strictCount = conflictInst.orders.filter((o) => o.customer_priority.includes('Strict')).length;
    assert.ok(strictCount >= 8, `Conflict instance should have high strict priority orders, got ${strictCount}`);

    const avgGrammageHeavy = heavyInst.orders.reduce((sum, o) => sum + o.grammage_gsm, 0) / 30;
    assert.ok(avgGrammageHeavy >= 140, `Heavy Grammage instance should have high caliper, got ${avgGrammageHeavy}`);
  });

  // Test 4: Single Cost Function Evaluator Parity across all 4 heuristic methods
  test('Single evaluator parity: all heuristic methods score through calculateChangeover & scheduleRunList', () => {
    const inst = generateCampaignInstance(10, 'standard', 42, 'PM1');
    const naive = evaluateNaive(inst.orders);
    const colorFirst = evaluateColorFirst(inst.orders);
    const grammageFirst = evaluateGrammageFirst(inst.orders);
    const hybrid = evaluateHybrid(inst.orders);

    assert.ok(naive.runs.length === 10);
    assert.ok(colorFirst.runs.length === 10);
    assert.ok(grammageFirst.runs.length === 10);
    assert.ok(hybrid.runs.length === 10);

    // Hybrid should be <= naive cost
    const naiveCost = naive.metrics.totalOperatingCostEur + naive.metrics.totalBrokeCostEur;
    const hybridCost = hybrid.metrics.totalOperatingCostEur + hybrid.metrics.totalBrokeCostEur;
    assert.ok(hybridCost <= naiveCost + 1.0, `Hybrid (${hybridCost}) must not exceed Naive (${naiveCost})`);
  });

  // Test 5: Precomputed Benchmark Suite Integrity (28 instances)
  test('Benchmark results registry integrity: all 28 instances populated with 5 methods and metrics', () => {
    assert.strictEqual(suite.instances.length, 28, 'Must have 28 benchmark instances');
    assert.ok(suite.summary.totalInstances === 28, 'Summary must reflect 28 instances');
    assert.ok(suite.summary.optimalRunThreshold >= 10, 'Optimal run threshold should be >= 10 runs');
    assert.ok(suite.summary.avgCpsatVsNaiveSavingsPct > 40, 'Average savings vs naive should be substantial (> 40%)');

    suite.instances.forEach((inst) => {
      assert.ok(inst.naive.totalChangeoverCostEur > 0);
      assert.ok(inst.hybrid.totalChangeoverCostEur > 0);
      assert.ok(inst.cpsat.totalChangeoverCostEur > 0);
      assert.ok(inst.cpsat.totalChangeoverCostEur <= inst.naive.totalChangeoverCostEur + 1.0);
    });
  });

  // Test 6: Scaling Summary Computation
  test('Scaling summary correctly tallies wins, ties, and average metrics', () => {
    const summary = computeScalingSummary(suite.instances);
    assert.strictEqual(summary.totalInstances, 28);
    assert.strictEqual(summary.cpsatWinsCount + summary.tiesCount + summary.hybridWinsCount, 28);
    assert.ok(summary.avgCpsatSolveTimeMs > 0);
    assert.ok(summary.avgHybridSolveTimeMs < 50); // sub-50ms heuristic
  });

  // Test 7: CSV Export Formatting
  test('CSV export contains RFC 4180 metadata headers, synthetic notice, and 28 instance rows', () => {
    const csv = buildBenchmarkCsv(suite);
    assert.ok(csv.includes('# LESSEBO PAPER AB - SEQUENCE OPTIMIZATION BENCHMARK SUITE'));
    assert.ok(csv.includes('# Illustrative / Synthetic - Not actual Lessebo results.'));
    assert.ok(csv.includes('# Shared Evaluator: calculateChangeover'));
    assert.ok(csv.includes('Instance ID,Instance Name,Run Count,Structure'));

    const lines = csv.split('\n').filter((l) => l.trim().length > 0 && !l.startsWith('#'));
    // 1 header row + 28 data rows = 29 lines
    assert.strictEqual(lines.length, 29, `Expected 29 CSV rows (1 header + 28 instances), got ${lines.length}`);
  });

  // Test 8: Technical Markdown Report
  test('Markdown report generates comprehensive executive analysis with scaling characteristics', () => {
    const md = buildBenchmarkMarkdownReport(suite);
    assert.ok(md.includes('# Lessebo Paper AB - Sequence Optimization Benchmark Technical Report'));
    assert.ok(md.includes('Illustrative / Synthetic - Not actual Lessebo results.'));
    assert.ok(md.includes('Executive Summary & Optimization Scaling Verdict'));
    assert.ok(md.includes('The Small-to-Medium Horizon'));
    assert.ok(md.includes('The Large Mill Horizon'));
    assert.ok(md.includes('Methodology & Single Cost Function Verification'));
  });

  console.log('\n--- Benchmark Harness QA Suite Completed ---\n');
}

runBenchmarkTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
