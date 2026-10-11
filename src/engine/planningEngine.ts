import type {
  Product,
  InventoryItem,
  MachineCapacity,
  NetRequirement,
  MachineId,
} from '../types';
import type {
  LossModelConfig,
  WasteSummaryByComponent,
} from '../types/lossModel';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../types/lossModel';
import {
  computeSkuYieldLosses,
  computeDynamicSafetyStock,
  computeInventoryCoverWeeks,
  buildWasteSummaryByComponent,
} from './lossModel';

export interface MachineLoadingSummary {
  machineId: MachineId;
  machineName: string;
  nominalDeckleCm: number;
  grossHours: number;
  plannedMaintenanceHours: number;
  scenarioDowntimeHours: number;
  netAvailableHours: number;
  totalRunHoursRequired: number;
  totalTonnageRequired: number;
  utilizationPct: number;
  headroomHours: number;
  isBottleneck: boolean;
  skusCount: number;
}

export interface PlanningCalculationResult {
  horizonMonths: number;
  totalForecastTonnes: number;
  netRequirements: NetRequirement[];
  machineLoading: Record<MachineId, MachineLoadingSummary>;
  totalProductionTonnageRequired: number;
  totalGrossTonnageRequired: number;
  totalLossTonnes: number;
  totalMachineHoursRequired: number;
  lossConfig: LossModelConfig;
  wasteSummary: WasteSummaryByComponent[];
}

export function computeNetRequirements(
  products: Product[],
  inventory: InventoryItem[],
  machines: MachineCapacity[],
  totalForecastHorizonTonnes: number,
  safetyBufferDays: number = 10,
  pm1DowntimeHours: number = 0,
  pm2DowntimeHours: number = 0,
  lossConfig: LossModelConfig = DEFAULT_LOSS_MODEL_CONFIG,
  horizonMonths: number = 3
): PlanningCalculationResult {
  const inventoryMap = new Map<string, InventoryItem>();
  inventory.forEach((inv) => inventoryMap.set(inv.sku_id, inv));

  const machineMap = new Map<MachineId, MachineCapacity>();
  machines.forEach((m) => machineMap.set(m.machine_id, m));

  const netRequirements: NetRequirement[] = [];
  let totalProductionTonnageRequired = 0;
  let totalGrossTonnageRequired = 0;
  let totalLossTonnes = 0;
  let totalMachineHoursRequired = 0;

  const machineHoursAccumulator: Record<MachineId, { hours: number; tonnes: number; count: number }> = {
    PM1: { hours: 0, tonnes: 0, count: 0 },
    PM2: { hours: 0, tonnes: 0, count: 0 },
  };

  const aggregateLoss = {
    webBreakTonnes: 0,
    qualityRejectTonnes: 0,
    trimLossTonnes: 0,
    convertingLossTonnes: 0,
    lotRoundingSurplusTonnes: 0,
  };

  products.forEach((p) => {
    const grossDemandTonnes = Math.round(totalForecastHorizonTonnes * p.demand_share * 10) / 10;
    const inv = inventoryMap.get(p.sku_id);

    const onHand = inv ? inv.on_hand_tonnes : 0;
    const allocated = inv ? inv.allocated_tonnes : 0;
    const available = Math.max(0, onHand - allocated);

    // Safety stock target scales with configured safety buffer days and dynamic forecast error buffer (Component 8)
    const dailyDemand = grossDemandTonnes / (30 * horizonMonths);
    const skuMape = (p as any).historical_mape_pct ?? (p.demand_share > 0.05 ? 8.5 : 14.2);
    const targetSafetyStock = computeDynamicSafetyStock(dailyDemand, safetyBufferDays, skuMape, lossConfig);

    // MRP formula: Net = max(0, Gross Demand - Available Stock + Safety Stock Target)
    const rawNet = grossDemandTonnes - available + targetSafetyStock;
    const netRequirementTonnes = rawNet > 0 ? Math.round(rawNet * 10) / 10 : 0;

    // Yield & Waste Loss Model (Components 4, 5, 6, 7, 9)
    const {
      grossRequirementTonnes,
      totalLossTonnes: skuLossTonnes,
      lossBreakdown,
    } = computeSkuYieldLosses(p, netRequirementTonnes, lossConfig);

    // Production machine run hours are calculated on GROSS production requirement
    const grossRunHours = Math.round((grossRequirementTonnes / p.nominal_speed_tph) * 10) / 10;

    // Component 10: Inventory Cover Weeks & Slow Mover Flag
    const monthlyDemand = grossDemandTonnes / horizonMonths;
    const coverWeeks = computeInventoryCoverWeeks(available, monthlyDemand);
    const isSlowMover = lossConfig.enableSlowMoverFlag && coverWeeks > lossConfig.maxCoverWeeksThreshold;
    const excessStockTonnes = isSlowMover ? Math.max(0, Math.round((available - targetSafetyStock) * 10) / 10) : 0;

    let status: 'Surplus' | 'Balanced' | 'Production Needed' = 'Production Needed';
    if (grossRequirementTonnes <= 0) {
      status = available > targetSafetyStock * 1.5 ? 'Surplus' : 'Balanced';
    }

    netRequirements.push({
      sku_id: p.sku_id,
      brand_line: p.brand_line,
      shade_name: p.shade_name,
      shade_group: p.shade_group,
      shade_hex: p.shade_hex,
      grammage_gsm: p.grammage_gsm,
      format_type: p.format_type,
      assigned_machine: p.assigned_machine,
      forecastDemandTonnes: grossDemandTonnes,
      onHandStockTonnes: onHand,
      allocatedStockTonnes: allocated,
      availableStockTonnes: available,
      safetyStockTargetTonnes: targetSafetyStock,
      netProductionRequirementTonnes: netRequirementTonnes,
      requiredMachineHours: grossRunHours,
      grossProductionRequirementTonnes: grossRequirementTonnes,
      totalLossTonnes: skuLossTonnes,
      grossMachineHours: grossRunHours,
      lossBreakdown,
      inventoryCoverWeeks: coverWeeks,
      isSlowMover,
      excessStockTonnes,
      status,
    });

    totalProductionTonnageRequired += netRequirementTonnes;
    totalGrossTonnageRequired += grossRequirementTonnes;
    totalLossTonnes += skuLossTonnes;
    totalMachineHoursRequired += grossRunHours;

    aggregateLoss.webBreakTonnes += lossBreakdown.webBreakTonnes;
    aggregateLoss.qualityRejectTonnes += lossBreakdown.qualityRejectTonnes;
    aggregateLoss.trimLossTonnes += lossBreakdown.trimLossTonnes;
    aggregateLoss.convertingLossTonnes += lossBreakdown.convertingLossTonnes;
    aggregateLoss.lotRoundingSurplusTonnes += lossBreakdown.lotRoundingSurplusTonnes;

    machineHoursAccumulator[p.assigned_machine].hours += grossRunHours;
    machineHoursAccumulator[p.assigned_machine].tonnes += grossRequirementTonnes;
    machineHoursAccumulator[p.assigned_machine].count += 1;
  });

  const grossAvailableHoursPerMonth = 720;
  const maintenanceHoursPerMonth = 48;
  const grossHoursHorizon = grossAvailableHoursPerMonth * horizonMonths;
  const maintHoursHorizon = maintenanceHoursPerMonth * horizonMonths;

  const machineLoading: Record<MachineId, MachineLoadingSummary> = {
    PM1: {
      machineId: 'PM1',
      machineName: machineMap.get('PM1')?.machine_name ?? 'PM1',
      nominalDeckleCm: machineMap.get('PM1')?.nominal_deckle_cm ?? 260,
      grossHours: grossHoursHorizon,
      plannedMaintenanceHours: maintHoursHorizon,
      scenarioDowntimeHours: pm1DowntimeHours,
      netAvailableHours: Math.max(10, grossHoursHorizon - maintHoursHorizon - pm1DowntimeHours),
      totalRunHoursRequired: Math.round(machineHoursAccumulator.PM1.hours * 10) / 10,
      totalTonnageRequired: Math.round(machineHoursAccumulator.PM1.tonnes * 10) / 10,
      utilizationPct: Math.round(
        (machineHoursAccumulator.PM1.hours / Math.max(10, grossHoursHorizon - maintHoursHorizon - pm1DowntimeHours)) * 1000
      ) / 10,
      headroomHours: Math.round(
        (Math.max(10, grossHoursHorizon - maintHoursHorizon - pm1DowntimeHours) - machineHoursAccumulator.PM1.hours) * 10
      ) / 10,
      isBottleneck:
        machineHoursAccumulator.PM1.hours / Math.max(10, grossHoursHorizon - maintHoursHorizon - pm1DowntimeHours) > 0.92,
      skusCount: machineHoursAccumulator.PM1.count,
    },
    PM2: {
      machineId: 'PM2',
      machineName: machineMap.get('PM2')?.machine_name ?? 'PM2',
      nominalDeckleCm: machineMap.get('PM2')?.nominal_deckle_cm ?? 285,
      grossHours: grossHoursHorizon,
      plannedMaintenanceHours: maintHoursHorizon,
      scenarioDowntimeHours: pm2DowntimeHours,
      netAvailableHours: Math.max(10, grossHoursHorizon - maintHoursHorizon - pm2DowntimeHours),
      totalRunHoursRequired: Math.round(machineHoursAccumulator.PM2.hours * 10) / 10,
      totalTonnageRequired: Math.round(machineHoursAccumulator.PM2.tonnes * 10) / 10,
      utilizationPct: Math.round(
        (machineHoursAccumulator.PM2.hours / Math.max(10, grossHoursHorizon - maintHoursHorizon - pm2DowntimeHours)) * 1000
      ) / 10,
      headroomHours: Math.round(
        (Math.max(10, grossHoursHorizon - maintHoursHorizon - pm2DowntimeHours) - machineHoursAccumulator.PM2.hours) * 10
      ) / 10,
      isBottleneck:
        machineHoursAccumulator.PM2.hours / Math.max(10, grossHoursHorizon - maintHoursHorizon - pm2DowntimeHours) > 0.92,
      skusCount: machineHoursAccumulator.PM2.count,
    },
  };

  // Build high-level component waste summary
  const wasteSummary = buildWasteSummaryByComponent(
    lossConfig,
    totalProductionTonnageRequired,
    totalGrossTonnageRequired,
    {
      colorBrokeTonnes: 0,
      grammageBrokeTonnes: 0,
      formatBrokeTonnes: 0,
      startupBrokeTonnes: 0,
      washoutWaterM3: 0,
      totalHours: 0,
    },
    {
      webBreakTonnes: Math.round(aggregateLoss.webBreakTonnes * 10) / 10,
      qualityRejectTonnes: Math.round(aggregateLoss.qualityRejectTonnes * 10) / 10,
      trimLossTonnes: Math.round(aggregateLoss.trimLossTonnes * 10) / 10,
      convertingLossTonnes: Math.round(aggregateLoss.convertingLossTonnes * 10) / 10,
      lotRoundingSurplusTonnes: Math.round(aggregateLoss.lotRoundingSurplusTonnes * 10) / 10,
    }
  );

  return {
    horizonMonths,
    totalForecastTonnes: totalForecastHorizonTonnes,
    netRequirements,
    machineLoading,
    totalProductionTonnageRequired: Math.round(totalProductionTonnageRequired * 10) / 10,
    totalGrossTonnageRequired: Math.round(totalGrossTonnageRequired * 10) / 10,
    totalLossTonnes: Math.round(totalLossTonnes * 10) / 10,
    totalMachineHoursRequired: Math.round(totalMachineHoursRequired * 10) / 10,
    lossConfig,
    wasteSummary,
  };
}
