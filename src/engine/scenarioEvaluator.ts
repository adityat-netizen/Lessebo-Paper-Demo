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
import type { LossModelConfig } from '../types/lossModel';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../types/lossModel';
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
  // Construct loss model configuration for this scenario
  const lossModelConfig: LossModelConfig = {
    ...DEFAULT_LOSS_MODEL_CONFIG,
    brokeRateTph: params.brokeRateTph ?? DEFAULT_LOSS_MODEL_CONFIG.brokeRateTph,
    grammageStepMultiplier: params.grammageStepMultiplier ?? DEFAULT_LOSS_MODEL_CONFIG.grammageStepMultiplier,
    formatSwitchMultiplier: params.formatSwitchMultiplier ?? DEFAULT_LOSS_MODEL_CONFIG.formatSwitchMultiplier,
    enableQualityRejects: params.enableQualityRejects ?? DEFAULT_LOSS_MODEL_CONFIG.enableQualityRejects,
    enableConvertingLoss: params.enableConvertingLoss ?? DEFAULT_LOSS_MODEL_CONFIG.enableConvertingLoss,
    enableLotRounding: params.enableLotRounding ?? DEFAULT_LOSS_MODEL_CONFIG.enableLotRounding,
    enableSlowMoverFlag: params.enableSlowMoverFlag ?? DEFAULT_LOSS_MODEL_CONFIG.enableSlowMoverFlag,
    enableBrokeRecycling: params.enableBrokeRecycling ?? DEFAULT_LOSS_MODEL_CONFIG.enableBrokeRecycling,
    trimLossSheetsPct: params.trimLossSheetsPct ?? DEFAULT_LOSS_MODEL_CONFIG.trimLossSheetsPct,
    trimLossReelsPct: params.trimLossReelsPct ?? DEFAULT_LOSS_MODEL_CONFIG.trimLossReelsPct,
    webBreakRateLightGsmPct: params.webBreakRateLightGsmPct ?? DEFAULT_LOSS_MODEL_CONFIG.webBreakRateLightGsmPct,
    maxFurnishRecycleCeilingPct: params.maxFurnishRecycleCeilingPct ?? DEFAULT_LOSS_MODEL_CONFIG.maxFurnishRecycleCeilingPct,
  };

  if (params.enableWasteModel === false) {
    lossModelConfig.enableChangeoverLoss = false;
    lossModelConfig.enableStartupLoss = false;
    lossModelConfig.enableWashoutCleaningLoss = false;
    lossModelConfig.enableWebBreakLoss = false;
    lossModelConfig.enableQualityRejects = false;
    lossModelConfig.enableTrimLoss = false;
    lossModelConfig.enableConvertingLoss = false;
    lossModelConfig.enableForecastErrorBuffer = false;
    lossModelConfig.enableLotRounding = false;
    lossModelConfig.enableSlowMoverFlag = false;
    lossModelConfig.enableBrokeRecycling = false;
  }

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

  const horizonMonths = forecastHorizonMonths || 3;

  // 2. Planning calculation with gross production requirements and loss model
  const planning = computeNetRequirements(
    products,
    inventory,
    machines,
    totalForecastTonnes,
    params.safetyBufferDays,
    params.pm1DowntimeHours,
    params.pm2DowntimeHours,
    lossModelConfig,
    horizonMonths
  );

  // 3. Machine Available and Required Hours adjusted by speed factor
  const speed = Math.max(0.5, Math.min(2.0, params.productionSpeedMultiplier || 1.0));

  const pm1NetAvailableHours = Math.max(1, planning.machineLoading.PM1.netAvailableHours);
  const pm2NetAvailableHours = Math.max(1, planning.machineLoading.PM2.netAvailableHours);

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

  // 4. Sequencing calculations (PM1 as hero machine, evaluated against changeover parameters and loss model)
  const sequence = optimizeSequence(
    upcomingOrders,
    'PM1',
    params.washoutMultiplier,
    params.brokeRateTph,
    lossModelConfig
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

  const brokeRecycleExceeded =
    lossModelConfig.enableBrokeRecycling &&
    (sequence.optimized.metrics.brokeRecycleExceeded ||
      (sequence.optimized.metrics.brokeFurnishPct ?? 0) > (lossModelConfig.maxFurnishRecycleCeilingPct ?? 15));

  if (pm1UtilizationPct > 115 || pm2UtilizationPct > 115 || combinedUtilizationPct > 110) {
    feasibilityStatus = 'Infeasible';
    feasibilityReason = `Excess capacity demand: PM1 at ${pm1UtilizationPct}%, PM2 at ${pm2UtilizationPct}%. Schedule cannot be fulfilled without unassigned overtime or load shifting.`;
  } else if (
    pm1UtilizationPct > 95 ||
    pm2UtilizationPct > 95 ||
    combinedUtilizationPct > 92 ||
    ordersAtRiskCount >= 3 ||
    slaCompliancePct < 90 ||
    brokeRecycleExceeded
  ) {
    feasibilityStatus = 'Capacity-Constrained';
    if (brokeRecycleExceeded) {
      feasibilityReason = `Furnish broke recycling ratio (${(sequence.optimized.metrics.brokeFurnishPct ?? 0).toFixed(1)}%) exceeds maximum safe repulping ceiling (${lossModelConfig.maxFurnishRecycleCeilingPct}%). Excess broke cannot be repulped without off-spec risk.`;
    } else {
      feasibilityReason = `High machine utilization (${combinedUtilizationPct}%) with ${ordersAtRiskCount} order(s) near SLA deadline threshold.`;
    }
  } else {
    feasibilityStatus = 'Feasible';
    feasibilityReason = `Balanced loading across both machines (${combinedUtilizationPct}% combined). All changeover sequences and customer delivery SLAs accommodated.`;
  }

  const grossRequiredTonnes = planning.totalGrossTonnageRequired ?? planning.totalProductionTonnageRequired;
  const totalYieldLossTonnes = planning.totalLossTonnes ?? 0;
  const totalYieldPct =
    grossRequiredTonnes > 0
      ? Math.round((planning.totalProductionTonnageRequired / grossRequiredTonnes) * 1000) / 10
      : 100;

  return {
    totalForecastTonnes,
    netRequiredTonnes: planning.totalProductionTonnageRequired,
    grossRequiredTonnes,
    totalYieldLossTonnes,
    totalYieldPct,
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
    washoutWaterM3: sequence.optimized.metrics.totalWashoutWaterM3 ?? 0,
    brokeFurnishPct: sequence.optimized.metrics.brokeFurnishPct ?? 0,
    brokeRecycleExceeded,
  };
}
