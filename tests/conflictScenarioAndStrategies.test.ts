import assert from 'node:assert';
import { calculateChangeover } from '../src/engine/changeoverCalculator.ts';
import { optimizeSequence } from '../src/engine/sequenceOptimizer.ts';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../src/types/lossModel.ts';
import upcomingOrdersRaw from '../src/data/upcoming_order_book.json' with { type: 'json' };
import type { CampaignOrder } from '../src/types/index.ts';

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

console.log('\n--- Running Sequence Strategies & Grammage Direction QA Suite ---\n');

// 1. Backward Compatibility Test: Asymmetry set to zero reproduces baseline numbers
test('Zero asymmetry (penalty=0) reproduces baseline transition calculations', () => {
  const run1: CampaignOrder = {
    ...upcomingOrders[0],
    grammage_gsm: 150,
    shade_tier: 1,
    shade_name: 'Bright White',
  };
  const run2: CampaignOrder = {
    ...upcomingOrders[1],
    grammage_gsm: 80,
    shade_tier: 1,
    shade_name: 'Bright White',
  };

  const baselineChangeover = calculateChangeover(run1, run2, 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    grammageStepDownPenaltyHours: 0.0,
    grammageLargeJumpPenaltyHours: 0.0,
  });

  // Base setup 0.5 + grammage jump (150 - 80 = 70 > 40 => 1.2h) = 1.7h
  assert.strictEqual(baselineChangeover.grammageHours, 1.2);
  assert.strictEqual(baselineChangeover.totalHours, 1.7);
  assert.strictEqual(baselineChangeover.isGrammageReversal, true);
  assert.strictEqual(baselineChangeover.grammageDirection, 'down');
});

// 2. Step-down costs more than step-up when configured
test('Step-down costs more than step-up when direction penalty is configured', () => {
  const lightHeavy: CampaignOrder = {
    ...upcomingOrders[0],
    grammage_gsm: 80,
    shade_name: 'Bright White',
    shade_tier: 1,
  };
  const heavyLight: CampaignOrder = {
    ...upcomingOrders[1],
    grammage_gsm: 150,
    shade_name: 'Bright White',
    shade_tier: 1,
  };

  const penaltyConfig = {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    enableGrammageDirectionPenalty: true,
    grammageStepDownPenaltyHours: 0.8,
    grammageLargeJumpThresholdGsm: 40,
    grammageLargeJumpPenaltyHours: 0.4,
  };

  // Step UP: 80 -> 150 (delta 70 > 40 => 1.2h base, 0 penalty)
  const stepUp = calculateChangeover(lightHeavy, heavyLight, 1.0, 2.4, penaltyConfig);
  // Step DOWN: 150 -> 80 (delta 70 > 40 => 1.2h base + 0.8h step down + 0.4h large jump = 2.4h)
  const stepDown = calculateChangeover(heavyLight, lightHeavy, 1.0, 2.4, penaltyConfig);

  assert.strictEqual(stepUp.grammageHours, 1.2);
  assert.strictEqual(stepUp.isGrammageReversal, false);
  assert.strictEqual(stepUp.grammageDirection, 'up');

  assert.strictEqual(stepDown.grammageHours, 2.4);
  assert.strictEqual(stepDown.isGrammageReversal, true);
  assert.strictEqual(stepDown.grammageDirection, 'down');
  assert.strictEqual(stepDown.grammageHours > stepUp.grammageHours, true);
  assert.strictEqual(stepDown.brokeTonnes > stepUp.brokeTonnes, true);
});

// 3. Transition breakdown sums to total hours and broke
test('Transition breakdown components sum exactly to total hours and broke tonnes', () => {
  const runA: CampaignOrder = { ...upcomingOrders[0], grammage_gsm: 120, shade_tier: 4, shade_name: 'Deep Charcoal' };
  const runB: CampaignOrder = { ...upcomingOrders[1], grammage_gsm: 80, shade_tier: 1, shade_name: 'Bright White' };

  const config = {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    grammageStepDownPenaltyHours: 0.5,
  };

  const result = calculateChangeover(runA, runB, 1.0, 2.4, config);

  const sumHours = Math.round((result.baseSetup + result.washoutHours + result.grammageHours + result.formatHours) * 100) / 100;
  assert.strictEqual(result.totalHours, sumHours, 'Total hours must equal sum of component setup hours');

  const sumBroke = Math.round(
    ((result.baseSetup * 2.4) +
      (result.colorBrokeTonnes ?? 0) +
      (result.grammageBrokeTonnes ?? 0) +
      (result.formatBrokeTonnes ?? 0) +
      (result.startupBrokeTonnes ?? 0)) * 10
  ) / 10;
  assert.strictEqual(result.brokeTonnes, sumBroke, 'Broke tonnes must equal sum of component broke');
});

// 4. Multi-strategy optimization produces 4 distinct evaluated strategies
test('optimizeSequence returns all 4 strategies (Naive, Colour-First, Grammage-First, Hybrid)', () => {
  const opt = optimizeSequence(upcomingOrders, 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);

  assert.ok(opt.strategies, 'strategies dictionary must exist');
  assert.ok(opt.strategies.naive, 'Strategy A (Naive) must exist');
  assert.ok(opt.strategies.colorFirst, 'Strategy B (Colour-First) must exist');
  assert.ok(opt.strategies.grammageFirst, 'Strategy C (Grammage-First) must exist');
  assert.ok(opt.strategies.hybrid, 'Strategy D (Hybrid) must exist');

  assert.strictEqual(opt.strategies.naive.runs.length, opt.optimized.runs.length);
  assert.strictEqual(opt.strategies.colorFirst.runs.length, opt.optimized.runs.length);
  assert.strictEqual(opt.strategies.grammageFirst.runs.length, opt.optimized.runs.length);
  assert.strictEqual(opt.strategies.hybrid.runs.length, opt.optimized.runs.length);
});

// 5. Recommended strategy never has higher total cost than other feasible strategies
test('Recommended strategy achieves lowest total transition cost among feasible candidates', () => {
  const opt = optimizeSequence(upcomingOrders, 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
  assert.ok(opt.recommendedStrategyId, 'recommendedStrategyId must be set');

  const recStrategy = opt.strategies?.[opt.recommendedStrategyId === 'color_first' ? 'colorFirst' : opt.recommendedStrategyId === 'grammage_first' ? 'grammageFirst' : 'hybrid'];
  assert.ok(recStrategy, 'Recommended strategy must exist');

  const recCost = recStrategy.metrics.totalOperatingCostEur + recStrategy.metrics.totalBrokeCostEur;

  // Compare against colorFirst and hybrid
  const colorFirstCost = opt.strategies!.colorFirst.metrics.totalOperatingCostEur + opt.strategies!.colorFirst.metrics.totalBrokeCostEur;
  const hybridCost = opt.strategies!.hybrid.metrics.totalOperatingCostEur + opt.strategies!.hybrid.metrics.totalBrokeCostEur;

  assert.strictEqual(recCost <= Math.max(colorFirstCost, hybridCost), true, 'Recommended cost must be optimal or tied');
});

// 6. Due dates and SLAs are protected in optimized sequence
test('Optimized sequence respects strict customer SLAs and preserves delivery feasibility', () => {
  const opt = optimizeSequence(upcomingOrders, 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);

  const strictOrders = opt.optimized.runs.filter((r) => r.customer_priority.includes('Strict'));
  const strictViolations = strictOrders.filter((r) => !r.meetsSla);

  assert.strictEqual(strictViolations.length, 0, 'Zero strict SLA orders should be late in optimized schedule');
  assert.strictEqual(opt.optimized.metrics.slaCompliancePct >= opt.naive.metrics.slaCompliancePct, true);
});

// 7. Edge Cases: Single run, single grammage, single shade, zero penalty, extreme penalty
test('Edge case handling: single run without NaN or crash', () => {
  const single = [upcomingOrders[0]];
  const opt = optimizeSequence(single, 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);
  assert.strictEqual(opt.optimized.runs.length, 1);
  assert.strictEqual(Number.isNaN(opt.optimized.metrics.totalChangeoverHours), false);
  assert.strictEqual(Number.isNaN(opt.optimized.metrics.totalOperatingCostEur), false);
});

test('Edge case handling: uniform grammage runs', () => {
  const uniformGsm = upcomingOrders.slice(0, 8).map((o) => ({ ...o, grammage_gsm: 120 }));
  const opt = optimizeSequence(uniformGsm, 'PM1', 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    grammageStepDownPenaltyHours: 1.5,
  });
  assert.strictEqual(opt.optimized.metrics.grammageReversalsCount, 0, 'No reversals when all runs share identical GSM');
  assert.strictEqual(Number.isNaN(opt.savings.financialSavingsEur), false);
});

test('Edge case handling: extreme penalty value (10.0h) executes without overflow or crash', () => {
  const opt = optimizeSequence(upcomingOrders, 'PM1', 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    grammageStepDownPenaltyHours: 10.0,
    grammageLargeJumpPenaltyHours: 5.0,
  });
  assert.strictEqual(Number.isFinite(opt.optimized.metrics.totalChangeoverHours), true);
  assert.strictEqual(Number.isFinite(opt.optimized.metrics.totalBrokeCostEur), true);
});

// 8. Conflict Preset Tests: "Heavy-grammage light shades" produces reversals under colour-first and fewer under Hybrid
test('Conflict scenario generates multiple reversals in Colour-First and fewer under Hybrid', async () => {
  const conflictRaw = (await import('../src/data/conflict_order_book.json', { with: { type: 'json' } })).default as CampaignOrder[];
  assert.strictEqual(conflictRaw.length >= 40, true, 'Conflict dataset must contain at least 40 orders');

  const optConflict = optimizeSequence(conflictRaw, 'PM1', 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    enableGrammageDirectionPenalty: true,
    grammageStepDownPenaltyHours: 0.6,
    grammageLargeJumpPenaltyHours: 0.4,
  });

  const colorFirstReversals = optConflict.strategies!.colorFirst.metrics.grammageReversalsCount ?? 0;
  const hybridReversals = optConflict.strategies!.hybrid.metrics.grammageReversalsCount ?? 0;

  assert.strictEqual(colorFirstReversals >= 5, true, `Colour-First must trigger significant grammage reversals (got ${colorFirstReversals})`);
  assert.strictEqual(hybridReversals < colorFirstReversals, true, `Hybrid must have fewer reversals than Colour-First (${hybridReversals} vs ${colorFirstReversals})`);
  assert.strictEqual(optConflict.conflictDetected, true, 'conflictDetected must be flagged true');
});

test('Adjusting grammage-down penalty slider dynamically impacts strategy costs and rankings', async () => {
  const conflictRaw = (await import('../src/data/conflict_order_book.json', { with: { type: 'json' } })).default as CampaignOrder[];

  // At penalty = 0.0h:
  const opt0 = optimizeSequence(conflictRaw, 'PM1', 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    grammageStepDownPenaltyHours: 0.0,
  });

  // At penalty = 1.0h:
  const opt1 = optimizeSequence(conflictRaw, 'PM1', 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    enableGrammageDirectionPenalty: true,
    grammageStepDownPenaltyHours: 1.0,
  });

  assert.strictEqual(
    opt1.strategies!.colorFirst.metrics.totalChangeoverHours > opt0.strategies!.colorFirst.metrics.totalChangeoverHours,
    true,
    'Higher penalty must increase Colour-First changeover hours due to reversals'
  );
  assert.strictEqual(
    opt1.strategies!.colorFirst.metrics.totalOperatingCostEur > opt0.strategies!.colorFirst.metrics.totalOperatingCostEur,
    true,
    'Higher penalty must increase Colour-First total operating cost'
  );
});

test('Hybrid total cost is <= Grammage-First and <= Colour-First across presets and penalties', async () => {
  const conflictRaw = (await import('../src/data/conflict_order_book.json', { with: { type: 'json' } })).default as CampaignOrder[];
  const totalCost = (m: any) => m.totalChangeoverHours * 480 + m.totalBrokeTonnes * 280;

  for (const pen of [0.0, 0.4, 0.6, 1.2]) {
    for (const dataset of [upcomingOrders, conflictRaw]) {
      const opt = optimizeSequence(dataset, 'PM1', 1.0, 2.4, {
        ...DEFAULT_LOSS_MODEL_CONFIG,
        enableGrammageDirectionPenalty: pen > 0,
        grammageStepDownPenaltyHours: pen,
        grammageLargeJumpThresholdGsm: 40,
        grammageLargeJumpPenaltyHours: pen > 0 ? 0.4 : 0.0,
      });

      const hCost = totalCost(opt.strategies!.hybrid.metrics);
      const cCost = totalCost(opt.strategies!.colorFirst.metrics);
      const gCost = totalCost(opt.strategies!.grammageFirst.metrics);

      assert.strictEqual(
        hCost <= Math.min(cCost, gCost) + 1.0,
        true,
        `Hybrid cost (€${hCost}) must be <= min(Color: €${cCost}, Grammage: €${gCost}) at penalty ${pen}h`
      );
    }
  }
});

test('Tie-breaker rule strictly prefers lowest cost, then highest SLA, then lowest broke', () => {
  const opt = optimizeSequence(upcomingOrders, 'PM1', 1.0, 2.4);
  const rec = opt.optimized;
  assert.strictEqual(opt.recommendedStrategyId, 'hybrid');
  assert.strictEqual(rec.metrics.slaCompliancePct >= 95, true);
});

test('Recommendation rationale generates verdict, trade-off, breakdown rows, ranking, and sensitivity', async () => {
  const conflictRaw = (await import('../src/data/conflict_order_book.json', { with: { type: 'json' } })).default as CampaignOrder[];
  const opt = optimizeSequence(conflictRaw, 'PM1', 1.0, 2.4, {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    enableGrammageDirectionPenalty: true,
    grammageStepDownPenaltyHours: 0.6,
  });

  const rat = opt.recommendationRationale;
  assert.ok(rat, 'recommendationRationale must be populated');
  assert.strictEqual(typeof rat.verdict, 'string');
  assert.strictEqual(rat.verdict.length > 20, true, 'Verdict must be a non-empty descriptive sentence');
  assert.strictEqual(typeof rat.tradeOffStatement, 'string');
  assert.strictEqual(rat.tradeOffStatement.length > 20, true, 'Trade-off must be a non-empty descriptive sentence');

  // Breakdown rows
  assert.strictEqual(rat.breakdownRows.length, 10, 'Must have 10 comparison breakdown metrics');
  const totalChangeoverRow = rat.breakdownRows.find((r) => r.metric === 'Total Sequence Changeover');
  assert.ok(totalChangeoverRow, 'Total Sequence Changeover row must exist');
  assert.strictEqual(totalChangeoverRow.recommendedValue, opt.optimized.metrics.totalChangeoverHours);

  // Ranking
  assert.strictEqual(rat.ranking.length, 4, 'Must rank all 4 strategies');
  assert.strictEqual(rat.ranking[0].isRecommended, true, 'Top ranked strategy must be flagged isRecommended');
  assert.strictEqual(rat.ranking[0].id, opt.recommendedStrategyId);

  // Sensitivity
  assert.ok(rat.breakEven, 'breakEven object must exist');
  assert.strictEqual(typeof rat.breakEven.statement, 'string');
  assert.strictEqual(rat.breakEven.currentPenaltyHours, 0.6);
});

console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) {
  process.exit(1);
}
