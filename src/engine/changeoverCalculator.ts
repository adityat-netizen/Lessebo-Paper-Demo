import type { CampaignOrder, ChangeoverBreakdown } from '../types';

export function calculateChangeover(
  fromRun: CampaignOrder | null,
  toRun: CampaignOrder,
  washoutMultiplier: number = 1.0,
  brokeRateTph: number = 2.4
): ChangeoverBreakdown {
  if (!fromRun) {
    // Starting run of the schedule (clean start)
    return {
      baseSetup: 0.5,
      washoutHours: 0.0,
      grammageHours: 0.0,
      formatHours: 0.0,
      totalHours: 0.5,
      isWashout: false,
      brokeTonnes: Math.round(0.5 * brokeRateTph * 10) / 10,
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

  // 2. Grammage Delta Penalty
  const grammageDelta = Math.abs(fromRun.grammage_gsm - toRun.grammage_gsm);
  let grammageHours = 0.0;
  if (grammageDelta === 0) {
    grammageHours = 0.0;
  } else if (grammageDelta <= 40) {
    grammageHours = 0.5;
    reasons.push(`Caliper step: ${fromRun.grammage_gsm}g to ${toRun.grammage_gsm}g (small +${grammageDelta}gsm)`);
  } else {
    grammageHours = 1.2;
    reasons.push(`Caliper jump: ${fromRun.grammage_gsm}g to ${toRun.grammage_gsm}g (large delta ${grammageDelta}gsm)`);
  }

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
  const brokeTonnes = Math.round(totalHours * brokeRateTph * 10) / 10;

  return {
    baseSetup,
    washoutHours: Math.round(washoutHours * 100) / 100,
    grammageHours,
    formatHours,
    totalHours,
    isWashout,
    brokeTonnes,
    reason: reasons.length > 0 ? reasons.join('; ') : 'Smooth transition (compatible shade & format)',
  };
}
