import assert from 'node:assert';
import { buildCsvContent } from '../src/utils/csvExport.ts';
import { evaluateScenario } from '../src/engine/scenarioEvaluator.ts';
import {
  BASELINE_PARAMETERS,
  INITIAL_SCENARIOS,
  type ScenarioParameters,
} from '../src/types/scenarioWorkbench.ts';

import productsRaw from '../src/data/products.json' with { type: 'json' };
import inventoryRaw from '../src/data/current_inventory.json' with { type: 'json' };
import machineCapacityRaw from '../src/data/machine_capacity.json' with { type: 'json' };
import upcomingOrdersRaw from '../src/data/upcoming_order_book.json' with { type: 'json' };
import type { Product, InventoryItem, MachineCapacity, CampaignOrder } from '../src/types/index.ts';

const products = productsRaw as Product[];
const inventory = inventoryRaw as InventoryItem[];
const machineCapacity = machineCapacityRaw as MachineCapacity[];
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

console.log('\n--- Running Lessebo Paper Demo QA & Verification Test Suite ---\n');

// 1. CSV Generator and RFC 4180 Tests
test('CSV starts with UTF-8 BOM (\\uFEFF)', () => {
  const csv = buildCsvContent(
    { datasetName: 'Test Dataset', scenarioName: 'Test Scenario' },
    [{ key: 'col1', label: 'Column 1' }],
    [{ col1: 'Value' }]
  );
  assert.strictEqual(csv.startsWith('\uFEFF'), true, 'CSV must start with UTF-8 BOM');
});

test('CSV contains mandatory synthetic notice banner', () => {
  const csv = buildCsvContent(
    { datasetName: 'Test Dataset', scenarioName: 'Test Scenario' },
    [{ key: 'col1', label: 'Column 1' }],
    [{ col1: 'Value' }]
  );
  assert.strictEqual(
    csv.includes('# Notice: Illustrative / Synthetic - Not actual Lessebo results'),
    true,
    'Synthetic notice must be present in metadata header'
  );
});

test('CSV properly escapes double quotes, commas, and newlines per RFC 4180', () => {
  const csv = buildCsvContent(
    { datasetName: 'Escaping Test', scenarioName: 'Test' },
    [
      { key: 'quoted', label: 'Quoted Header' },
      { key: 'comma', label: 'Comma Header' },
      { key: 'newline', label: 'Newline Header' },
    ],
    [
      {
        quoted: 'Value with "quotes" inside',
        comma: 'Value, with comma',
        newline: 'Value with\nnewline',
      },
    ]
  );

  // Quotes inside must be doubled and wrapped
  assert.strictEqual(
    csv.includes('"Value with ""quotes"" inside"'),
    true,
    'Double quotes must be escaped as ""'
  );
  // Comma must be wrapped
  assert.strictEqual(
    csv.includes('"Value, with comma"'),
    true,
    'Fields with commas must be double-quoted'
  );
  // Newline must be wrapped
  assert.strictEqual(
    csv.includes('"Value with\nnewline"'),
    true,
    'Fields with newlines must be double-quoted'
  );
});

test('CSV formats unit in column headers cleanly', () => {
  const csv = buildCsvContent(
    { datasetName: 'Header Units Test', scenarioName: 'Test' },
    [
      { key: 'qty', label: 'Run Quantity', unit: 'tonnes' },
      { key: 'speed', label: 'Operating Speed', unit: 't/h' },
    ],
    [{ qty: 150, speed: 12.5 }]
  );

  assert.strictEqual(
    csv.includes('Run Quantity (tonnes)'),
    true,
    'Unit must be appended in parentheses'
  );
  assert.strictEqual(
    csv.includes('Operating Speed (t/h)'),
    true,
    'Unit must be appended in parentheses'
  );
});

test('CSV planning export contains gross production and yield loss columns', () => {
  const csv = buildCsvContent(
    {
      datasetName: 'Gross & Net Production Requirements',
      assumptions: { YieldLossAllowance: '+12.4 tonnes' },
    },
    [
      { key: 'net_req', label: 'Net Demand Need', unit: 'tonnes' },
      { key: 'loss', label: 'Expected Yield Loss', unit: 'tonnes' },
      { key: 'gross_req', label: 'GROSS Production Req.', unit: 'tonnes' },
      { key: 'trim_loss', label: 'Slitter Trim Loss', unit: 'tonnes' },
      { key: 'web_break', label: 'Web-Break Broke', unit: 'tonnes' },
    ],
    [{ net_req: 100, loss: 5.5, gross_req: 105.5, trim_loss: 3.4, web_break: 2.1 }]
  );

  assert.strictEqual(csv.includes('GROSS Production Req. (tonnes)'), true);
  assert.strictEqual(csv.includes('Expected Yield Loss (tonnes)'), true);
  assert.strictEqual(csv.includes('Slitter Trim Loss (tonnes)'), true);
  assert.strictEqual(csv.includes('Web-Break Broke (tonnes)'), true);
});

test('CSV sequence export contains itemized broke and water columns', () => {
  const csv = buildCsvContent(
    { datasetName: 'Optimized Production Run Sequence' },
    [
      { key: 'color_broke', label: 'Color Transition Broke', unit: 'tonnes' },
      { key: 'grammage_broke', label: 'Grammage Delta Broke', unit: 'tonnes' },
      { key: 'startup_broke', label: 'Start-up Calibration Broke', unit: 'tonnes' },
      { key: 'washout_water', label: 'Washout Effluent Water', unit: 'm3' },
    ],
    [{ color_broke: 1.2, grammage_broke: 0.8, startup_broke: 0.8, washout_water: 18 }]
  );

  assert.strictEqual(csv.includes('Color Transition Broke (tonnes)'), true);
  assert.strictEqual(csv.includes('Grammage Delta Broke (tonnes)'), true);
  assert.strictEqual(csv.includes('Start-up Calibration Broke (tonnes)'), true);
  assert.strictEqual(csv.includes('Washout Effluent Water (m3)'), true);
});

test('CSV scenario comparison matrix contains gross demand, yield losses, and furnish recycling', () => {
  const csv = buildCsvContent(
    { datasetName: 'Side-by-Side What-If Scenario Impact Matrix' },
    [
      { key: 'metric', label: 'Operational & Financial Metric' },
      { key: 'unit', label: 'Unit' },
      { key: 'baseline_val', label: 'Baseline Mill Plan' },
    ],
    [
      { metric: 'Gross Production Requirement', unit: 'tonnes', baseline_val: 1850 },
      { metric: 'Total Expected Yield Losses', unit: 'tonnes', baseline_val: 82.5 },
      { metric: 'Washout Cleaning Effluent Water', unit: 'm3', baseline_val: 54 },
      { metric: 'Broke Furnish Recycling Ratio', unit: '%', baseline_val: 8.2 },
    ]
  );

  assert.strictEqual(csv.includes('Gross Production Requirement'), true);
  assert.strictEqual(csv.includes('Total Expected Yield Losses'), true);
  assert.strictEqual(csv.includes('Washout Cleaning Effluent Water'), true);
  assert.strictEqual(csv.includes('Broke Furnish Recycling Ratio'), true);
});

// 2. Scenario Evaluator & Invariant Tests
test('Baseline scenario evaluates to Feasible with healthy headroom', () => {
  const evalResult = evaluateScenario(
    BASELINE_PARAMETERS,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(evalResult.feasibilityStatus, 'Feasible');
  assert.strictEqual(evalResult.combinedUtilizationPct <= 92, true);
  assert.strictEqual(evalResult.slaCompliancePct >= 90, true);
  assert.strictEqual(Number.isNaN(evalResult.combinedUtilizationPct), false);
  assert.strictEqual(Number.isNaN(evalResult.totalFinancialCostEur), false);
});

test('High demand surge (+40%) transitions feasibility to Capacity-Constrained or Infeasible', () => {
  const surgeParams: ScenarioParameters = {
    ...BASELINE_PARAMETERS,
    demandDeltaPct: 40,
    pm1DowntimeHours: 48,
  };

  const evalResult = evaluateScenario(
    surgeParams,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(
    evalResult.feasibilityStatus === 'Capacity-Constrained' ||
      evalResult.feasibilityStatus === 'Infeasible',
    true,
    'Surge + downtime should indicate bottleneck'
  );
  assert.strictEqual(evalResult.pm1UtilizationPct > 95, true);
});

test('Extreme downtime (120h) triggers Infeasible status without NaN or crash', () => {
  const extremeParams: ScenarioParameters = {
    ...BASELINE_PARAMETERS,
    pm1DowntimeHours: 120,
    pm2DowntimeHours: 120,
    demandDeltaPct: 30,
  };

  const evalResult = evaluateScenario(
    extremeParams,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(evalResult.feasibilityStatus, 'Infeasible');
  assert.strictEqual(Number.isNaN(evalResult.pm1UtilizationPct), false);
  assert.strictEqual(Number.isNaN(evalResult.pm2UtilizationPct), false);
  assert.strictEqual(Number.isNaN(evalResult.totalFinancialCostEur), false);
});

test('Production line speed throttling (80%) increases machine required hours', () => {
  const baseResult = evaluateScenario(
    BASELINE_PARAMETERS,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  const throttledParams: ScenarioParameters = {
    ...BASELINE_PARAMETERS,
    productionSpeedMultiplier: 0.8,
  };

  const throttledResult = evaluateScenario(
    throttledParams,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(
    throttledResult.pm1RequiredHours > baseResult.pm1RequiredHours,
    true,
    'Throttled speed should require more machine hours'
  );
  assert.strictEqual(
    throttledResult.combinedUtilizationPct > baseResult.combinedUtilizationPct,
    true,
    'Throttled speed should increase utilization percentage'
  );
});

test('Initial scenarios contain locked Baseline and minimum 5 presets', () => {
  assert.strictEqual(INITIAL_SCENARIOS.length >= 5, true, 'At least 5 presets must exist');
  const baseline = INITIAL_SCENARIOS.find((s) => s.id === 'baseline');
  assert.strictEqual(!!baseline, true, 'Baseline scenario must exist');
  assert.strictEqual(baseline?.isLockedBaseline, true, 'Baseline must be locked');
});

// 3. Scenario Waste & Yield Loss Model Tests
test('Scenario evaluation calculates Gross Production >= Net Requirement and tracks Total Yield Losses', () => {
  const evalResult = evaluateScenario(
    BASELINE_PARAMETERS,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(evalResult.grossRequiredTonnes >= evalResult.netRequiredTonnes, true);
  assert.strictEqual(evalResult.totalYieldLossTonnes > 0, true);
  assert.strictEqual(evalResult.totalYieldPct > 0 && evalResult.totalYieldPct <= 100, true);
  assert.strictEqual(typeof evalResult.washoutWaterM3, 'number');
  assert.strictEqual(typeof evalResult.brokeFurnishPct, 'number');
});

test('Scenario evaluation with enableWasteModel=false yields Gross == Net and 0 losses', () => {
  const noWasteParams: ScenarioParameters = {
    ...BASELINE_PARAMETERS,
    enableWasteModel: false,
  };

  const evalResult = evaluateScenario(
    noWasteParams,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(evalResult.grossRequiredTonnes, evalResult.netRequiredTonnes);
  assert.strictEqual(evalResult.totalYieldLossTonnes, 0);
  assert.strictEqual(evalResult.totalYieldPct, 100);
});

test('Scenario with broke recycling ceiling enabled flags constraint when ceiling exceeded', () => {
  const tightCeilingParams: ScenarioParameters = {
    ...BASELINE_PARAMETERS,
    enableBrokeRecycling: true,
    maxFurnishRecycleCeilingPct: 2.0, // unrealistically low ceiling to force trigger
  };

  const evalResult = evaluateScenario(
    tightCeilingParams,
    products,
    inventory,
    machineCapacity,
    upcomingOrders,
    3
  );

  assert.strictEqual(evalResult.brokeRecycleExceeded, true);
  assert.strictEqual(evalResult.feasibilityStatus, 'Capacity-Constrained');
  assert.strictEqual(evalResult.feasibilityReason.includes('Furnish broke recycling ratio'), true);
});

console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---\n`);

if (failed > 0) {
  process.exit(1);
}
