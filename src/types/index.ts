export type ShadeGroup = 'Ultra-Light' | 'Light' | 'Medium' | 'Dark';
export type FormatType = 'Sheets' | 'Reels';
export type MachineId = 'PM1' | 'PM2';
export type CustomerPriority = 'High - Strict SLA' | 'Medium' | 'Standard';

export interface Product {
  sku_id: string;
  brand_line: string;
  shade_name: string;
  shade_group: ShadeGroup;
  shade_hex: string;
  shade_tier: number;
  washout_group: number;
  grammage_gsm: number;
  format_type: FormatType;
  sheet_dimensions: string | null;
  assigned_machine: MachineId;
  nominal_speed_tph: number;
  price_per_tonne_eur: number;
  demand_weight: number;
  demand_share: number;
}

export interface MonthlyRecord {
  month_index: number;
  month_str: string;
  year: number;
  month: number;
  total_tonnes: number;
  total_revenue_eur: number;
  seasonal_index: number;
  trend_baseline_tonnes: number;
  sku_tonnes: Record<string, number>;
}

export interface SampleOrder {
  order_id: string;
  order_date: string;
  delivery_date: string;
  customer_name: string;
  customer_tier: string;
  customer_country: string;
  sku_id: string;
  shade_name: string;
  grammage_gsm: number;
  format_type: FormatType;
  quantity_tonnes: number;
  revenue_eur: number;
}

export interface SalesHistoryData {
  metadata: {
    title: string;
    start_date: string;
    end_date: string;
    months_count: number;
    total_orders_sample_count: number;
    label: string;
  };
  monthly_records: MonthlyRecord[];
  sample_orders: SampleOrder[];
}

export interface InventoryItem {
  sku_id: string;
  brand_line: string;
  shade_name: string;
  grammage_gsm: number;
  format_type: FormatType;
  on_hand_tonnes: number;
  allocated_tonnes: number;
  available_tonnes: number;
  safety_stock_target_tonnes: number;
  stock_status: 'Sufficient' | 'Low';
}

export interface MachineCapacity {
  machine_id: MachineId;
  machine_name: string;
  assigned_grammages: string;
  nominal_deckle_cm: number;
  gross_hours_per_month: number;
  planned_maintenance_hours: number;
  net_operating_hours: number;
  hourly_operating_cost_eur: number;
  broke_cost_per_tonne_eur: number;
  changeover_broke_tph: number;
  virgin_fiber_cost_per_tonne_eur: number;
}

export interface ChangeoverRules {
  base_setup_hours: number;
  washout_hours: {
    ultra_light_to_light: number;
    light_to_medium: number;
    medium_to_dark: number;
    same_shade: number;
    light_to_ultra_light: number;
    medium_to_light: number;
    dark_to_light: number;
    dark_to_ultra_light: number;
    cross_dark_to_dark: number;
  };
  grammage_step_hours: {
    same: number;
    small_step_under_40gsm: number;
    large_step_over_40gsm: number;
  };
  format_change_hours: {
    same: number;
    sheet_dimension_change: number;
    reel_to_sheet_switch: number;
  };
  broke_rate_tph: number;
}

export interface CampaignOrder {
  order_id: string;
  customer_name: string;
  customer_priority: CustomerPriority;
  sku_id: string;
  brand_line: string;
  shade_name: string;
  shade_group: ShadeGroup;
  shade_hex: string;
  shade_tier: number;
  washout_group: number;
  grammage_gsm: number;
  format_type: FormatType;
  sheet_dimensions: string | null;
  assigned_machine: MachineId;
  quantity_tonnes: number;
  nominal_speed_tph: number;
  production_hours: number;
  due_in_days: number;
  order_value_eur: number;
}

export interface ChangeoverBreakdown {
  baseSetup: number;
  washoutHours: number;
  grammageHours: number;
  formatHours: number;
  totalHours: number;
  isWashout: boolean;
  brokeTonnes: number;
  reason: string;
}

export interface ScheduledRun extends CampaignOrder {
  runSequence: number;
  startHour: number;
  endHour: number;
  changeoverHours: number;
  changeoverBreakdown: ChangeoverBreakdown;
  brokeTonnes: number;
  isWashout: boolean;
  meetsSla: boolean;
  completionDay: number;
  explainability: {
    title: string;
    badges: { text: string; type: 'success' | 'warning' | 'info' | 'neutral' }[];
    reasons: string[];
  };
}

export interface ScheduleMetrics {
  totalRuns: number;
  totalProductionHours: number;
  totalChangeoverHours: number;
  totalBrokeTonnes: number;
  washoutCount: number;
  totalOperatingCostEur: number;
  totalBrokeCostEur: number;
  slaCompliancePct: number;
  totalSpanHours: number;
}

export interface OptimizationComparison {
  naive: {
    runs: ScheduledRun[];
    metrics: ScheduleMetrics;
  };
  optimized: {
    runs: ScheduledRun[];
    metrics: ScheduleMetrics;
  };
  savings: {
    changeoverHoursSaved: number;
    brokeTonnesSaved: number;
    capacityReleasedHours: number;
    financialSavingsEur: number;
    washoutsAvoided: number;
  };
}

export interface NetRequirement {
  sku_id: string;
  brand_line: string;
  shade_name: string;
  shade_group: ShadeGroup;
  shade_hex: string;
  grammage_gsm: number;
  format_type: FormatType;
  assigned_machine: MachineId;
  forecastDemandTonnes: number;
  onHandStockTonnes: number;
  allocatedStockTonnes: number;
  availableStockTonnes: number;
  safetyStockTargetTonnes: number;
  netProductionRequirementTonnes: number;
  requiredMachineHours: number;
  status: 'Surplus' | 'Balanced' | 'Production Needed';
}

export interface ForecastPoint {
  monthIndex: number;
  monthStr: string;
  year: number;
  month: number;
  isForecast: boolean;
  historicalTonnes?: number;
  forecastTonnes: number;
  trendBaselineTonnes: number;
  seasonalMultiplier: number;
  lowerBoundTonnes: number;
  upperBoundTonnes: number;
}

export type PresetScenarioId = 'baseline' | 'peak_demand' | 'pm1_breakdown' | 'vip_rush';

export interface ScenarioState {
  activePreset: PresetScenarioId;
  demandDeltaPct: number; // e.g. 0 to +25
  pm1DowntimeHours: number; // 0 to 48
  safetyBufferDays: number; // 7 to 21
  washoutMultiplier: number; // 1.0 to 1.5
  horizonMonths: 3 | 6 | 12;
  selectedRunId: string | null;
}
