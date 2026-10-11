import type {
  Product,
  InventoryItem,
  MachineCapacity,
  CampaignOrder,
} from '../types';
import type {
  ScenarioParameters,
  ScenarioEvaluation,
  FeasibilityStatus,
} from '../types/scenarioWorkbench';
import { computeForecast } from './forecastEngine';
import { computeNetRequirements } from './planningEngine';
import { optimizeSequence } from './sequenceOptimizer';
import salesRaw from '../data/sales_orders_monthly.json';

export function evaluateScenario(
  params: ScenarioParameters,
  products: Product[],
  inventory: InventoryItem[],
  machines: MachineCapacity[],
  upcomingOrders: CampaignOrder[],
  forecastHorizonMonths: 3 | 6 | 12 = 3
): ScenarioEvaluation {
  // 1. Forecast calculation with shade adjustments
  const shadeMultiplierWeight =
    (params.whiteDemandMult * 0.5 +
      params.ivoryDemandMult * 0.25 +
      params.colorDemandMult * 0.25);

  const effectiveDemandDeltaPct = Math.round(
    ((1 + params.demandDeltaPct / 100) * shadeMultiplierWeight - 1) * 1000
  ) / 10;

  const forecast = computeForecast(
    salesRaw.monthly_records,
    products,
    forecastHorizonMonths,
    effectiveDemandDeltaPct
  );

  const totalForecastTonnes = Math.round(
    forecast.forecastPoints.reduce((sum, pt) => sum + pt.forecastTonnes, 0) * 10
  ) / 10;

  // 2. Planning calculation with downtime and safety buffer
  const planning = computeNetRequirements(
    products,
    inventory,
    machines,
    totalForecastTonnes,
    params.safetyBufferDays,
    params.pm1DowntimeHours,
    params.pm2DowntimeHours
  );

  // 3. Machine Available and Required Hours adjusted by speed factor
  const speed = Math.max(0.5, Math.min(2.0, params.productionSpeedMultiplier || 1.0));
  const horizonMonths = forecastHorizonMonths || 3;

  const pm1NetAvailableHours = Math.max(
    1,
    Math.round(planning.machineLoading.PM1.netAvailableHours * horizonMonths * 10) / 10
  );
  const pm2NetAvailableHours = Math.max(
    1,
    Math.round(planning.machineLoading.PM2.netAvailableHours * horizonMonths * 10) / 10
  );

  const pm1RequiredHours = Math.round(
    (planning.machineLoading.PM1.totalRunHoursRequired / speed) * 10
  ) / 10;
  const pm2RequiredHours = Math.round(
    (planning.machineLoading.PM2.totalRunHoursRequired / speed) * 10
  ) / 10;

  const pm1UtilizationPct = Math.round(
    (pm1RequiredHours / pm1NetAvailableHours) * 1000
  ) / 10;
  const pm2UtilizationPct = Math.round(
    (pm2RequiredHours / pm2NetAvailableHours) * 1000
  ) / 10;

  const totalAvailable = pm1NetAvailableHours + pm2NetAvailableHours;
  const totalRequired = pm1RequiredHours + pm2RequiredHours;
  const combinedUtilizationPct = Math.round(
    (totalRequired / totalAvailable) * 1000
  ) / 10;

  // 4. Sequencing calculations (PM1 as hero machine, evaluated against changeover parameters)
  const sequence = optimizeSequence(
    upcomingOrders,
    'PM1',
    params.washoutMultiplier,
    params.brokeRateTph
  );

  const totalChangeoverHours = sequence.optimized.metrics.totalChangeoverHours;
  const totalBrokeTonnes = sequence.optimized.metrics.totalBrokeTonnes;

  // 5. Cost calculations
  const totalOperatingHours = pm1RequiredHours + pm2RequiredHours + totalChangeoverHours;
  const totalOperatingCostEur = Math.round(
    totalOperatingHours * (params.hourlyOperatingCostEur || 480)
  );
  const totalBrokeCostEur = Math.round(
    totalBrokeTonnes * (params.brokeCostPerTonneEur || 280)
  );
  const totalFinancialCostEur = totalOperatingCostEur + totalBrokeCostEur;

  // 6. SLA and Orders at Risk calculations
  // High utilization and urgent orders introduce schedule tension
  const urgentTension = (params.urgentOrderSharePct - 15) * 0.3;
  const utilizationTension = Math.max(0, combinedUtilizationPct - 90) * 0.8;
  const penalty = Math.max(0, urgentTension + utilizationTension);

  const rawSla = sequence.optimized.metrics.slaCompliancePct - penalty;
  const slaCompliancePct = Math.max(50, Math.min(100, Math.round(rawSla * 10) / 10));

  let ordersAtRiskCount = 0;
  sequence.optimized.runs.forEach((r) => {
    if (!r.meetsSla || (combinedUtilizationPct > 98 && r.customer_priority === 'High - Strict SLA')) {
      ordersAtRiskCount += 1;
    }
  });

  // 7. Feasibility Determination
  let feasibilityStatus: FeasibilityStatus = 'Feasible';
  let feasibilityReason = 'Plan is fully feasible with healthy capacity headroom.';

  if (pm1UtilizationPct > 115 || pm2UtilizationPct > 115 || combinedUtilizationPct > 110) {
    feasibilityStatus = 'Infeasible';
    feasibilityReason = `Excess capacity demand: PM1 at ${pm1UtilizationPct}%, PM2 at ${pm2UtilizationPct}%. Schedule cannot be fulfilled without unassigned overtime or load shifting.`;
  } else if (
    pm1UtilizationPct > 95 ||
    pm2UtilizationPct > 95 ||
    combinedUtilizationPct > 92 ||
    ordersAtRiskCount >= 3 ||
    slaCompliancePct < 90
  ) {
    feasibilityStatus = 'Capacity-Constrained';
    feasibilityReason = `High machine utilization (${combinedUtilizationPct}%) with ${ordersAtRiskCount} order(s) near SLA deadline threshold.`;
  } else {
    feasibilityStatus = 'Feasible';
    feasibilityReason = `Balanced loading across both machines (${combinedUtilizationPct}% combined). All changeover sequences and customer delivery SLAs accommodated.`;
  }

  return {
    totalForecastTonnes,
    netRequiredTonnes: planning.totalProductionTonnageRequired,
    pm1NetAvailableHours,
    pm2NetAvailableHours,
    pm1RequiredHours,
    pm2RequiredHours,
    pm1UtilizationPct,
    pm2UtilizationPct,
    combinedUtilizationPct,
    totalChangeoverHours,
    totalBrokeTonnes,
    totalOperatingCostEur,
    totalBrokeCostEur,
    totalFinancialCostEur,
    slaCompliancePct,
    ordersAtRiskCount,
    feasibilityStatus,
    feasibilityReason,
  };
}
