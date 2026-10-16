import upcomingOrdersRaw from '../src/data/upcoming_order_book.json' with { type: 'json' };
import { optimizeSequence } from '../src/engine/sequenceOptimizer';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../src/types/lossModel';
import type { CampaignOrder } from '../src/types';

const orders = upcomingOrdersRaw as CampaignOrder[];

// With penalty = 0.6h
const cfgWithPenalty = {
  ...DEFAULT_LOSS_MODEL_CONFIG,
  enableGrammageDirectionPenalty: true,
  grammageStepDownPenaltyHours: 0.6,
  grammageLargeJumpThresholdGsm: 40,
  grammageLargeJumpPenaltyHours: 0.4,
};
const resBefore = optimizeSequence(orders, 'PM1', 1.0, 2.4, cfgWithPenalty);

// Without penalty (penalty = 0.0h)
const cfgWithoutPenalty = {
  ...DEFAULT_LOSS_MODEL_CONFIG,
  enableGrammageDirectionPenalty: false,
  grammageStepDownPenaltyHours: 0.0,
  grammageLargeJumpThresholdGsm: 40,
  grammageLargeJumpPenaltyHours: 0.0,
};
const resAfter = optimizeSequence(orders, 'PM1', 1.0, 2.4, cfgWithoutPenalty);

console.log('=== BEFORE (Standard Campaign PM1 with 0.6h grammage step-down penalty) ===');
console.log('Naive:');
console.log('  Total Changeover Hours:', resBefore.naive.metrics.totalChangeoverHours);
console.log('  Total Broke Tonnes:    ', resBefore.naive.metrics.totalBrokeTonnes);
console.log('  Total Operating Cost:  €', resBefore.naive.metrics.totalOperatingCostEur);
console.log('  Total Broke Cost:      €', resBefore.naive.metrics.totalBrokeCostEur);
console.log('  Combined Total Cost:   €', resBefore.naive.metrics.totalOperatingCostEur + resBefore.naive.metrics.totalBrokeCostEur);
console.log('  Transition Cost:       €', Math.round(resBefore.naive.metrics.totalChangeoverHours * 480 + resBefore.naive.metrics.totalBrokeTonnes * 280));
console.log('  Reversals Count:       ', resBefore.naive.metrics.grammageReversalsCount);
console.log('  Washouts Count:        ', resBefore.naive.metrics.washoutCount);

console.log('Hybrid:');
console.log('  Total Changeover Hours:', resBefore.optimized.metrics.totalChangeoverHours);
console.log('  Total Broke Tonnes:    ', resBefore.optimized.metrics.totalBrokeTonnes);
console.log('  Total Operating Cost:  €', resBefore.optimized.metrics.totalOperatingCostEur);
console.log('  Total Broke Cost:      €', resBefore.optimized.metrics.totalBrokeCostEur);
console.log('  Combined Total Cost:   €', resBefore.optimized.metrics.totalOperatingCostEur + resBefore.optimized.metrics.totalBrokeCostEur);
console.log('  Transition Cost:       €', Math.round(resBefore.optimized.metrics.totalChangeoverHours * 480 + resBefore.optimized.metrics.totalBrokeTonnes * 280));
console.log('  Reversals Count:       ', resBefore.optimized.metrics.grammageReversalsCount);
console.log('  Washouts Count:        ', resBefore.optimized.metrics.washoutCount);

console.log('\n=== AFTER (Standard Campaign PM1 without penalty: 0.0h, symmetric grammage) ===');
console.log('Naive:');
console.log('  Total Changeover Hours:', resAfter.naive.metrics.totalChangeoverHours);
console.log('  Total Broke Tonnes:    ', resAfter.naive.metrics.totalBrokeTonnes);
console.log('  Total Operating Cost:  €', resAfter.naive.metrics.totalOperatingCostEur);
console.log('  Total Broke Cost:      €', resAfter.naive.metrics.totalBrokeCostEur);
console.log('  Combined Total Cost:   €', resAfter.naive.metrics.totalOperatingCostEur + resAfter.naive.metrics.totalBrokeCostEur);
console.log('  Transition Cost:       €', Math.round(resAfter.naive.metrics.totalChangeoverHours * 480 + resAfter.naive.metrics.totalBrokeTonnes * 280));
console.log('  Reversals Count:       ', resAfter.naive.metrics.grammageReversalsCount);
console.log('  Washouts Count:        ', resAfter.naive.metrics.washoutCount);

console.log('Hybrid:');
console.log('  Total Changeover Hours:', resAfter.optimized.metrics.totalChangeoverHours);
console.log('  Total Broke Tonnes:    ', resAfter.optimized.metrics.totalBrokeTonnes);
console.log('  Total Operating Cost:  €', resAfter.optimized.metrics.totalOperatingCostEur);
console.log('  Total Broke Cost:      €', resAfter.optimized.metrics.totalBrokeCostEur);
console.log('  Combined Total Cost:   €', resAfter.optimized.metrics.totalOperatingCostEur + resAfter.optimized.metrics.totalBrokeCostEur);
console.log('  Transition Cost:       €', Math.round(resAfter.optimized.metrics.totalChangeoverHours * 480 + resAfter.optimized.metrics.totalBrokeTonnes * 280));
console.log('  Reversals Count:       ', resAfter.optimized.metrics.grammageReversalsCount);
console.log('  Washouts Count:        ', resAfter.optimized.metrics.washoutCount);
