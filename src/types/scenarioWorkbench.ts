export interface ScenarioParameters {
  // 1. Demand Adjustments
  demandDeltaPct: number; // -30% to +50%
  whiteDemandMult: number; // 0.5x to 2.0x
  ivoryDemandMult: number; // 0.5x to 2.0x
  colorDemandMult: number; // 0.5x to 2.0x
  urgentOrderSharePct: number; // 0% to 40%

  // 2. Machine Capacity & Availability
  pm1DowntimeHours: number; // 0 to 120h
  pm2DowntimeHours: number; // 0 to 120h
  productionSpeedMultiplier: number; // 0.8x to 1.2x

  // 3. Inventory & Safety Stock Buffer
  safetyBufferDays: number; // 0 to 30 days

  // 4. Sequencing & Changeover Parameters
  baseSetupHours: number; // 0.2h to 2.0h
  washoutMultiplier: number; // 0.5x to 2.5x
  grammageStepMultiplier: number; // 0.5x to 2.0x
  formatSwitchMultiplier: number; // 0.5x to 2.0x
  brokeRateTph: number; // 1.0 to 5.0 t/h (Client input required)

  // 5. Cost Parameters
  hourlyOperatingCostEur: number; // 300 to 800 EUR/h (Client input required)
  brokeCostPerTonneEur: number; // 150 to 450 EUR/t (Client input required)

  // 6. Waste & Yield Loss Parameters (Client input required - Generic placeholders)
  enableWasteModel?: boolean;
  enableQualityRejects?: boolean;
  enableConvertingLoss?: boolean;
  enableLotRounding?: boolean;
  enableSlowMoverFlag?: boolean;
  enableBrokeRecycling?: boolean;
  trimLossSheetsPct?: number;
  trimLossReelsPct?: number;
  webBreakRateLightGsmPct?: number;
  maxFurnishRecycleCeilingPct?: number;
}

export type FeasibilityStatus = 'Feasible' | 'Capacity-Constrained' | 'Infeasible';

export interface ScenarioEvaluation {
  totalForecastTonnes: number;
  netRequiredTonnes: number;
  grossRequiredTonnes: number;
  totalYieldLossTonnes: number;
  totalYieldPct: number;
  pm1NetAvailableHours: number;
  pm2NetAvailableHours: number;
  pm1RequiredHours: number;
  pm2RequiredHours: number;
  pm1UtilizationPct: number;
  pm2UtilizationPct: number;
  combinedUtilizationPct: number;
  totalChangeoverHours: number;
  totalBrokeTonnes: number;
  totalOperatingCostEur: number;
  totalBrokeCostEur: number;
  totalFinancialCostEur: number;
  slaCompliancePct: number;
  ordersAtRiskCount: number;
  feasibilityStatus: FeasibilityStatus;
  feasibilityReason: string;
  washoutWaterM3?: number;
  brokeFurnishPct?: number;
  brokeRecycleExceeded?: boolean;
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  description: string;
  isLockedBaseline?: boolean;
  createdAt: string;
  updatedAt: string;
  parameters: ScenarioParameters;
}

export const BASELINE_PARAMETERS: ScenarioParameters = {
  demandDeltaPct: 0,
  whiteDemandMult: 1.0,
  ivoryDemandMult: 1.0,
  colorDemandMult: 1.0,
  urgentOrderSharePct: 15,
  pm1DowntimeHours: 0,
  pm2DowntimeHours: 0,
  productionSpeedMultiplier: 1.0,
  safetyBufferDays: 10,
  baseSetupHours: 0.5,
  washoutMultiplier: 1.0,
  grammageStepMultiplier: 1.0,
  formatSwitchMultiplier: 1.0,
  brokeRateTph: 2.4,
  hourlyOperatingCostEur: 480,
  brokeCostPerTonneEur: 280,
  enableWasteModel: true,
  enableQualityRejects: false,
  enableConvertingLoss: false,
  enableLotRounding: false,
  enableSlowMoverFlag: false,
  enableBrokeRecycling: false,
  trimLossSheetsPct: 3.4,
  trimLossReelsPct: 1.8,
  webBreakRateLightGsmPct: 2.2,
  maxFurnishRecycleCeilingPct: 15.0,
};

export const INITIAL_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'baseline',
    name: 'Baseline Mill Plan',
    description: 'Standard organic demand (+0%), nominal machine uptime, 10d safety stock buffer.',
    isLockedBaseline: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    parameters: { ...BASELINE_PARAMETERS },
  },
  {
    id: 'peak_demand',
    name: 'Q4 Packaging Surge (+25%)',
    description: 'Autumn luxury packaging spike; higher White & Colors volume; 14d safety buffer.',
    isLockedBaseline: false,
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-01-02T10:00:00Z',
    parameters: {
      ...BASELINE_PARAMETERS,
      demandDeltaPct: 25,
      whiteDemandMult: 1.25,
      colorDemandMult: 1.2,
      safetyBufferDays: 14,
      urgentOrderSharePct: 22,
    },
  },
  {
    id: 'pm1_maintenance',
    name: 'PM1 Maintenance Outage (-48h)',
    description: 'Planned 48h headbox rebuild on PM1; tests capacity reallocation and SLA preservation.',
    isLockedBaseline: false,
    createdAt: '2026-01-03T09:00:00Z',
    updatedAt: '2026-01-03T09:00:00Z',
    parameters: {
      ...BASELINE_PARAMETERS,
      pm1DowntimeHours: 48,
      safetyBufferDays: 12,
    },
  },
  {
    id: 'vip_luxury_rush',
    name: 'VIP Luxury Rush Orders (35% Urgent)',
    description: 'Surge in tight-deadline short runs requiring strict washouts and rapid format changes.',
    isLockedBaseline: false,
    createdAt: '2026-01-04T14:30:00Z',
    updatedAt: '2026-01-04T14:30:00Z',
    parameters: {
      ...BASELINE_PARAMETERS,
      demandDeltaPct: 10,
      urgentOrderSharePct: 35,
      washoutMultiplier: 1.25,
      safetyBufferDays: 8,
    },
  },
  {
    id: 'raw_material_stress',
    name: 'Raw Material Conservation (High Broke Penalty)',
    description: 'Tight pulp market scenario: fiber broke cost elevated to €360/t; focus on sequence optimization.',
    isLockedBaseline: false,
    createdAt: '2026-01-05T11:15:00Z',
    updatedAt: '2026-01-05T11:15:00Z',
    parameters: {
      ...BASELINE_PARAMETERS,
      brokeRateTph: 3.2,
      brokeCostPerTonneEur: 360,
      washoutMultiplier: 1.2,
      hourlyOperatingCostEur: 520,
    },
  },
];
