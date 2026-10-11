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

console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---\n`);

if (failed > 0) {
  process.exit(1);
}
