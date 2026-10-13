export interface SkuLossBreakdown {
  // Non-sequence losses (grossed up on net requirement)
  webBreakTonnes: number;
  qualityRejectTonnes: number;
  trimLossTonnes: number;
  convertingLossTonnes: number;
  lotRoundingSurplusTonnes: number;
  totalNonSequenceLossTonnes: number;

  // Sequence losses allocated/estimated
  estimatedChangeoverBrokeTonnes: number;
  estimatedStartupBrokeTonnes: number;
  estimatedWashoutWaterM3: number;
  totalSequenceLossTonnes: number;

  // Total waste for this SKU
  totalWasteTonnes: number;
}

export interface LossModelConfig {
  // --- Sequence-Dependent Components ---
  // Component 1: Changeover Broke (split into color, grammage, format)
  enableChangeoverLoss: boolean;
  brokeRateTph: number; // default 2.4 t/h (Client input required)
  colorTransitionMultiplier: number; // default 1.0x (Client input required)
  grammageStepMultiplier: number; // default 1.0x (Client input required)
  formatSwitchMultiplier: number; // default 1.0x (Client input required)

  // Direction-Aware Grammage Transition Penalties (Generic placeholder - Client input required)
  enableGrammageDirectionPenalty?: boolean;
  grammageStepDownPenaltyHours?: number; // default 0.0 (Client input required)
  grammageLargeJumpThresholdGsm?: number; // default 40 gsm (Client input required)
  grammageLargeJumpPenaltyHours?: number; // default 0.0 (Client input required)

  // Component 2: Start-up / Restart Broke
  enableStartupLoss: boolean;
  startupLossTonnesPerRun: number; // default 0.8 t per run (Client input required)

  // Component 3: Washout and Cleaning Loss (Water & chemicals)
  enableWashoutCleaningLoss: boolean;
  waterPerWashoutM3: number; // default 18.0 m3 per deep washout (Client input required)
  waterPerMinorWashM3: number; // default 6.0 m3 per minor wash (Client input required)

  // --- Non-Sequence-Dependent Components ---
  // Component 4: Web-Break Broke (by grammage band)
  enableWebBreakLoss: boolean;
  webBreakRateLightGsmPct: number; // <= 100 gsm: default 2.2% (Client input required)
  webBreakRateMediumGsmPct: number; // 101 - 150 gsm: default 1.6% (Client input required)
  webBreakRateHeavyGsmPct: number; // > 150 gsm: default 1.2% (Client input required)

  // Component 5: Quality Rejects (by shade family) - Default OFF
  enableQualityRejects: boolean;
  rejectRateUltraLightPct: number; // default 0.8% (Client input required)
  rejectRateLightPct: number; // default 1.0% (Client input required)
  rejectRateMediumPct: number; // default 1.8% (Client input required)
  rejectRateDarkPct: number; // default 2.6% (Client input required)

  // Component 6: Trim Loss (edge slitting & deckle fit)
  enableTrimLoss: boolean;
  trimLossSheetsPct: number; // default 3.4% (Client input required)
  trimLossReelsPct: number; // default 1.8% (Client input required)

  // Component 7: Converting & Finishing Loss - Default OFF
  enableConvertingLoss: boolean;
  convertingLossSheetsPct: number; // default 2.0% (Client input required)
  convertingLossReelsPct: number; // default 0.5% (Client input required)

  // --- Planning-Side Components ---
  // Component 8: Forecast-Error Dynamic Buffer (sized from MAPE/RMSE history)
  enableForecastErrorBuffer: boolean;
  serviceLevelZ: number; // default 1.65 (95% service level) (Client input required)
  forecastVolatilityWeight: number; // default 1.0x (Client input required)

  // Component 9: Minimum Run Length / Lot Rounding - Default OFF
  enableLotRounding: boolean;
  minBatchTonnes: number; // default 5.0 t (Client input required)

  // Component 10: Slow-Mover / Inventory Obsolescence Flag - Default OFF
  enableSlowMoverFlag: boolean;
  maxCoverWeeksThreshold: number; // default 12.0 weeks (Client input required)

  // Component 11: Broke Recycling & Furnish Ceiling - Default OFF
  enableBrokeRecycling: boolean;
  maxFurnishRecycleCeilingPct: number; // default 15.0% (Client input required)
  repulpingCostEurPerTonne: number; // default 220 EUR/t (Client input required)
}

export const DEFAULT_LOSS_MODEL_CONFIG: LossModelConfig = {
  // Sequence-dependent (Core)
  enableChangeoverLoss: true,
  brokeRateTph: 2.4,
  colorTransitionMultiplier: 1.0,
  grammageStepMultiplier: 1.0,
  formatSwitchMultiplier: 1.0,

  enableStartupLoss: true,
  startupLossTonnesPerRun: 0.8,

  // Direction-aware grammage (Defaults off / 0 for backward compatibility)
  enableGrammageDirectionPenalty: false,
  grammageStepDownPenaltyHours: 0.0,
  grammageLargeJumpThresholdGsm: 40,
  grammageLargeJumpPenaltyHours: 0.0,

  enableWashoutCleaningLoss: true,
  waterPerWashoutM3: 18.0,
  waterPerMinorWashM3: 6.0,

  // Non-sequence-dependent (Core)
  enableWebBreakLoss: true,
  webBreakRateLightGsmPct: 2.2,
  webBreakRateMediumGsmPct: 1.6,
  webBreakRateHeavyGsmPct: 1.2,

  enableQualityRejects: false,
  rejectRateUltraLightPct: 0.8,
  rejectRateLightPct: 1.0,
  rejectRateMediumPct: 1.8,
  rejectRateDarkPct: 2.6,

  enableTrimLoss: true,
  trimLossSheetsPct: 3.4,
  trimLossReelsPct: 1.8,

  enableConvertingLoss: false,
  convertingLossSheetsPct: 2.0,
  convertingLossReelsPct: 0.5,

  // Planning-side (Core & optional)
  enableForecastErrorBuffer: true,
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

export interface WasteSummaryByComponent {
  componentId: string;
  componentName: string;
  category: 'Sequence-Dependent' | 'Non-Sequence' | 'Planning-Buffer';
  isSequenceDependent: boolean;
  isEnabled: boolean;
  lossTonnes: number;
  wastePercentageOfGross: number;
  machineHoursLost: number;
  estimatedCostEur: number;
  environmentalMetric?: string;
  clientInputTag: string;
}
