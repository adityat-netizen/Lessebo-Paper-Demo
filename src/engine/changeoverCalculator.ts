import type { CampaignOrder, ChangeoverBreakdown } from '../types';
import type { LossModelConfig } from '../types/lossModel';

export function calculateChangeover(
  fromRun: CampaignOrder | null,
  toRun: CampaignOrder,
  washoutMultiplier: number = 1.0,
  brokeRateTph: number = 2.4,
  config?: LossModelConfig
): ChangeoverBreakdown {
  const effectiveBrokeRate = config ? config.brokeRateTph : brokeRateTph;
  const enableChangeover = config ? config.enableChangeoverLoss : true;
  const startupBrokeTonnes = config && config.enableStartupLoss ? config.startupLossTonnesPerRun : 0;

  if (!fromRun) {
    // Starting run of the schedule (clean start)
    const baseBroke = enableChangeover ? Math.round(0.5 * effectiveBrokeRate * 10) / 10 : 0;
    const totalBroke = Math.round((baseBroke + startupBrokeTonnes) * 10) / 10;
    return {
      baseSetup: 0.5,
      washoutHours: 0.0,
      grammageHours: 0.0,
      formatHours: 0.0,
      totalHours: 0.5,
      isWashout: false,
      isGrammageReversal: false,
      grammageDirection: 'same',
      grammageDeltaGsm: 0,
      grammageUpHours: 0.0,
      grammageDownHours: 0.0,
      brokeTonnes: totalBroke,
      colorBrokeTonnes: 0,
      grammageBrokeTonnes: 0,
      formatBrokeTonnes: 0,
      startupBrokeTonnes,
      washoutWaterM3: 0,
      reason: 'Schedule initial start & calibration run',
    };
  }

  const baseSetup = 0.5;
  let washoutHours = 0.0;
  let isWashout = false;
  const reasons: string[] = [];

  // 1. Shade Transition Penalty
  const fromTier = fromRun.shade_tier;
  const toTier = toRun.shade_tier;

  if (fromRun.shade_name === toRun.shade_name) {
    washoutHours = 0.0;
  } else if (toTier > fromTier) {
    // Light to Dark (no deep washout needed)
    washoutHours = 0.0;
  } else if (fromTier === 4 && toTier <= 2) {
    // Severe dark-to-light: intensive chest flush & chemical felt wash
    washoutHours = 3.5 * washoutMultiplier;
    isWashout = true;
    reasons.push(`Washout: Deep pigment (${fromRun.shade_name}) to Light (${toRun.shade_name})`);
  } else if (fromTier === 3 && toTier <= 2) {
    // Medium chromatic to light
    washoutHours = 2.0 * washoutMultiplier;
    isWashout = true;
    reasons.push(`Washout: Medium colour (${fromRun.shade_name}) to Light (${toRun.shade_name})`);
  } else if (fromTier === 4 && toTier === 4 && fromRun.shade_name !== toRun.shade_name) {
    // Cross dark pigment change
    washoutHours = 1.2 * washoutMultiplier;
    reasons.push(`Pigment change: ${fromRun.shade_name} to ${toRun.shade_name}`);
  } else if (toTier < fromTier) {
    // General reverse step
    washoutHours = 1.5 * washoutMultiplier;
    isWashout = true;
    reasons.push(`Light wash: ${fromRun.shade_name} to ${toRun.shade_name}`);
  }

  // 2. Grammage Delta Penalty (Symmetric: step-up and step-down cost identical)
  const grammageDelta = Math.abs(fromRun.grammage_gsm - toRun.grammage_gsm);
  const isGrammageReversal = false; // Asymmetric direction penalty removed
  const grammageDirection: 'up' | 'down' | 'same' =
    fromRun.grammage_gsm > toRun.grammage_gsm
      ? 'down'
      : fromRun.grammage_gsm < toRun.grammage_gsm
      ? 'up'
      : 'same';

  let baseGrammageHours = 0.0;
  if (grammageDelta === 0) {
    baseGrammageHours = 0.0;
  } else if (grammageDelta <= 40) {
    baseGrammageHours = 0.5;
    reasons.push(`Caliper step: ${fromRun.grammage_gsm}g to ${toRun.grammage_gsm}g (Δ${grammageDelta}gsm)`);
  } else {
    baseGrammageHours = 1.2;
    reasons.push(`Caliper jump: ${fromRun.grammage_gsm}g to ${toRun.grammage_gsm}g (large Δ${grammageDelta}gsm)`);
  }

  // Symmetric transition: no directional penalty
  const grammageHours = baseGrammageHours;
  const grammageUpHours = grammageDirection === 'up' ? baseGrammageHours : 0.0;
  const grammageDownHours = grammageDirection === 'down' ? baseGrammageHours : 0.0;

  // 3. Format Change Penalty
  let formatHours = 0.0;
  if (fromRun.format_type === toRun.format_type) {
    if (
      fromRun.format_type === 'Sheets' &&
      fromRun.sheet_dimensions !== toRun.sheet_dimensions
    ) {
      formatHours = 0.75;
      reasons.push(`Slitter reset: ${fromRun.sheet_dimensions} to ${toRun.sheet_dimensions}`);
    } else {
      formatHours = 0.0;
    }
  } else {
    formatHours = 1.0;
    reasons.push(`Format switch: ${fromRun.format_type} to ${toRun.format_type}`);
  }

  const totalHours = Math.round((baseSetup + washoutHours + grammageHours + formatHours) * 100) / 100;

  // Itemized broke calculations
  const colorBrokeTonnes = enableChangeover
    ? Math.round(washoutHours * effectiveBrokeRate * (config?.colorTransitionMultiplier ?? 1.0) * 10) / 10
    : 0;
  const grammageBrokeTonnes = enableChangeover
    ? Math.round(grammageHours * effectiveBrokeRate * (config?.grammageStepMultiplier ?? 1.0) * 10) / 10
    : 0;
  const formatBrokeTonnes = enableChangeover
    ? Math.round(formatHours * effectiveBrokeRate * (config?.formatSwitchMultiplier ?? 1.0) * 10) / 10
    : 0;
  const baseBrokeTonnes = enableChangeover
    ? Math.round(baseSetup * effectiveBrokeRate * 10) / 10
    : 0;

  let washoutWaterM3 = 0;
  const enableWashoutWater = config ? config.enableWashoutCleaningLoss : true;
  if (enableWashoutWater) {
    if (isWashout) {
      washoutWaterM3 = config ? config.waterPerWashoutM3 : 18.0;
    } else if (washoutHours > 0) {
      washoutWaterM3 = config ? config.waterPerMinorWashM3 : 6.0;
    }
  }

  const brokeTonnes = Math.round(
    (baseBrokeTonnes + colorBrokeTonnes + grammageBrokeTonnes + formatBrokeTonnes + startupBrokeTonnes) * 10
  ) / 10;

  return {
    baseSetup,
    washoutHours: Math.round(washoutHours * 100) / 100,
    grammageHours,
    formatHours,
    totalHours,
    isWashout,
    isGrammageReversal,
    grammageDirection,
    grammageDeltaGsm: grammageDelta,
    grammageUpHours,
    grammageDownHours,
    brokeTonnes,
    colorBrokeTonnes,
    grammageBrokeTonnes,
    formatBrokeTonnes,
    startupBrokeTonnes,
    washoutWaterM3,
    reason: reasons.length > 0 ? reasons.join('; ') : 'Smooth transition (compatible shade & format)',
  };
}
