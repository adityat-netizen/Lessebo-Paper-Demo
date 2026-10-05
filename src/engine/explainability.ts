import type { CampaignOrder, ChangeoverBreakdown } from '../types';

export interface ExplainabilityData {
  title: string;
  badges: { text: string; type: 'success' | 'warning' | 'info' | 'neutral' }[];
  reasons: string[];
}

export function generateRunExplainability(
  currentRun: CampaignOrder,
  previousRun: CampaignOrder | null,
  _changeover: ChangeoverBreakdown,
  completionDay: number,
  isOptimized: boolean
): ExplainabilityData {
  const badges: { text: string; type: 'success' | 'warning' | 'info' | 'neutral' }[] = [];
  const reasons: string[] = [];

  const dueDays = currentRun.due_in_days;
  const isSlaProtected = completionDay <= dueDays;

  if (isSlaProtected) {
    badges.push({ text: `SLA Protected (Day ${completionDay} / ${dueDays}d)`, type: 'success' });
    reasons.push(
      `Delivery on schedule: Finishes on day ${completionDay}, well inside customer deadline of ${dueDays} days.`
    );
  } else {
    badges.push({ text: `SLA At Risk (+${completionDay - dueDays}d)`, type: 'warning' });
    reasons.push(
      `Late risk: Finishes on day ${completionDay}, exceeding customer requested window by ${completionDay - dueDays} days.`
    );
  }

  if (!previousRun) {
    badges.push({ text: 'Campaign Opener', type: 'info' });
    return {
      title: `Campaign Opening Run: ${currentRun.shade_name} (${currentRun.grammage_gsm} gsm)`,
      badges,
      reasons: [
        'Selected as initial clean startup run: Machine begins with light/clean pulp chest.',
        'Mechanical pre-checks and reel synchronization established.',
      ],
    };
  }

  // Explain shade transition
  if (currentRun.shade_name === previousRun.shade_name) {
    badges.push({ text: 'Identical Shade', type: 'success' });
    reasons.push(
      `Zero colour changeover: Run shares the exact shade (${currentRun.shade_name}) with preceding run; no pulper cleaning needed.`
    );
  } else if (currentRun.shade_tier >= previousRun.shade_tier) {
    badges.push({ text: 'Light ➔ Dark Ladder', type: 'success' });
    reasons.push(
      `Progression sort: Moving from lighter shade (${previousRun.shade_name}) to darker (${currentRun.shade_name}) eliminates washout cycle (saved ~3.5h).`
    );
  } else {
    // Dark to light transition
    if (isOptimized) {
      badges.push({ text: 'Scheduled Washout Block', type: 'info' });
      reasons.push(
        `Planned campaign reset: Necessary transition back to light shades after full dark cycle completed.`
      );
    } else {
      badges.push({ text: 'Costly Washout Triggered', type: 'warning' });
      reasons.push(
        `Suboptimal transition: Moving from dark (${previousRun.shade_name}) back to light (${currentRun.shade_name}) forces a 3.5h deep pulper boilout and felt scrub.`
      );
    }
  }

  // Explain grammage step
  const gDelta = Math.abs(currentRun.grammage_gsm - previousRun.grammage_gsm);
  if (gDelta === 0) {
    badges.push({ text: 'Identical Grammage', type: 'success' });
    reasons.push(`Zero caliper change: Consecutive runs at ${currentRun.grammage_gsm} gsm require no slice lip or vacuum adjustment.`);
  } else if (gDelta <= 40) {
    badges.push({ text: `Smooth Step (+${gDelta}g)`, type: 'neutral' });
    reasons.push(`Minor caliper delta: Progressive +${gDelta} gsm change completed in just 0.5h.`);
  } else {
    badges.push({ text: `Large Caliper Jump (${gDelta}g)`, type: 'warning' });
    reasons.push(`Significant substance change (${previousRun.grammage_gsm}g ➔ ${currentRun.grammage_gsm}g) requires steam curve restabilization (+1.2h).`);
  }

  // Explain format
  if (currentRun.format_type === previousRun.format_type && currentRun.sheet_dimensions === previousRun.sheet_dimensions) {
    badges.push({ text: 'Identical Format Deckle', type: 'success' });
    reasons.push(`Deckle continuity: Preserves ${currentRun.format_type} (${currentRun.sheet_dimensions ?? 'Reels'}) without slitter downtime.`);
  } else if (currentRun.format_type === previousRun.format_type) {
    badges.push({ text: 'Slitter Reset (0.75h)', type: 'neutral' });
    reasons.push(`Dimension adjustment: Repositioned cutter knives from ${previousRun.sheet_dimensions} to ${currentRun.sheet_dimensions}.`);
  } else {
    badges.push({ text: 'Cutter / Reel Switch (1.0h)', type: 'warning' });
    reasons.push(`Format switch between ${previousRun.format_type} and ${currentRun.format_type}.`);
  }

  const title = isOptimized
    ? `Optimized Sequence Rationale: ${currentRun.shade_name} (${currentRun.grammage_gsm} gsm)`
    : `Naive Arrival Sequence: ${currentRun.shade_name} (${currentRun.grammage_gsm} gsm)`;

  return {
    title,
    badges,
    reasons,
  };
}
