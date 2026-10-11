import type { Product } from '../types';
import type {
  LossModelConfig,
  SkuLossBreakdown,
  WasteSummaryByComponent,
} from '../types/lossModel';

export function computeSkuYieldLosses(
  product: Product,
  netDemandTonnes: number,
  config: LossModelConfig
): {
  grossRequirementTonnes: number;
  totalLossTonnes: number;
  lossBreakdown: SkuLossBreakdown;
} {
  if (netDemandTonnes <= 0) {
    return {
      grossRequirementTonnes: 0,
      totalLossTonnes: 0,
      lossBreakdown: {
        webBreakTonnes: 0,
        qualityRejectTonnes: 0,
        trimLossTonnes: 0,
        convertingLossTonnes: 0,
        lotRoundingSurplusTonnes: 0,
        totalNonSequenceLossTonnes: 0,
        estimatedChangeoverBrokeTonnes: 0,
        estimatedStartupBrokeTonnes: 0,
        estimatedWashoutWaterM3: 0,
        totalSequenceLossTonnes: 0,
        totalWasteTonnes: 0,
      },
    };
  }

  // 1. Web-break rate by grammage
  let webBreakRate = 0;
  if (config.enableWebBreakLoss) {
    if (product.grammage_gsm <= 100) {
      webBreakRate = config.webBreakRateLightGsmPct / 100;
    } else if (product.grammage_gsm <= 150) {
      webBreakRate = config.webBreakRateMediumGsmPct / 100;
    } else {
      webBreakRate = config.webBreakRateHeavyGsmPct / 100;
    }
  }

  // 2. Quality rejects by shade family
  let qualityRejectRate = 0;
  if (config.enableQualityRejects) {
    switch (product.shade_group) {
      case 'Ultra-Light':
        qualityRejectRate = config.rejectRateUltraLightPct / 100;
        break;
      case 'Light':
        qualityRejectRate = config.rejectRateLightPct / 100;
        break;
      case 'Medium':
        qualityRejectRate = config.rejectRateMediumPct / 100;
        break;
      case 'Dark':
        qualityRejectRate = config.rejectRateDarkPct / 100;
        break;
    }
  }

  // 3. Trim loss by format
  let trimLossRate = 0;
  if (config.enableTrimLoss) {
    trimLossRate =
      product.format_type === 'Sheets'
        ? config.trimLossSheetsPct / 100
        : config.trimLossReelsPct / 100;
  }

  // 4. Converting / finishing loss
  let convertingLossRate = 0;
  if (config.enableConvertingLoss) {
    convertingLossRate =
      product.format_type === 'Sheets'
        ? config.convertingLossSheetsPct / 100
        : config.convertingLossReelsPct / 100;
  }

  // Aggregate non-sequence loss rate
  const totalLossRate = webBreakRate + qualityRejectRate + trimLossRate + convertingLossRate;

  // Gross-up formula: Gross = Net / (1 - LossRate)
  // Protected against division by zero if loss rate is excessive
  const effectiveYield = Math.max(0.4, 1 - totalLossRate);
  let grossBeforeLotRounding = Math.round((netDemandTonnes / effectiveYield) * 10) / 10;

  // Breakdown of losses from the grossed tonnage
  const webBreakTonnes = Math.round(grossBeforeLotRounding * webBreakRate * 10) / 10;
  const qualityRejectTonnes = Math.round(grossBeforeLotRounding * qualityRejectRate * 10) / 10;
  const trimLossTonnes = Math.round(grossBeforeLotRounding * trimLossRate * 10) / 10;
  const convertingLossTonnes = Math.round(grossBeforeLotRounding * convertingLossRate * 10) / 10;

  // 5. Lot rounding / minimum batch size
  let lotRoundingSurplusTonnes = 0;
  let finalGross = grossBeforeLotRounding;
  if (config.enableLotRounding && config.minBatchTonnes > 0) {
    if (finalGross < config.minBatchTonnes) {
      lotRoundingSurplusTonnes = Math.round((config.minBatchTonnes - finalGross) * 10) / 10;
      finalGross = config.minBatchTonnes;
    }
  }

  const totalNonSequenceLossTonnes = Math.round(
    (webBreakTonnes + qualityRejectTonnes + trimLossTonnes + convertingLossTonnes + lotRoundingSurplusTonnes) * 10
  ) / 10;

  const totalLossTonnes = Math.round((finalGross - netDemandTonnes) * 10) / 10;

  return {
    grossRequirementTonnes: finalGross,
    totalLossTonnes: Math.max(0, totalLossTonnes),
    lossBreakdown: {
      webBreakTonnes,
      qualityRejectTonnes,
      trimLossTonnes,
      convertingLossTonnes,
      lotRoundingSurplusTonnes,
      totalNonSequenceLossTonnes,
      estimatedChangeoverBrokeTonnes: 0,
      estimatedStartupBrokeTonnes: 0,
      estimatedWashoutWaterM3: 0,
      totalSequenceLossTonnes: 0,
      totalWasteTonnes: Math.max(0, totalLossTonnes),
    },
  };
}

export function computeDynamicSafetyStock(
  dailyDemandTonnes: number,
  baseSafetyBufferDays: number,
  skuMapePct: number,
  config: LossModelConfig
): number {
  if (!config.enableForecastErrorBuffer) {
    // Standard safety stock calculation
    return Math.round(dailyDemandTonnes * baseSafetyBufferDays * 10) / 10;
  }

  // Sized dynamically from historical forecast error (MAPE) and service level Z
  // Standard error proportional to MAPE
  const demandStdDev = dailyDemandTonnes * (skuMapePct / 100) * config.forecastVolatilityWeight;
  const leadTimeDays = Math.max(3, Math.min(21, baseSafetyBufferDays));
  const dynamicBuffer = config.serviceLevelZ * demandStdDev * Math.sqrt(leadTimeDays);

  const targetTonnes = Math.max(
    dailyDemandTonnes * 2, // minimum 2 days cover
    Math.round((dailyDemandTonnes * baseSafetyBufferDays + dynamicBuffer) * 10) / 10
  );

  return Math.round(targetTonnes * 10) / 10;
}

export function computeInventoryCoverWeeks(
  onHandAvailableTonnes: number,
  monthlyDemandTonnes: number
): number {
  const weeklyConsumption = monthlyDemandTonnes / 4.33;
  if (weeklyConsumption <= 0) return 0;
  return Math.round((onHandAvailableTonnes / weeklyConsumption) * 10) / 10;
}

export function buildWasteSummaryByComponent(
  config: LossModelConfig,
  _totalNetDemandTonnes: number,
  totalGrossProductionTonnes: number,
  sequenceBrokeBreakdown: {
    colorBrokeTonnes: number;
    grammageBrokeTonnes: number;
    formatBrokeTonnes: number;
    startupBrokeTonnes: number;
    washoutWaterM3: number;
    totalHours: number;
  },
  nonSequenceBreakdown: {
    webBreakTonnes: number;
    qualityRejectTonnes: number;
    trimLossTonnes: number;
    convertingLossTonnes: number;
    lotRoundingSurplusTonnes: number;
  },
  hourlyMachineCostEur: number = 480,
  brokeValuationCostEur: number = 280
): WasteSummaryByComponent[] {
  const totalGross = Math.max(1, totalGrossProductionTonnes);

  const components: WasteSummaryByComponent[] = [
    // 1. Color Washout Broke
    {
      componentId: 'color_washout_broke',
      componentName: 'Color Washout Transition Broke',
      category: 'Sequence-Dependent',
      isSequenceDependent: true,
      isEnabled: config.enableChangeoverLoss,
      lossTonnes: sequenceBrokeBreakdown.colorBrokeTonnes,
      wastePercentageOfGross: Math.round((sequenceBrokeBreakdown.colorBrokeTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((sequenceBrokeBreakdown.colorBrokeTonnes / config.brokeRateTph) * 10) / 10,
      estimatedCostEur: Math.round(
        sequenceBrokeBreakdown.colorBrokeTonnes * brokeValuationCostEur +
          (sequenceBrokeBreakdown.colorBrokeTonnes / config.brokeRateTph) * hourlyMachineCostEur
      ),
      clientInputTag: 'Client input required (Washout Broke Rate)',
    },
    // 2. Grammage Step Broke
    {
      componentId: 'grammage_step_broke',
      componentName: 'Caliper / Grammage Transition Broke',
      category: 'Sequence-Dependent',
      isSequenceDependent: true,
      isEnabled: config.enableChangeoverLoss,
      lossTonnes: sequenceBrokeBreakdown.grammageBrokeTonnes,
      wastePercentageOfGross: Math.round((sequenceBrokeBreakdown.grammageBrokeTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((sequenceBrokeBreakdown.grammageBrokeTonnes / config.brokeRateTph) * 10) / 10,
      estimatedCostEur: Math.round(
        sequenceBrokeBreakdown.grammageBrokeTonnes * brokeValuationCostEur +
          (sequenceBrokeBreakdown.grammageBrokeTonnes / config.brokeRateTph) * hourlyMachineCostEur
      ),
      clientInputTag: 'Client input required (Grammage Broke Rate)',
    },
    // 3. Format Switch Broke
    {
      componentId: 'format_switch_broke',
      componentName: 'Reel-to-Sheet Format Switch Broke',
      category: 'Sequence-Dependent',
      isSequenceDependent: true,
      isEnabled: config.enableChangeoverLoss,
      lossTonnes: sequenceBrokeBreakdown.formatBrokeTonnes,
      wastePercentageOfGross: Math.round((sequenceBrokeBreakdown.formatBrokeTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((sequenceBrokeBreakdown.formatBrokeTonnes / config.brokeRateTph) * 10) / 10,
      estimatedCostEur: Math.round(
        sequenceBrokeBreakdown.formatBrokeTonnes * brokeValuationCostEur +
          (sequenceBrokeBreakdown.formatBrokeTonnes / config.brokeRateTph) * hourlyMachineCostEur
      ),
      clientInputTag: 'Client input required (Format Switch Broke Rate)',
    },
    // 4. Startup / Restart Broke
    {
      componentId: 'startup_restart_broke',
      componentName: 'Campaign Start-up & Calibration Broke',
      category: 'Sequence-Dependent',
      isSequenceDependent: true,
      isEnabled: config.enableStartupLoss,
      lossTonnes: sequenceBrokeBreakdown.startupBrokeTonnes,
      wastePercentageOfGross: Math.round((sequenceBrokeBreakdown.startupBrokeTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((sequenceBrokeBreakdown.startupBrokeTonnes / 12.0) * 10) / 10, // based on nominal line rate
      estimatedCostEur: Math.round(sequenceBrokeBreakdown.startupBrokeTonnes * brokeValuationCostEur),
      clientInputTag: 'Client input required (Start-up Fixed Broke)',
    },
    // 5. Washout Water Loss
    {
      componentId: 'washout_water_cleaning',
      componentName: 'Washout Pulper & Felt Cleaning Water Loss',
      category: 'Sequence-Dependent',
      isSequenceDependent: true,
      isEnabled: config.enableWashoutCleaningLoss,
      lossTonnes: 0,
      wastePercentageOfGross: 0,
      machineHoursLost: 0,
      estimatedCostEur: Math.round(sequenceBrokeBreakdown.washoutWaterM3 * 4.5), // €4.5/m3 effluent & water recovery treatment placeholder
      environmentalMetric: `${sequenceBrokeBreakdown.washoutWaterM3} m³ effluent treatment`,
      clientInputTag: 'Client input required (Washout Water Index)',
    },
    // 6. Web-Break Broke
    {
      componentId: 'web_break_loss',
      componentName: 'Paper Machine Web-Break Broke',
      category: 'Non-Sequence',
      isSequenceDependent: false,
      isEnabled: config.enableWebBreakLoss,
      lossTonnes: nonSequenceBreakdown.webBreakTonnes,
      wastePercentageOfGross: Math.round((nonSequenceBreakdown.webBreakTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((nonSequenceBreakdown.webBreakTonnes / 12.0) * 10) / 10,
      estimatedCostEur: Math.round(nonSequenceBreakdown.webBreakTonnes * brokeValuationCostEur),
      clientInputTag: 'Client input required (Web-break Rate %)',
    },
    // 7. Quality Rejects
    {
      componentId: 'quality_rejects',
      componentName: 'Shade / Caliper Quality Off-Spec Rejects',
      category: 'Non-Sequence',
      isSequenceDependent: false,
      isEnabled: config.enableQualityRejects,
      lossTonnes: nonSequenceBreakdown.qualityRejectTonnes,
      wastePercentageOfGross: Math.round((nonSequenceBreakdown.qualityRejectTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((nonSequenceBreakdown.qualityRejectTonnes / 12.0) * 10) / 10,
      estimatedCostEur: Math.round(nonSequenceBreakdown.qualityRejectTonnes * brokeValuationCostEur),
      clientInputTag: 'Client input required (Off-spec Reject Rate %)',
    },
    // 8. Trim Loss
    {
      componentId: 'deckle_trim_loss',
      componentName: 'Slitter Deckle Edge Trim Loss',
      category: 'Non-Sequence',
      isSequenceDependent: false,
      isEnabled: config.enableTrimLoss,
      lossTonnes: nonSequenceBreakdown.trimLossTonnes,
      wastePercentageOfGross: Math.round((nonSequenceBreakdown.trimLossTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((nonSequenceBreakdown.trimLossTonnes / 12.0) * 10) / 10,
      estimatedCostEur: Math.round(nonSequenceBreakdown.trimLossTonnes * brokeValuationCostEur),
      clientInputTag: 'Client input required (Deckle Trim %)',
    },
    // 9. Converting & Finishing Loss
    {
      componentId: 'converting_finishing_loss',
      componentName: 'Converting & Packaging Finishing Loss',
      category: 'Non-Sequence',
      isSequenceDependent: false,
      isEnabled: config.enableConvertingLoss,
      lossTonnes: nonSequenceBreakdown.convertingLossTonnes,
      wastePercentageOfGross: Math.round((nonSequenceBreakdown.convertingLossTonnes / totalGross) * 1000) / 10,
      machineHoursLost: 0,
      estimatedCostEur: Math.round(nonSequenceBreakdown.convertingLossTonnes * brokeValuationCostEur),
      clientInputTag: 'Client input required (Converting Loss %)',
    },
    // 10. Minimum Batch Lot Rounding Surplus
    {
      componentId: 'lot_rounding_surplus',
      componentName: 'Minimum Run Batch Rounding (Stock Buffer)',
      category: 'Planning-Buffer',
      isSequenceDependent: false,
      isEnabled: config.enableLotRounding,
      lossTonnes: nonSequenceBreakdown.lotRoundingSurplusTonnes,
      wastePercentageOfGross: Math.round((nonSequenceBreakdown.lotRoundingSurplusTonnes / totalGross) * 1000) / 10,
      machineHoursLost: Math.round((nonSequenceBreakdown.lotRoundingSurplusTonnes / 12.0) * 10) / 10,
      estimatedCostEur: Math.round(nonSequenceBreakdown.lotRoundingSurplusTonnes * 180), // holding cost placeholder
      clientInputTag: 'Client input required (Min Batch Tonnes)',
    },
  ];

  return components;
}
