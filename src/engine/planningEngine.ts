import type {
  Product,
  InventoryItem,
  MachineCapacity,
  NetRequirement,
  MachineId,
} from '../types';

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
  totalMachineHoursRequired: number;
}

export function computeNetRequirements(
  products: Product[],
  inventory: InventoryItem[],
  machines: MachineCapacity[],
  totalForecastHorizonTonnes: number,
  safetyBufferDays: number = 10,
  pm1DowntimeHours: number = 0,
  pm2DowntimeHours: number = 0
): PlanningCalculationResult {
  const inventoryMap = new Map<string, InventoryItem>();
  inventory.forEach((inv) => inventoryMap.set(inv.sku_id, inv));

  const machineMap = new Map<MachineId, MachineCapacity>();
  machines.forEach((m) => machineMap.set(m.machine_id, m));

  const netRequirements: NetRequirement[] = [];
  let totalProductionTonnageRequired = 0;
  let totalMachineHoursRequired = 0;

  const machineHoursAccumulator: Record<MachineId, { hours: number; tonnes: number; count: number }> = {
    PM1: { hours: 0, tonnes: 0, count: 0 },
    PM2: { hours: 0, tonnes: 0, count: 0 },
  };

  products.forEach((p) => {
    const grossDemandTonnes = Math.round(totalForecastHorizonTonnes * p.demand_share * 10) / 10;
    const inv = inventoryMap.get(p.sku_id);

    const onHand = inv ? inv.on_hand_tonnes : 0;
    const allocated = inv ? inv.allocated_tonnes : 0;
    const available = Math.max(0, onHand - allocated);

    // Safety stock target scales with configured safety buffer days
    // Monthly consumption = grossDemandTonnes / horizonMonths; daily = monthly / 30
    const dailyDemand = grossDemandTonnes / (30 * 3); // 3 months benchmark
    const targetSafetyStock = Math.round(dailyDemand * safetyBufferDays * 10) / 10;

    // MRP formula: Net = max(0, Gross - Available + Safety)
    const rawNet = grossDemandTonnes - available + targetSafetyStock;
    const netRequirementTonnes = rawNet > 0 ? Math.round(rawNet * 10) / 10 : 0;

    const runHours = Math.round((netRequirementTonnes / p.nominal_speed_tph) * 10) / 10;

    let status: 'Surplus' | 'Balanced' | 'Production Needed' = 'Production Needed';
    if (netRequirementTonnes <= 0) {
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
      requiredMachineHours: runHours,
      status,
    });

    totalProductionTonnageRequired += netRequirementTonnes;
    totalMachineHoursRequired += runHours;

    machineHoursAccumulator[p.assigned_machine].hours += runHours;
    machineHoursAccumulator[p.assigned_machine].tonnes += netRequirementTonnes;
    machineHoursAccumulator[p.assigned_machine].count += 1;
  });

  // Calculate machine capacity loading summaries
  const machineLoading: Record<MachineId, MachineLoadingSummary> = {
    PM1: {
      machineId: 'PM1',
      machineName: machineMap.get('PM1')?.machine_name ?? 'PM1',
      nominalDeckleCm: machineMap.get('PM1')?.nominal_deckle_cm ?? 260,
      grossHours: 720,
      plannedMaintenanceHours: 48,
      scenarioDowntimeHours: pm1DowntimeHours,
      netAvailableHours: Math.max(10, 720 - 48 - pm1DowntimeHours),
      totalRunHoursRequired: Math.round(machineHoursAccumulator.PM1.hours * 10) / 10,
      totalTonnageRequired: Math.round(machineHoursAccumulator.PM1.tonnes * 10) / 10,
      utilizationPct: Math.round(
        (machineHoursAccumulator.PM1.hours / Math.max(10, 720 - 48 - pm1DowntimeHours)) * 1000
      ) / 10,
      headroomHours: Math.round(
        (Math.max(10, 720 - 48 - pm1DowntimeHours) - machineHoursAccumulator.PM1.hours) * 10
      ) / 10,
      isBottleneck:
        machineHoursAccumulator.PM1.hours / Math.max(10, 720 - 48 - pm1DowntimeHours) > 0.92,
      skusCount: machineHoursAccumulator.PM1.count,
    },
    PM2: {
      machineId: 'PM2',
      machineName: machineMap.get('PM2')?.machine_name ?? 'PM2',
      nominalDeckleCm: machineMap.get('PM2')?.nominal_deckle_cm ?? 285,
      grossHours: 720,
      plannedMaintenanceHours: 48,
      scenarioDowntimeHours: pm2DowntimeHours,
      netAvailableHours: Math.max(10, 720 - 48 - pm2DowntimeHours),
      totalRunHoursRequired: Math.round(machineHoursAccumulator.PM2.hours * 10) / 10,
      totalTonnageRequired: Math.round(machineHoursAccumulator.PM2.tonnes * 10) / 10,
      utilizationPct: Math.round(
        (machineHoursAccumulator.PM2.hours / Math.max(10, 720 - 48 - pm2DowntimeHours)) * 1000
      ) / 10,
      headroomHours: Math.round(
        (Math.max(10, 720 - 48 - pm2DowntimeHours) - machineHoursAccumulator.PM2.hours) * 10
      ) / 10,
      isBottleneck:
        machineHoursAccumulator.PM2.hours / Math.max(10, 720 - 48 - pm2DowntimeHours) > 0.92,
      skusCount: machineHoursAccumulator.PM2.count,
    },
  };

  return {
    horizonMonths: 3,
    totalForecastTonnes: totalForecastHorizonTonnes,
    netRequirements,
    machineLoading,
    totalProductionTonnageRequired: Math.round(totalProductionTonnageRequired * 10) / 10,
    totalMachineHoursRequired: Math.round(totalMachineHoursRequired * 10) / 10,
  };
}
