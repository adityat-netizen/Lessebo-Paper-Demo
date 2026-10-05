import type {
  CampaignOrder,
  ScheduledRun,
  ScheduleMetrics,
  OptimizationComparison,
  MachineId,
} from '../types';
import { calculateChangeover } from './changeoverCalculator';
import { generateRunExplainability } from './explainability';

function computeMetrics(
  runs: ScheduledRun[],
  hourlyRateEur: number = 480,
  brokeCostPerTonneEur: number = 280
): ScheduleMetrics {
  let totalProductionHours = 0;
  let totalChangeoverHours = 0;
  let totalBrokeTonnes = 0;
  let washoutCount = 0;
  let slaMetCount = 0;

  runs.forEach((r) => {
    totalProductionHours += r.production_hours;
    totalChangeoverHours += r.changeoverHours;
    totalBrokeTonnes += r.brokeTonnes;
    if (r.isWashout) washoutCount += 1;
    if (r.meetsSla) slaMetCount += 1;
  });

  const totalSpanHours = runs.length > 0 ? runs[runs.length - 1].endHour : 0;
  const totalOperatingCostEur = Math.round(
    (totalProductionHours + totalChangeoverHours) * hourlyRateEur
  );
  const totalBrokeCostEur = Math.round(totalBrokeTonnes * brokeCostPerTonneEur);
  const slaCompliancePct =
    runs.length > 0 ? Math.round((slaMetCount / runs.length) * 1000) / 10 : 100;

  return {
    totalRuns: runs.length,
    totalProductionHours: Math.round(totalProductionHours * 10) / 10,
    totalChangeoverHours: Math.round(totalChangeoverHours * 10) / 10,
    totalBrokeTonnes: Math.round(totalBrokeTonnes * 10) / 10,
    washoutCount,
    totalOperatingCostEur,
    totalBrokeCostEur,
    slaCompliancePct,
    totalSpanHours: Math.round(totalSpanHours * 10) / 10,
  };
}

function scheduleRunList(
  orderedRuns: CampaignOrder[],
  isOptimized: boolean,
  washoutMultiplier: number = 1.0,
  brokeRateTph: number = 2.4
): ScheduledRun[] {
  const result: ScheduledRun[] = [];
  let currentHour = 0;

  for (let i = 0; i < orderedRuns.length; i++) {
    const run = orderedRuns[i];
    const prevRun = i > 0 ? orderedRuns[i - 1] : null;

    const changeover = calculateChangeover(prevRun, run, washoutMultiplier, brokeRateTph);
    const startHour = Math.round((currentHour + changeover.totalHours) * 10) / 10;
    const endHour = Math.round((startHour + run.production_hours) * 10) / 10;
    currentHour = endHour;

    const completionDay = Math.ceil(endHour / 24.0);
    const meetsSla = completionDay <= run.due_in_days;

    const explainability = generateRunExplainability(
      run,
      prevRun,
      changeover,
      completionDay,
      isOptimized
    );

    result.push({
      ...run,
      runSequence: i + 1,
      startHour,
      endHour,
      changeoverHours: changeover.totalHours,
      changeoverBreakdown: changeover,
      brokeTonnes: changeover.brokeTonnes,
      isWashout: changeover.isWashout,
      meetsSla,
      completionDay,
      explainability,
    });
  }

  return result;
}

export function optimizeSequence(
  campaignOrders: CampaignOrder[],
  targetMachine: MachineId = 'PM1',
  washoutMultiplier: number = 1.0,
  brokeRateTph: number = 2.4
): OptimizationComparison {
  // Filter for the machine being scheduled (PM1 default for primary graphic demonstration)
  const machineOrders = campaignOrders.filter((o) => o.assigned_machine === targetMachine);

  // 1. Build Naive Sequence (Order Book Arrival sequence)
  // Preserves original arriving order which has costly back-and-forth shade changes
  const naiveList = [...machineOrders];
  const naiveScheduled = scheduleRunList(naiveList, false, washoutMultiplier, brokeRateTph);
  const naiveMetrics = computeMetrics(naiveScheduled);

  // 2. Build Optimized Sequence (Heuristic Light-to-Dark Ladder + Grammage Sort + Format Grouping + SLA Protection)
  const sortedOptimizedList = [...machineOrders].sort((a, b) => {
    // Primary: Urgent orders with tight SLA (due in <= 13 days) are prioritized in early campaign window
    const aUrgent = a.customer_priority.includes('Strict') || a.due_in_days <= 13 ? 0 : 1;
    const bUrgent = b.customer_priority.includes('Strict') || b.due_in_days <= 13 ? 0 : 1;
    if (aUrgent !== bUrgent) {
      return aUrgent - bUrgent;
    }

    // Secondary: Light-to-Dark Ladder (Tier 1 Ultra-Light -> Tier 2 Light -> Tier 3 Medium -> Tier 4 Dark)
    if (a.shade_tier !== b.shade_tier) {
      return a.shade_tier - b.shade_tier;
    }

    // Tertiary: Group same shade names together
    if (a.shade_name !== b.shade_name) {
      return a.shade_name.localeCompare(b.shade_name);
    }

    // Quaternary: Ascending grammage within shade (smooth calender nip adjustment)
    if (a.grammage_gsm !== b.grammage_gsm) {
      return a.grammage_gsm - b.grammage_gsm;
    }

    // Quinary: Format grouping (Sheets same dimension together, then Reels)
    const formatOrder = (fmt: string, dim: string | null) => {
      if (fmt === 'Sheets' && dim?.includes('700x1000')) return 1;
      if (fmt === 'Sheets') return 2;
      return 3;
    };
    return formatOrder(a.format_type, a.sheet_dimensions) - formatOrder(b.format_type, b.sheet_dimensions);
  });

  const optimizedScheduled = scheduleRunList(
    sortedOptimizedList,
    true,
    washoutMultiplier,
    brokeRateTph
  );
  const optimizedMetrics = computeMetrics(optimizedScheduled);

  // Compute live savings
  const changeoverHoursSaved = Math.round(
    (naiveMetrics.totalChangeoverHours - optimizedMetrics.totalChangeoverHours) * 10
  ) / 10;
  const brokeTonnesSaved = Math.round(
    (naiveMetrics.totalBrokeTonnes - optimizedMetrics.totalBrokeTonnes) * 10
  ) / 10;
  const capacityReleasedHours = changeoverHoursSaved;
  const washoutsAvoided = Math.max(0, naiveMetrics.washoutCount - optimizedMetrics.washoutCount);
  const financialSavingsEur = Math.round(
    changeoverHoursSaved * 480 + brokeTonnesSaved * 280
  );

  return {
    naive: {
      runs: naiveScheduled,
      metrics: naiveMetrics,
    },
    optimized: {
      runs: optimizedScheduled,
      metrics: optimizedMetrics,
    },
    savings: {
      changeoverHoursSaved,
      brokeTonnesSaved,
      capacityReleasedHours,
      financialSavingsEur,
      washoutsAvoided,
    },
  };
}
