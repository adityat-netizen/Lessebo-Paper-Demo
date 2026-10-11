import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSkuYieldLosses,
  computeDynamicSafetyStock,
  computeInventoryCoverWeeks,
  buildWasteSummaryByComponent,
} from '../src/engine/lossModel';
import { calculateChangeover } from '../src/engine/changeoverCalculator';
import { optimizeSequence } from '../src/engine/sequenceOptimizer';
import { computeNetRequirements } from '../src/engine/planningEngine';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../src/types/lossModel';
import type { LossModelConfig } from '../src/types/lossModel';
import type { Product, CampaignOrder, InventoryItem, MachineCapacity } from '../src/types';

// Mock test product
const testProductSheetLight: Product = {
  sku_id: 'LP-TEST-01',
  brand_line: 'Lessebo Design',
  shade_name: 'White',
  shade_group: 'Ultra-Light',
  shade_hex: '#FAFAF8',
  shade_tier: 1,
  grammage_gsm: 90,
  format_type: 'Sheets',
  assigned_machine: 'PM1',
  nominal_speed_tph: 3.5,
  demand_share: 0.1,
  water_intensity_m3_per_tonne: 4.8,
  target_water_intensity: 4.2,
};

const testProductReelDark: Product = {
  sku_id: 'LP-TEST-02',
  brand_line: 'Lessebo Colours',
  shade_name: 'Pitch Black',
  shade_group: 'Dark',
  shade_hex: '#1E1E1E',
  shade_tier: 4,
  grammage_gsm: 240,
  format_type: 'Reels',
  assigned_machine: 'PM2',
  nominal_speed_tph: 4.0,
  demand_share: 0.05,
  water_intensity_m3_per_tonne: 6.2,
  target_water_intensity: 5.5,
};

describe('Waste & Yield Loss Model Engine Tests', () => {
  it('1. Sum(Component Losses) == Total Waste', () => {
    const config: LossModelConfig = {
      ...DEFAULT_LOSS_MODEL_CONFIG,
      enableWebBreakLoss: true,
      enableQualityRejects: true,
      enableTrimLoss: true,
      enableConvertingLoss: true,
      enableLotRounding: false,
    };

    const netTonnes = 120.0;
    const res = computeSkuYieldLosses(testProductSheetLight, netTonnes, config);

    const sumComponents = Math.round(
      (res.lossBreakdown.webBreakTonnes +
        res.lossBreakdown.qualityRejectTonnes +
        res.lossBreakdown.trimLossTonnes +
        res.lossBreakdown.convertingLossTonnes +
        res.lossBreakdown.lotRoundingSurplusTonnes) * 10
    ) / 10;

    assert.equal(sumComponents, res.lossBreakdown.totalNonSequenceLossTonnes);
    assert.equal(res.grossRequirementTonnes, Math.round((netTonnes + sumComponents) * 10) / 10);
    assert.equal(res.totalLossTonnes, sumComponents);
  });

  it('2. All components OFF yields Gross == Net and 0 Waste', () => {
    const allOffConfig: LossModelConfig = {
      enableChangeoverLoss: false,
      brokeRateTph: 2.4,
      colorTransitionMultiplier: 1.0,
      grammageStepMultiplier: 1.0,
      formatSwitchMultiplier: 1.0,
      enableStartupLoss: false,
      startupLossTonnesPerRun: 0.8,
      enableWashoutCleaningLoss: false,
      waterPerWashoutM3: 18.0,
      waterPerMinorWashM3: 6.0,
      enableWebBreakLoss: false,
      webBreakRateLightGsmPct: 2.2,
      webBreakRateMediumGsmPct: 1.6,
      webBreakRateHeavyGsmPct: 1.2,
      enableQualityRejects: false,
      rejectRateUltraLightPct: 0.8,
      rejectRateLightPct: 1.0,
      rejectRateMediumPct: 1.8,
      rejectRateDarkPct: 2.6,
      enableTrimLoss: false,
      trimLossSheetsPct: 3.4,
      trimLossReelsPct: 1.8,
      enableConvertingLoss: false,
      convertingLossSheetsPct: 2.0,
      convertingLossReelsPct: 0.5,
      enableForecastErrorBuffer: false,
      serviceLevelZ: 1.65,
      forecastVolatilityWeight: 1.0,
      enableLotRounding: false,
      minBatchTonnes: 5.0,
      enableSlowMoverFlag: false,
      maxCoverWeeksThreshold: 12.0,
      enableBrokeRecycling: false,
      maxFurnishRecycleCeilingPct: 15.0,
      repulpingCostEurPerTonne: 220,
    };

    const netTonnes = 85.5;
    const res = computeSkuYieldLosses(testProductSheetLight, netTonnes, allOffConfig);

    assert.equal(res.grossRequirementTonnes, netTonnes, 'Gross must equal Net when all loss components are disabled');
    assert.equal(res.totalLossTonnes, 0, 'Total loss must be 0 when all components are off');
    assert.equal(res.lossBreakdown.totalWasteTonnes, 0);
  });

  it('3. Gross >= Net invariant across various tonnages and products', () => {
    const testCases = [
      { product: testProductSheetLight, net: 0 },
      { product: testProductSheetLight, net: 1.5 },
      { product: testProductSheetLight, net: 50.0 },
      { product: testProductReelDark, net: 250.0 },
    ];

    for (const tc of testCases) {
      const res = computeSkuYieldLosses(tc.product, tc.net, DEFAULT_LOSS_MODEL_CONFIG);
      assert.ok(
        res.grossRequirementTonnes >= tc.net,
        `Gross (${res.grossRequirementTonnes}) must be >= Net (${tc.net})`
      );
      assert.ok(res.totalLossTonnes >= 0, `Total loss must be >= 0`);
    }
  });

  it('4. Sequence optimizer only alters sequence-dependent losses, leaving net product unchanged', () => {
    const orders: CampaignOrder[] = [
      {
        order_id: 'ORD-1',
        customer_name: 'Customer A',
        customer_priority: 'Standard',
        sku_id: 'LP-TEST-01',
        brand_line: 'Lessebo Design',
        shade_name: 'Pitch Black',
        shade_group: 'Dark',
        shade_hex: '#1E1E1E',
        shade_tier: 4,
        washout_group: 4,
        grammage_gsm: 120,
        format_type: 'Sheets',
        sheet_dimensions: '700x1000',
        assigned_machine: 'PM1',
        quantity_tonnes: 30,
        nominal_speed_tph: 3.5,
        production_hours: 8.6,
        due_in_days: 20,
        order_value_eur: 45000,
      },
      {
        order_id: 'ORD-2',
        customer_name: 'Customer B',
        customer_priority: 'Standard',
        sku_id: 'LP-TEST-02',
        brand_line: 'Lessebo Design',
        shade_name: 'White',
        shade_group: 'Ultra-Light',
        shade_hex: '#FAFAF8',
        shade_tier: 1,
        washout_group: 1,
        grammage_gsm: 90,
        format_type: 'Sheets',
        sheet_dimensions: '700x1000',
        assigned_machine: 'PM1',
        quantity_tonnes: 25,
        nominal_speed_tph: 3.5,
        production_hours: 7.1,
        due_in_days: 25,
        order_value_eur: 38000,
      },
      {
        order_id: 'ORD-3',
        customer_name: 'Customer C',
        customer_priority: 'Standard',
        sku_id: 'LP-TEST-03',
        brand_line: 'Lessebo Colours',
        shade_name: 'Pitch Black',
        shade_group: 'Dark',
        shade_hex: '#1E1E1E',
        shade_tier: 4,
        washout_group: 4,
        grammage_gsm: 120,
        format_type: 'Sheets',
        sheet_dimensions: '700x1000',
        assigned_machine: 'PM1',
        quantity_tonnes: 20,
        nominal_speed_tph: 3.5,
        production_hours: 5.7,
        due_in_days: 22,
        order_value_eur: 30000,
      },
    ];

    const result = optimizeSequence(orders, 'PM1', 1.0, 2.4, DEFAULT_LOSS_MODEL_CONFIG);

    // Sum of order tonnage is identical
    const naiveTonnes = result.naive.runs.reduce((s, r) => s + r.quantity_tonnes, 0);
    const optimizedTonnes = result.optimized.runs.reduce((s, r) => s + r.quantity_tonnes, 0);
    assert.equal(naiveTonnes, optimizedTonnes, 'Total campaign product tonnes must not change');

    // Sequence optimization saves changeover hours and broke tonnes
    assert.ok(
      result.optimized.metrics.totalChangeoverHours <= result.naive.metrics.totalChangeoverHours,
      'Optimized changeover hours should be <= naive changeover hours'
    );
    assert.ok(
      result.optimized.metrics.totalBrokeTonnes <= result.naive.metrics.totalBrokeTonnes,
      'Optimized broke tonnes should be <= naive broke tonnes'
    );
    assert.ok(
      (result.savings.waterSavedM3 ?? 0) >= 0,
      'Water saved m3 should be non-negative'
    );
  });

  it('5. Known inputs evaluate to expected tonnes', () => {
    // 90 gsm (light band -> 2.2% web break)
    // Sheets (3.4% trim loss)
    // Total loss rate = 2.2% + 3.4% = 5.6%
    // Yield = 1 - 0.056 = 0.944
    // Net = 100 tonnes -> Gross = 100 / 0.944 = 105.932 -> 105.9 tonnes
    const net = 100.0;
    const res = computeSkuYieldLosses(testProductSheetLight, net, DEFAULT_LOSS_MODEL_CONFIG);

    assert.equal(res.grossRequirementTonnes, 105.9, 'Expected gross tonnes for 100t net demand');
    assert.equal(res.totalLossTonnes, 5.9, 'Expected total loss tonnes');
    assert.equal(res.lossBreakdown.trimLossTonnes, 3.6); // 105.9 * 3.4% = 3.6
    assert.equal(res.lossBreakdown.webBreakTonnes, 2.3); // 105.9 * 2.2% = 2.33 -> 2.3
  });

  it('6. Dynamic forecast-error buffer scales safety stock target', () => {
    const dailyDemand = 10.0;
    const baseDays = 10;

    // Disabled error buffer: dailyDemand * baseDays = 100.0
    const staticBuffer = computeDynamicSafetyStock(dailyDemand, baseDays, 10.0, {
      ...DEFAULT_LOSS_MODEL_CONFIG,
      enableForecastErrorBuffer: false,
    });
    assert.equal(staticBuffer, 100.0);

    // Enabled error buffer with 15% MAPE: higher buffer
    const dynamicBufferHighMape = computeDynamicSafetyStock(dailyDemand, baseDays, 15.0, {
      ...DEFAULT_LOSS_MODEL_CONFIG,
      enableForecastErrorBuffer: true,
    });
    assert.ok(
      dynamicBufferHighMape > staticBuffer,
      `Dynamic buffer (${dynamicBufferHighMape}) should be greater than static buffer (${staticBuffer})`
    );
  });

  it('7. Broke recycling ceiling warning triggers when broke exceeds ceiling', () => {
    const orders: CampaignOrder[] = [
      {
        order_id: 'ORD-A',
        customer_name: 'Customer A',
        customer_priority: 'Standard',
        sku_id: 'LP-TEST-01',
        brand_line: 'Lessebo Design',
        shade_name: 'White',
        shade_group: 'Ultra-Light',
        shade_hex: '#FAFAF8',
        shade_tier: 1,
        washout_group: 1,
        grammage_gsm: 90,
        format_type: 'Sheets',
        sheet_dimensions: '700x1000',
        assigned_machine: 'PM1',
        quantity_tonnes: 5, // small batch to elevate broke ratio
        nominal_speed_tph: 3.5,
        production_hours: 1.4,
        due_in_days: 10,
        order_value_eur: 7500,
      },
    ];

    const configWithStrictCeiling: LossModelConfig = {
      ...DEFAULT_LOSS_MODEL_CONFIG,
      enableBrokeRecycling: true,
      maxFurnishRecycleCeilingPct: 5.0, // strict 5% ceiling
      brokeRateTph: 5.0, // high broke rate
    };

    const res = optimizeSequence(orders, 'PM1', 1.0, 5.0, configWithStrictCeiling);
    assert.ok(res.naive.metrics.brokeFurnishPct !== undefined);
    assert.ok(res.naive.metrics.brokeRecycleExceeded === true);
  });
});
