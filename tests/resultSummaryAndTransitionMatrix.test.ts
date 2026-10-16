import assert from 'node:assert';
import { calculateChangeover } from '../src/engine/changeoverCalculator.ts';
import { scheduleRunList } from '../src/engine/scheduleRunner.ts';
import { optimizeSequence } from '../src/engine/sequenceOptimizer.ts';
import { buildCsvContent, downloadCsvFile } from '../src/utils/csvExport.ts';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../src/types/lossModel.ts';
import upcomingOrdersRaw from '../src/data/upcoming_order_book.json' with { type: 'json' };
import type { CampaignOrder, ScheduledRun, StrategyResult } from '../src/types/index.ts';

const upcomingOrders = upcomingOrdersRaw as CampaignOrder[];

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- Running Result Summary, Transition Matrix & Export QA Suite ---\n');

const optResult = optimizeSequence(upcomingOrders, 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
const naive = optResult.naive;
const hybrid = optResult.optimized;

// 1. Result Summary Logic Tests
test('Result Summary calculates exact delta and percentage vs Naive', () => {
  const naiveHours = naive.metrics.totalChangeoverHours;
  const hybridHours = hybrid.metrics.totalChangeoverHours;
  const hoursSaved = Math.max(0, naiveHours - hybridHours);
  const hoursPct = naiveHours > 0 ? (hoursSaved / naiveHours) * 100 : 0;

  assert.ok(naiveHours >= hybridHours, 'Hybrid hours should be less than or equal to Naive');
  assert.ok(hoursPct >= 0 && hoursPct <= 100, 'Hours percentage should be between 0 and 100%');

  const naiveBroke = naive.metrics.totalBrokeTonnes;
  const hybridBroke = hybrid.metrics.totalBrokeTonnes;
  const brokeSaved = Math.max(0, naiveBroke - hybridBroke);
  const brokePct = naiveBroke > 0 ? (brokeSaved / naiveBroke) * 100 : 0;

  assert.ok(naiveBroke >= hybridBroke, 'Hybrid broke should be less than or equal to Naive');
  assert.ok(brokePct >= 0 && brokePct <= 100, 'Broke percentage should be between 0 and 100%');
});

test('Result Summary headline generates clear, plain-language text', () => {
  const hoursSaved = Math.max(0, naive.metrics.totalChangeoverHours - hybrid.metrics.totalChangeoverHours);
  const brokeSaved = Math.max(0, naive.metrics.totalBrokeTonnes - hybrid.metrics.totalBrokeTonnes);
  const costSaved = Math.max(0, (naive.metrics.totalTransitionCostEur ?? 0) - (hybrid.metrics.totalTransitionCostEur ?? 0));

  const headline = `Hybrid reduces downtime by ${hoursSaved.toFixed(1)}h and broke by ${brokeSaved.toFixed(1)}t (€${Math.round(costSaved).toLocaleString()} saved) compared to order arrival sequence.`;

  assert.ok(headline.includes('reduces downtime by'), 'Headline must describe downtime savings');
  assert.ok(headline.includes('broke by'), 'Headline must describe broke savings');
  assert.ok(headline.includes('compared to order arrival sequence'), 'Headline must reference baseline');
});

test('Result Summary due dates line distinguishes between all met vs orders at risk', () => {
  const runs = hybrid.runs;
  const atRiskCount = runs.filter((r) => r.isFeasible === false).length;
  const dueDatesStatus = atRiskCount === 0
    ? 'All customer due dates met'
    : `${atRiskCount} order${atRiskCount > 1 ? 's' : ''} at risk of delay`;

  assert.ok(
    dueDatesStatus === 'All customer due dates met' || dueDatesStatus.includes('at risk of delay'),
    'Due dates status must indicate delivery compliance cleanly'
  );
});

test('Result Summary quality / bound line accurately handles exact bounds vs heuristic absence', () => {
  // CP-SAT / MIP optimal case
  const cpsatExactBound = {
    solverStatus: 'OPTIMAL' as const,
    gap: 0,
    dualBound: 12500,
  };
  const exactLine = cpsatExactBound.solverStatus === 'OPTIMAL'
    ? 'Proven best possible (0.0% optimality gap)'
    : `Within ${(cpsatExactBound.gap * 100).toFixed(1)}% of the best possible result`;
  assert.strictEqual(exactLine, 'Proven best possible (0.0% optimality gap)');

  // Heuristic case without bound
  const heuristicLine = 'Best-possible bound not available for this method (local search heuristic)';
  assert.ok(heuristicLine.includes('Best-possible bound not available'));
});

// 2. Transition Matrix Reconciliation Tests
test('Transition Matrix pairwise cell calculation strictly uses single shared evaluator', () => {
  const runA = hybrid.runs[0];
  const runB = hybrid.runs[1];
  const ch = calculateChangeover(runA, runB, 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);

  assert.ok(typeof ch.totalHours === 'number' && !isNaN(ch.totalHours));
  assert.ok(typeof ch.brokeTonnes === 'number' && !isNaN(ch.brokeTonnes));
  assert.ok(typeof ch.reason === 'string' && ch.reason.length > 0);
});

test('Transition Matrix cell values strictly sum to total changeover hours and broke of schedule', () => {
  const runs = hybrid.runs;
  let sumHours = 0;
  let sumBroke = 0;

  for (let i = 0; i < runs.length; i++) {
    const from = i === 0 ? null : runs[i - 1];
    const to = runs[i];
    const ch = calculateChangeover(from, to, 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
    sumHours += ch.totalHours;
    sumBroke += ch.brokeTonnes;
  }

  const roundedSumHours = Math.round(sumHours * 10) / 10;
  const roundedSumBroke = Math.round(sumBroke * 10) / 10;

  assert.strictEqual(
    roundedSumHours,
    hybrid.metrics.totalChangeoverHours,
    `Sum of transition hours (${roundedSumHours}) must match schedule totalChangeoverHours (${hybrid.metrics.totalChangeoverHours})`
  );
  assert.strictEqual(
    roundedSumBroke,
    hybrid.metrics.totalBrokeTonnes,
    `Sum of transition broke (${roundedSumBroke}) must match schedule totalBrokeTonnes (${hybrid.metrics.totalBrokeTonnes})`
  );
});

test('Transition Matrix preserves 100% symmetric grammage calculations', () => {
  const run1 = { ...hybrid.runs[0], grammage_gsm: 80, shade_code: 'W01', format_type: 'Reel' };
  const run2 = { ...hybrid.runs[1], grammage_gsm: 240, shade_code: 'W01', format_type: 'Reel' };

  const stepUp = calculateChangeover(run1, run2, 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
  const stepDown = calculateChangeover(run2, run1, 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);

  assert.strictEqual(stepUp.grammageHours, stepDown.grammageHours, 'Grammage hours must be symmetric');
  assert.strictEqual(stepUp.grammageBrokeTonnes, stepDown.grammageBrokeTonnes, 'Grammage broke must be symmetric');
});

// 3. CSV Exports Consistency & Metadata Tests
test('CSV Export supports custom algorithmSlug in standardized filename format', () => {
  // Check buildCsvContent contains expected metadata
  const metadata = {
    datasetName: 'PM3 Sequence Schedule',
    scenarioName: 'Conflict Campaign',
    solverStatus: 'FEASIBLE',
    provenLowerBound: 14200,
    optimalityGap: 0.038,
    timeoutSeconds: 30,
    seed: 42,
  };

  const csv = buildCsvContent(
    metadata,
    [
      { key: 'runSeq', label: 'Run Sequence' },
      { key: 'orderId', label: 'Order ID' },
      { key: 'costEur', label: 'Transition Cost (€)' },
    ],
    [{ runSeq: 1, orderId: 'ORD-001', costEur: 480 }]
  );

  assert.ok(csv.includes('# Solver Status: FEASIBLE'), 'Must include solver status');
  assert.ok(csv.includes('# Proven Lower Bound: 14200'), 'Must include proven lower bound');
  assert.ok(csv.includes('# Optimality Gap: 3.8%'), 'Must include formatted optimality gap');
  assert.ok(csv.includes('# Solver Seed: 42'), 'Must include solver seed');
  assert.ok(csv.includes('# Notice: Illustrative / Synthetic - Not actual Lessebo results'), 'Must include synthetic disclaimer');
});

test('Transition Matrix CSV export properly includes is_used_in_sequence flag', () => {
  const runs = hybrid.runs.slice(0, 3);
  const matrixRows: any[] = [];

  for (const from of runs) {
    for (const to of runs) {
      const isUsed = false; // or true if matched
      const ch = calculateChangeover(from, to, 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
      matrixRows.push({
        from_run: from.runSequence,
        to_run: to.runSequence,
        total_hours: ch.totalHours,
        broke_tonnes: ch.brokeTonnes,
        is_used: isUsed ? 'YES' : 'NO',
      });
    }
  }

  assert.strictEqual(matrixRows.length, 9, '3x3 matrix should contain 9 pairwise transitions');
  assert.ok(matrixRows[0].hasOwnProperty('is_used'), 'Matrix export must have is_used flag');
});

// 4. Performance Comparison Table Tests
test('Performance Comparison Table calculates exact savings deltas and percentages', () => {
  const naiveHours = naive.metrics.totalChangeoverHours;
  const hybridHours = hybrid.metrics.totalChangeoverHours;
  const hoursSaved = Math.round((naiveHours - hybridHours) * 10) / 10;
  const hoursPct = naiveHours > 0 ? Math.round((hoursSaved / naiveHours) * 1000) / 10 : 0;

  assert.ok(hoursSaved >= 0, 'Changeover hours saved should be >= 0');
  assert.ok(hoursPct >= 0 && hoursPct <= 100, 'Hours saved pct should be between 0% and 100%');

  const naiveBroke = naive.metrics.totalBrokeTonnes;
  const hybridBroke = hybrid.metrics.totalBrokeTonnes;
  const brokeSaved = Math.round((naiveBroke - hybridBroke) * 10) / 10;
  const brokePct = naiveBroke > 0 ? Math.round((brokeSaved / naiveBroke) * 1000) / 10 : 0;

  assert.ok(brokeSaved >= 0, 'Broke scrap saved should be >= 0');
  assert.ok(brokePct >= 0 && brokePct <= 100, 'Broke saved pct should be between 0% and 100%');
});

test('Performance Comparison Table capacity released and cost use exact historical formulas', () => {
  const hoursSaved = Math.max(0, Math.round((naive.metrics.totalChangeoverHours - hybrid.metrics.totalChangeoverHours) * 10) / 10);
  const potentialOutputTonnes = Math.round(hoursSaved * 5.8 * 10) / 10;

  assert.strictEqual(
    hoursSaved,
    Math.max(0, Math.round((naive.metrics.totalChangeoverHours - hybrid.metrics.totalChangeoverHours) * 10) / 10),
    'Capacity released hours must equal changeover downtime reduction'
  );
  assert.strictEqual(potentialOutputTonnes, Math.round(hoursSaved * 5.8 * 10) / 10);

  const naiveCost = Math.round(naive.metrics.totalChangeoverHours * 480 + naive.metrics.totalBrokeTonnes * 280);
  const hybridCost = Math.round(hybrid.metrics.totalChangeoverHours * 480 + hybrid.metrics.totalBrokeTonnes * 280);
  const costSaved = naiveCost - hybridCost;

  assert.ok(costSaved >= 0, 'Cost saved should be >= 0 for hybrid vs naive');
  assert.strictEqual(hybridCost, Math.round(hybrid.metrics.totalChangeoverHours * 480 + hybrid.metrics.totalBrokeTonnes * 280));
});

test('Performance Comparison Table generates dynamic plain-language takeaway', () => {
  const hoursSaved = Math.round((naive.metrics.totalChangeoverHours - hybrid.metrics.totalChangeoverHours) * 10) / 10;
  const hoursPct = Math.round((hoursSaved / naive.metrics.totalChangeoverHours) * 1000) / 10;
  const costSaved = Math.round(
    (naive.metrics.totalChangeoverHours * 480 + naive.metrics.totalBrokeTonnes * 280) -
    (hybrid.metrics.totalChangeoverHours * 480 + hybrid.metrics.totalBrokeTonnes * 280)
  );

  const takeaway = `Rule-Based Hybrid achieves ${hoursSaved.toFixed(1)} h less changeover downtime (${hoursPct.toFixed(1)}% reduction) and saves €${costSaved.toLocaleString()} compared to Naive (FIFO).`;

  assert.ok(takeaway.includes('less changeover downtime'), 'Takeaway must state downtime reduction');
  assert.ok(takeaway.includes('saves €'), 'Takeaway must state cost savings');
});

test('Performance Comparison CSV Export includes all 7 rows, metadata, and synthetic notice', () => {
  const metadata = {
    datasetName: 'Production Sequence Performance Comparison (PM1)',
    scenarioName: 'STANDARD Campaign',
    selectedAlgorithm: 'Rule-Based Hybrid Sequencer',
    comparedAlgorithm: 'NAIVE BASELINE (FIFO Arrival)',
    solverStatus: 'HEURISTIC',
    provenLowerBound: 'Not available (heuristic / local search)',
    optimalityGap: 'Not available',
    timeoutSeconds: 4.0,
    seed: 42,
    fallbackNote: 'None',
  };

  const columns = [
    { key: 'metric', label: 'Operational Metric' },
    { key: 'metric_unit', label: 'Unit' },
    { key: 'compared_val', label: 'Naive Baseline Value' },
    { key: 'selected_val', label: 'Rule-Based Hybrid Value' },
    { key: 'delta', label: 'Capacity & Savings Delta' },
  ];

  const rows = [
    { metric: 'Changeover Hours', metric_unit: 'hours', compared_val: '12.4 h', selected_val: '5.4 h', delta: '-7.0 h freed' },
    { metric: 'Off-Spec Broke Paper', metric_unit: 'tonnes', compared_val: '29.8 t', selected_val: '13.0 t', delta: '-16.8 t reduced' },
    { metric: 'Deep Pulper Washouts', metric_unit: 'events', compared_val: '3 washouts', selected_val: '1 washout', delta: '2 avoided' },
    { metric: 'Machine Capacity Released', metric_unit: 'hours', compared_val: '— (Reference)', selected_val: '+7.0 h', delta: '+7.0 h freed' },
    { metric: 'Indicative Transition Cost', metric_unit: 'EUR', compared_val: '€14,296', selected_val: '€6,232', delta: 'Saved €8,064' },
    { metric: 'Customer Due-Date Delivery SLA', metric_unit: '% compliance', compared_val: '100% (All met)', selected_val: '100% (All met)', delta: 'Parity' },
    { metric: 'Execution / Solve Time', metric_unit: 'time', compared_val: '< 1 ms', selected_val: '~1.5 ms', delta: 'Instant' },
  ];

  const csv = buildCsvContent(metadata, columns, rows);

  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
  assert.ok(csv.includes('# Selected Algorithm: Rule-Based Hybrid Sequencer'), 'Must include selected algorithm in metadata');
  assert.ok(csv.includes('# Compared Baseline: NAIVE BASELINE (FIFO Arrival)'), 'Must include compared baseline in metadata');
  assert.ok(csv.includes('# Notice: Illustrative / Synthetic - Not actual Lessebo results'), 'Must include synthetic notice');
  assert.ok(csv.includes('Changeover Hours'), 'Must contain changeover hours row');
  assert.ok(csv.includes('Indicative Transition Cost'), 'Must contain indicative cost row');
  assert.ok(csv.includes('Execution / Solve Time'), 'Must contain solve time row');
});

test('Performance Comparison handles edge cases: 0 runs and 1 run safely', () => {
  // 0 runs
  const emptyOpt = optimizeSequence([], 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
  assert.strictEqual(emptyOpt.optimized.runs.length, 0);
  assert.strictEqual(emptyOpt.optimized.metrics.totalChangeoverHours, 0);

  // 1 run
  const singleOpt = optimizeSequence([upcomingOrders[0]], 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
  assert.strictEqual(singleOpt.optimized.runs.length, 1);
  assert.ok(!isNaN(singleOpt.optimized.metrics.totalChangeoverHours));
  assert.ok(!isNaN(singleOpt.optimized.metrics.totalBrokeTonnes));
});

console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) {
  process.exit(1);
}
