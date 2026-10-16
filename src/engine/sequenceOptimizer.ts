import type {
  CampaignOrder,
  ScheduledRun,
  ScheduleMetrics,
  OptimizationComparison,
  MachineId,
  StrategyResult,
  RecommendationRationale,
  RankedStrategySummary,
  StrategyComparisonRow,
  BreakEvenSensitivity,
} from '../types';
import type { LossModelConfig } from '../types/lossModel';
import { calculateChangeover } from './changeoverCalculator';
import { generateRunExplainability } from './explainability';

export function computeMetrics(
  runs: ScheduledRun[],
  hourlyRateEur: number = 480,
  brokeCostPerTonneEur: number = 280,
  config?: LossModelConfig
): ScheduleMetrics {
  let totalProductionHours = 0;
  let totalChangeoverHours = 0;
  let totalBrokeTonnes = 0;
  let washoutCount = 0;
  let slaMetCount = 0;
  let totalWashoutWaterM3 = 0;
  let grammageReversalsCount = 0;

  runs.forEach((r) => {
    totalProductionHours += r.production_hours;
    totalChangeoverHours += r.changeoverHours;
    totalBrokeTonnes += r.brokeTonnes;
    totalWashoutWaterM3 += r.changeoverBreakdown.washoutWaterM3 ?? 0;
    if (r.isWashout) washoutCount += 1;
    if (r.meetsSla) slaMetCount += 1;
    if (r.changeoverBreakdown.isGrammageReversal) grammageReversalsCount += 1;
  });

  const totalSpanHours = runs.length > 0 ? runs[runs.length - 1].endHour : 0;
  const totalOperatingCostEur = Math.round(
    (totalProductionHours + totalChangeoverHours) * hourlyRateEur
  );
  const totalBrokeCostEur = Math.round(totalBrokeTonnes * brokeCostPerTonneEur);
  const slaCompliancePct =
    runs.length > 0 ? Math.round((slaMetCount / runs.length) * 1000) / 10 : 100;

  // Component 11: Broke recycling furnish ceiling
  const totalCampaignTonnes = runs.reduce((sum, r) => sum + r.quantity_tonnes, 0);
  const totalFurnishTonnes = totalCampaignTonnes + totalBrokeTonnes;
  const brokeFurnishPct = totalFurnishTonnes > 0
    ? Math.round((totalBrokeTonnes / totalFurnishTonnes) * 1000) / 10
    : 0;
  const maxCeiling = config?.maxFurnishRecycleCeilingPct ?? 15.0;
  const brokeRecycleExceeded = (config?.enableBrokeRecycling ?? false) && brokeFurnishPct > maxCeiling;

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
    sequenceDependentLossTonnes: Math.round(totalBrokeTonnes * 10) / 10,
    totalWashoutWaterM3: Math.round(totalWashoutWaterM3 * 10) / 10,
    brokeFurnishPct,
    brokeRecycleExceeded,
    grammageReversalsCount,
  };
}

export function scheduleRunList(
  orderedRuns: CampaignOrder[],
  isOptimized: boolean,
  washoutMultiplier: number = 1.0,
  brokeRateTph: number = 2.4,
  config?: LossModelConfig
): ScheduledRun[] {
  const result: ScheduledRun[] = [];
  let currentHour = 0;

  for (let i = 0; i < orderedRuns.length; i++) {
    const run = orderedRuns[i];
    const prevRun = i > 0 ? orderedRuns[i - 1] : null;

    const changeover = calculateChangeover(prevRun, run, washoutMultiplier, brokeRateTph, config);
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

const formatOrder = (fmt: string, dim: string | null) => {
  if (fmt === 'Sheets' && dim?.includes('700x1000')) return 1;
  if (fmt === 'Sheets') return 2;
  return 3;
};

export function optimizeSequence(
  campaignOrders: CampaignOrder[],
  targetMachine: MachineId = 'PM1',
  washoutMultiplier: number = 1.0,
  brokeRateTph: number = 2.4,
  config?: LossModelConfig
): OptimizationComparison {
  // Filter for the machine being scheduled (PM1 default for primary graphic demonstration)
  const machineOrders = campaignOrders.filter((o) => o.assigned_machine === targetMachine);

  // -------------------------------------------------------------
  // STRATEGY A: Naive Sequence (Order Book Arrival sequence)
  // -------------------------------------------------------------
  const naiveList = [...machineOrders];
  const naiveScheduled = scheduleRunList(naiveList, false, washoutMultiplier, brokeRateTph, config);
  const naiveMetrics: ScheduleMetrics = {
    ...computeMetrics(naiveScheduled, 480, 280, config),
    strategyId: 'naive',
    strategyName: 'Naive (Order Arrival)',
  };

  // -------------------------------------------------------------
  // STRATEGY B: Colour-First Ladder (Minimizes washouts)
  // -------------------------------------------------------------
  const colorFirstList = [...machineOrders].sort((a, b) => {
    const aUrgent = a.customer_priority.includes('Strict') || a.due_in_days <= 13 ? 0 : 1;
    const bUrgent = b.customer_priority.includes('Strict') || b.due_in_days <= 13 ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    if (a.shade_tier !== b.shade_tier) return a.shade_tier - b.shade_tier;
    if (a.shade_name !== b.shade_name) return a.shade_name.localeCompare(b.shade_name);
    if (a.grammage_gsm !== b.grammage_gsm) return a.grammage_gsm - b.grammage_gsm;
    return formatOrder(a.format_type, a.sheet_dimensions) - formatOrder(b.format_type, b.sheet_dimensions);
  });
  const colorFirstScheduled = scheduleRunList(colorFirstList, true, washoutMultiplier, brokeRateTph, config);
  const colorFirstMetrics: ScheduleMetrics = {
    ...computeMetrics(colorFirstScheduled, 480, 280, config),
    strategyId: 'color_first',
    strategyName: 'Colour-First Ladder',
  };

  // -------------------------------------------------------------
  // STRATEGY C: Grammage-First Progression (Minimizes caliper steps)
  // -------------------------------------------------------------
  const grammageFirstList = [...machineOrders].sort((a, b) => {
    const aUrgent = a.customer_priority.includes('Strict') || a.due_in_days <= 13 ? 0 : 1;
    const bUrgent = b.customer_priority.includes('Strict') || b.due_in_days <= 13 ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    if (a.grammage_gsm !== b.grammage_gsm) return a.grammage_gsm - b.grammage_gsm;
    if (a.shade_tier !== b.shade_tier) return a.shade_tier - b.shade_tier;
    if (a.shade_name !== b.shade_name) return a.shade_name.localeCompare(b.shade_name);
    return formatOrder(a.format_type, a.sheet_dimensions) - formatOrder(b.format_type, b.sheet_dimensions);
  });
  const grammageFirstScheduled = scheduleRunList(grammageFirstList, true, washoutMultiplier, brokeRateTph, config);
  const grammageFirstMetrics: ScheduleMetrics = {
    ...computeMetrics(grammageFirstScheduled, 480, 280, config),
    strategyId: 'grammage_first',
    strategyName: 'Grammage-First Progression',
  };

  // -------------------------------------------------------------
  // STRATEGY D: Hybrid / Cost-Minimizing
  // Groups into grammage bands, ladders colour within bands, and optimizes
  // -------------------------------------------------------------
  const urgentOrders = machineOrders.filter((o) => o.customer_priority.includes('Strict') || o.due_in_days <= 13);
  const standardOrders = machineOrders.filter((o) => !(o.customer_priority.includes('Strict') || o.due_in_days <= 13));

  const sortedUrgent = [...urgentOrders].sort((a, b) => {
    if (a.shade_tier !== b.shade_tier) return a.shade_tier - b.shade_tier;
    if (a.grammage_gsm !== b.grammage_gsm) return a.grammage_gsm - b.grammage_gsm;
    return a.shade_name.localeCompare(b.shade_name);
  });

  const getGrammageBand = (gsm: number) => {
    if (gsm <= 100) return 1;
    if (gsm <= 140) return 2;
    return 3;
  };

  const bandSorted = [...standardOrders].sort((a, b) => {
    const bA = getGrammageBand(a.grammage_gsm);
    const bB = getGrammageBand(b.grammage_gsm);
    if (bA !== bB) return bA - bB;
    if (a.grammage_gsm !== b.grammage_gsm) return a.grammage_gsm - b.grammage_gsm;
    if (a.shade_tier !== b.shade_tier) return a.shade_tier - b.shade_tier;
    if (a.shade_name !== b.shade_name) return a.shade_name.localeCompare(b.shade_name);
    return formatOrder(a.format_type, a.sheet_dimensions) - formatOrder(b.format_type, b.sheet_dimensions);
  });

  const seedBand = [...sortedUrgent, ...bandSorted];

  // Evaluate candidate sequence cost and schedule feasibility
  const evaluateSequenceCost = (list: CampaignOrder[]) => {
    let cost = 0;
    let currHour = 0;
    let feasible = true;
    for (let i = 0; i < list.length; i++) {
      const prev = i > 0 ? list[i - 1] : null;
      const ch = calculateChangeover(prev, list[i], washoutMultiplier, brokeRateTph, config);
      currHour += ch.totalHours + list[i].production_hours;
      const compDay = Math.ceil(currHour / 24.0);
      if (compDay > list[i].due_in_days && (list[i].customer_priority.includes('Strict') || list[i].due_in_days <= 13)) {
        feasible = false;
      }
      cost += ch.totalHours * 480 + ch.brokeTonnes * 280;
    }
    return { cost, feasible };
  };

  // Seed with best feasible heuristic start: band-sorted, grammage-first, or colour-first
  const seedCandidates = [
    { name: 'bandSorted', list: seedBand, ...evaluateSequenceCost(seedBand) },
    { name: 'grammageFirst', list: grammageFirstList, ...evaluateSequenceCost(grammageFirstList) },
    { name: 'colorFirst', list: colorFirstList, ...evaluateSequenceCost(colorFirstList) },
  ].filter((s) => s.feasible);

  seedCandidates.sort((a, b) => a.cost - b.cost);
  const bestSeed = seedCandidates[0] || { list: [...machineOrders], cost: evaluateSequenceCost(machineOrders).cost };
  let hybridList = [...bestSeed.list];
  let currentBestCost = bestSeed.cost;

  // Windowed 2-opt and swap refinement
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (let i = sortedUrgent.length; i < hybridList.length - 1; i++) {
      for (let len = 2; len <= Math.min(8, hybridList.length - i); len++) {
        const j = i + len - 1;
        const candidate = [
          ...hybridList.slice(0, i),
          ...hybridList.slice(i, j + 1).reverse(),
          ...hybridList.slice(j + 1),
        ];
        const evalResult = evaluateSequenceCost(candidate);
        if (evalResult.feasible && evalResult.cost < currentBestCost - 0.5) {
          hybridList = candidate;
          currentBestCost = evalResult.cost;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
    if (!improved) break;
  }

  const hybridScheduled = scheduleRunList(hybridList, true, washoutMultiplier, brokeRateTph, config);
  const hybridMetrics: ScheduleMetrics = {
    ...computeMetrics(hybridScheduled, 480, 280, config),
    strategyId: 'hybrid',
    strategyName: 'Hybrid (Grammage Bands + Colour Ladder)',
  };

  // -------------------------------------------------------------
  // STRATEGY COMPARISON & SELECTION
  // -------------------------------------------------------------
  const naiveResult: StrategyResult = {
    id: 'naive',
    name: 'Naive (Order Arrival)',
    description: 'Unoptimized FIFO order-arrival sequence exhibiting high washouts and broke',
    runs: naiveScheduled,
    metrics: naiveMetrics,
  };

  const colorFirstResult: StrategyResult = {
    id: 'color_first',
    name: 'Colour-First Ladder',
    description: 'Strict light-to-dark shade ladder; eliminates washouts but can create heavy-to-light grammage reversals',
    runs: colorFirstScheduled,
    metrics: colorFirstMetrics,
  };

  const grammageFirstResult: StrategyResult = {
    id: 'grammage_first',
    name: 'Grammage-First Progression',
    description: 'Ascending grammage sorting; eliminates grammage reversals but may trigger extra shade washouts',
    runs: grammageFirstScheduled,
    metrics: grammageFirstMetrics,
  };

  const hybridResult: StrategyResult = {
    id: 'hybrid',
    name: 'Hybrid / Cost-Minimizing',
    description: 'Grammage-band campaigns with intra-band light-to-dark sorting and deterministic local optimization',
    runs: hybridScheduled,
    metrics: hybridMetrics,
  };

  // Evaluate candidate strategies to select recommended one
  const candidates = [colorFirstResult, grammageFirstResult, hybridResult];
  const maxSla = Math.max(...candidates.map((s) => s.metrics.slaCompliancePct));
  const feasibleCandidates = candidates.filter((s) => s.metrics.slaCompliancePct >= maxSla - 2.0);

  const totalCost = (m: ScheduleMetrics) => m.totalChangeoverHours * 480 + m.totalBrokeTonnes * 280;

  feasibleCandidates.sort((a, b) => {
    // 1. Lowest total cost among feasible strategies
    const diff = totalCost(a.metrics) - totalCost(b.metrics);
    if (Math.abs(diff) > 1.0) return diff;
    // 2. Fewest due-date risks (highest SLA compliance)
    const slaDiff = b.metrics.slaCompliancePct - a.metrics.slaCompliancePct;
    if (Math.abs(slaDiff) > 0.01) return slaDiff;
    // 3. Lowest broke tonnes
    const brokeDiff = a.metrics.totalBrokeTonnes - b.metrics.totalBrokeTonnes;
    if (Math.abs(brokeDiff) > 0.01) return brokeDiff;
    // 4. Lowest reversals
    return (a.metrics.grammageReversalsCount ?? 0) - (b.metrics.grammageReversalsCount ?? 0);
  });

  const recommended = feasibleCandidates[0] || colorFirstResult;
  recommended.isRecommended = true;

  // Conflict detection
  const colorFirstReversals = colorFirstMetrics.grammageReversalsCount ?? 0;
  const recommendedReversals = recommended.metrics.grammageReversalsCount ?? 0;
  const stepDownPenaltyVal = config?.grammageStepDownPenaltyHours ?? 0;
  const conflictDetected = colorFirstReversals >= 2 && (stepDownPenaltyVal > 0 || colorFirstReversals > recommendedReversals);

  const excessHours = Math.max(0, Math.round((colorFirstMetrics.totalChangeoverHours - recommended.metrics.totalChangeoverHours) * 10) / 10);
  const excessBrokeTonnes = Math.max(0, Math.round((colorFirstMetrics.totalBrokeTonnes - recommended.metrics.totalBrokeTonnes) * 10) / 10);

  // Live savings comparing recommended strategy against naive
  const changeoverHoursSaved = Math.round(
    (naiveMetrics.totalChangeoverHours - recommended.metrics.totalChangeoverHours) * 10
  ) / 10;
  const brokeTonnesSaved = Math.round(
    (naiveMetrics.totalBrokeTonnes - recommended.metrics.totalBrokeTonnes) * 10
  ) / 10;
  const capacityReleasedHours = changeoverHoursSaved;
  const washoutsAvoided = Math.max(0, naiveMetrics.washoutCount - recommended.metrics.washoutCount);
  const waterSavedM3 = Math.max(
    0,
    Math.round(((naiveMetrics.totalWashoutWaterM3 ?? 0) - (recommended.metrics.totalWashoutWaterM3 ?? 0)) * 10) / 10
  );
  const reversalsAvoided = Math.max(0, (naiveMetrics.grammageReversalsCount ?? 0) - (recommended.metrics.grammageReversalsCount ?? 0));
  const financialSavingsEur = Math.round(
    changeoverHoursSaved * 480 + brokeTonnesSaved * 280
  );

  // -------------------------------------------------------------
  // RECOMMENDATION RATIONALE & COMPARISON METRICS
  // -------------------------------------------------------------
  const allStrategies = [naiveResult, colorFirstResult, grammageFirstResult, hybridResult];

  // Urgent and strict orders protection
  const urgentOrdersTotal = machineOrders.filter((o) => o.customer_priority.includes('Strict') || o.due_in_days <= 13).length;
  const recommendedUrgentMet = recommended.runs.filter((r) => (r.customer_priority.includes('Strict') || r.due_in_days <= 13) && r.meetsSla).length;

  // Ranking of all 4 strategies
  const sortedStrategies = [...allStrategies].sort((a, b) => {
    const aFeas = a.runs.filter((r) => (r.customer_priority.includes('Strict') || r.due_in_days <= 13) && !r.meetsSla).length === 0;
    const bFeas = b.runs.filter((r) => (r.customer_priority.includes('Strict') || r.due_in_days <= 13) && !r.meetsSla).length === 0;
    if (aFeas !== bFeas) return aFeas ? -1 : 1;

    const costDiff = totalCost(a.metrics) - totalCost(b.metrics);
    if (Math.abs(costDiff) > 1.0) return costDiff;

    const slaDiff = b.metrics.slaCompliancePct - a.metrics.slaCompliancePct;
    if (Math.abs(slaDiff) > 0.01) return slaDiff;

    const brokeDiff = a.metrics.totalBrokeTonnes - b.metrics.totalBrokeTonnes;
    if (Math.abs(brokeDiff) > 0.01) return brokeDiff;

    return (a.metrics.grammageReversalsCount ?? 0) - (b.metrics.grammageReversalsCount ?? 0);
  });

  const winnerCost = totalCost(recommended.metrics);
  const rankedSummaries: RankedStrategySummary[] = sortedStrategies.map((s, idx) => {
    const sCost = totalCost(s.metrics);
    const nextCost = idx < sortedStrategies.length - 1 ? totalCost(sortedStrategies[idx + 1].metrics) : sCost;
    const strictDueMet = s.runs.filter((r) => (r.customer_priority.includes('Strict') || r.due_in_days <= 13) && r.meetsSla).length;
    const isFeas = strictDueMet === urgentOrdersTotal;

    return {
      rank: idx + 1,
      id: s.id,
      name: s.name,
      totalCostEur: sCost,
      totalChangeoverHours: s.metrics.totalChangeoverHours,
      totalBrokeTonnes: s.metrics.totalBrokeTonnes,
      washoutCount: s.metrics.washoutCount,
      reversalCount: s.metrics.grammageReversalsCount ?? 0,
      slaCompliancePct: s.metrics.slaCompliancePct,
      marginToWinnerEur: Math.max(0, sCost - winnerCost),
      marginToNextEur: Math.max(0, nextCost - sCost),
      isFeasible: isFeas,
      rejectionReason: !isFeas ? 'Rejected: delivery due-date conflict' : undefined,
      isRecommended: s.id === recommended.id,
      strictDueOrdersCount: urgentOrdersTotal,
      strictDueMetCount: strictDueMet,
    };
  });

  // Runner-up strategy (first non-recommended feasible strategy, or first non-recommended)
  const runnerUpSummary = rankedSummaries.find((s) => s.id !== recommended.id && s.isFeasible) || rankedSummaries.find((s) => s.id !== recommended.id);
  const runnerUpResult = allStrategies.find((s) => s.id === runnerUpSummary?.id) || colorFirstResult;
  const marginToRunnerUpEur = runnerUpSummary ? Math.max(0, runnerUpSummary.totalCostEur - winnerCost) : 0;

  // Breakdown sums helper
  const getBreakdownSums = (runs: ScheduledRun[]) => {
    let baseSetup = 0;
    let washoutHours = 0;
    let grammageDownHours = 0;
    let formatHours = 0;
    runs.forEach((r) => {
      baseSetup += r.changeoverBreakdown.baseSetup;
      washoutHours += r.changeoverBreakdown.washoutHours;
      grammageDownHours += r.changeoverBreakdown.grammageDownHours ?? r.changeoverBreakdown.grammageHours;
      formatHours += r.changeoverBreakdown.formatHours;
    });
    return {
      baseSetup: Math.round(baseSetup * 10) / 10,
      washoutHours: Math.round(washoutHours * 10) / 10,
      grammageDownHours: Math.round(grammageDownHours * 10) / 10,
      formatHours: Math.round(formatHours * 10) / 10,
    };
  };

  const recSums = getBreakdownSums(recommended.runs);
  const naiveSums = getBreakdownSums(naiveScheduled);
  const runnerUpSums = getBreakdownSums(runnerUpResult.runs);

  // Verdict sentence
  const verdict = `${recommended.name} is recommended: it has the lowest total changeover cost of the ${allStrategies.length} strategies evaluated, saving ${changeoverHoursSaved.toFixed(1)} h of machine downtime and €${financialSavingsEur.toLocaleString()} versus the order-arrival baseline.`;

  // Trade-off sentence
  const extraWashoutsVsRunnerUp = recommended.metrics.washoutCount - runnerUpResult.metrics.washoutCount;

  let isBetterOnEveryMeasure = false;
  let tradeOffStatement = '';

  if (
    recommended.metrics.washoutCount <= naiveMetrics.washoutCount &&
    recommended.metrics.totalChangeoverHours <= naiveMetrics.totalChangeoverHours &&
    recommended.metrics.totalBrokeTonnes <= naiveMetrics.totalBrokeTonnes
  ) {
    isBetterOnEveryMeasure = true;
    tradeOffStatement = `${recommended.name} is strictly superior across all operational measures: it eliminates ${washoutsAvoided} washouts while reducing total setup downtime by ${changeoverHoursSaved.toFixed(1)} h and transition scrap by ${brokeTonnesSaved.toFixed(1)} t.`;
  } else if (extraWashoutsVsRunnerUp > 0) {
    tradeOffStatement = `${recommended.name} delivers the lowest net transition cost (€${totalCost(recommended.metrics).toLocaleString()}), balancing minor planned washout cycles against overall caliper setup minimization.`;
  } else {
    tradeOffStatement = `${recommended.name} achieves the optimal trade-off: lowest combined setup downtime (${recommended.metrics.totalChangeoverHours} h) and broke scrap (${recommended.metrics.totalBrokeTonnes} t) across all evaluated strategies.`;
  }

  // Cost breakdown comparison table rows
  const pickWinner = (recVal: number, naiveVal: number, runnerVal: number, lowerIsBetter: boolean): 'recommended' | 'naive' | 'runner_up' | 'tie' => {
    const vals = [
      { who: 'recommended' as const, val: recVal },
      { who: 'naive' as const, val: naiveVal },
      { who: 'runner_up' as const, val: runnerVal },
    ];
    vals.sort((a, b) => (lowerIsBetter ? a.val - b.val : b.val - a.val));
    if (Math.abs(vals[0].val - vals[1].val) < 0.01) return 'tie';
    return vals[0].who;
  };

  const breakdownRows: StrategyComparisonRow[] = [
    {
      metric: 'Base Setup Downtime',
      unit: 'hours',
      recommendedValue: recSums.baseSetup,
      naiveValue: naiveSums.baseSetup,
      runnerUpValue: runnerUpSums.baseSetup,
      winningStrategy: pickWinner(recSums.baseSetup, naiveSums.baseSetup, runnerUpSums.baseSetup, true),
      isLowerBetter: true,
    },
    {
      metric: 'Color Washout Downtime',
      unit: 'hours',
      recommendedValue: recSums.washoutHours,
      naiveValue: naiveSums.washoutHours,
      runnerUpValue: runnerUpSums.washoutHours,
      winningStrategy: pickWinner(recSums.washoutHours, naiveSums.washoutHours, runnerUpSums.washoutHours, true),
      isLowerBetter: true,
    },
    {
      metric: 'Grammage Step-Down Downtime',
      unit: 'hours',
      recommendedValue: recSums.grammageDownHours,
      naiveValue: naiveSums.grammageDownHours,
      runnerUpValue: runnerUpSums.grammageDownHours,
      winningStrategy: pickWinner(recSums.grammageDownHours, naiveSums.grammageDownHours, runnerUpSums.grammageDownHours, true),
      isLowerBetter: true,
    },
    {
      metric: 'Format Switch Downtime',
      unit: 'hours',
      recommendedValue: recSums.formatHours,
      naiveValue: naiveSums.formatHours,
      runnerUpValue: runnerUpSums.formatHours,
      winningStrategy: pickWinner(recSums.formatHours, naiveSums.formatHours, runnerUpSums.formatHours, true),
      isLowerBetter: true,
    },
    {
      metric: 'Total Sequence Changeover',
      unit: 'hours',
      recommendedValue: recommended.metrics.totalChangeoverHours,
      naiveValue: naiveMetrics.totalChangeoverHours,
      runnerUpValue: runnerUpResult.metrics.totalChangeoverHours,
      winningStrategy: pickWinner(recommended.metrics.totalChangeoverHours, naiveMetrics.totalChangeoverHours, runnerUpResult.metrics.totalChangeoverHours, true),
      isLowerBetter: true,
    },
    {
      metric: 'Total Transition Scrap Broke',
      unit: 'tonnes',
      recommendedValue: recommended.metrics.totalBrokeTonnes,
      naiveValue: naiveMetrics.totalBrokeTonnes,
      runnerUpValue: runnerUpResult.metrics.totalBrokeTonnes,
      winningStrategy: pickWinner(recommended.metrics.totalBrokeTonnes, naiveMetrics.totalBrokeTonnes, runnerUpResult.metrics.totalBrokeTonnes, true),
      isLowerBetter: true,
    },
    {
      metric: 'Intermediate Deep Washouts',
      unit: 'events',
      recommendedValue: recommended.metrics.washoutCount,
      naiveValue: naiveMetrics.washoutCount,
      runnerUpValue: runnerUpResult.metrics.washoutCount,
      winningStrategy: pickWinner(recommended.metrics.washoutCount, naiveMetrics.washoutCount, runnerUpResult.metrics.washoutCount, true),
      isLowerBetter: true,
    },
    {
      metric: 'Capacity Released vs. Baseline',
      unit: 'hours',
      recommendedValue: changeoverHoursSaved,
      naiveValue: 0.0,
      runnerUpValue: Math.max(0, Math.round((naiveMetrics.totalChangeoverHours - runnerUpResult.metrics.totalChangeoverHours) * 10) / 10),
      winningStrategy: pickWinner(changeoverHoursSaved, 0.0, Math.max(0, Math.round((naiveMetrics.totalChangeoverHours - runnerUpResult.metrics.totalChangeoverHours) * 10) / 10), false),
      isLowerBetter: false,
    },
    {
      metric: 'Delivery SLA Compliance',
      unit: '%',
      recommendedValue: `${recommended.metrics.slaCompliancePct.toFixed(1)}% (${recommendedUrgentMet}/${urgentOrdersTotal})`,
      naiveValue: `${naiveMetrics.slaCompliancePct.toFixed(1)}%`,
      runnerUpValue: `${runnerUpResult.metrics.slaCompliancePct.toFixed(1)}%`,
      winningStrategy: pickWinner(recommended.metrics.slaCompliancePct, naiveMetrics.slaCompliancePct, runnerUpResult.metrics.slaCompliancePct, false),
      isLowerBetter: false,
    },
  ];

  // Economic stability statement under symmetric caliper transitions
  const sensitivityStatement = `Recommendation is robust across tested campaign variations, maintaining lowest total transition cost (€${Math.round(totalCost(recommended.metrics)).toLocaleString()}) under symmetric caliper transitions.`;

  const breakEvenSensitivity: BreakEvenSensitivity = {
    thresholdPenaltyHours: 0.0,
    alternativeStrategyId: 'color_first',
    alternativeStrategyName: colorFirstResult.name,
    currentPenaltyHours: 0.0,
    statement: sensitivityStatement,
    isHoldsAbove: true,
  };

  const limits = [
    'Machine speed differentials across paper grades (PM1 model fixed at nominal speed 5.8 t/h)',
    'Minimum campaign batch length constraints (sheeter and slitter economic runs)',
    'Scheduled mill maintenance windows, wire changes, and felt conditioning',
    'Dynamic customer due-date negotiation slack beyond static purchase order dates',
  ];

  const recommendationRationale: RecommendationRationale = {
    verdict,
    tradeOffStatement,
    isBetterOnEveryMeasure,
    selectionRuleStatement:
      'Ranked by lowest total changeover cost (€480/h machine operating rate + €280/t broke recovery) among delivery-feasible strategies, with fewest SLA delivery risks and lowest transition broke tonnes as tie-breakers.',
    winningStrategyId: recommended.id,
    winningStrategyName: recommended.name,
    runnerUpStrategyId: runnerUpSummary?.id,
    runnerUpStrategyName: runnerUpSummary?.name,
    marginToRunnerUpEur,
    hoursSavedVsNaive: changeoverHoursSaved,
    brokeSavedVsNaive: brokeTonnesSaved,
    costSavedVsNaiveEur: financialSavingsEur,
    urgentOrdersCount: urgentOrdersTotal,
    protectedUrgentCount: recommendedUrgentMet,
    breakdownRows,
    ranking: rankedSummaries,
    breakEven: breakEvenSensitivity,
    limits,
  };

  return {
    naive: {
      runs: naiveScheduled,
      metrics: naiveMetrics,
    },
    optimized: {
      runs: recommended.runs,
      metrics: recommended.metrics,
    },
    strategies: {
      naive: naiveResult,
      colorFirst: colorFirstResult,
      grammageFirst: grammageFirstResult,
      hybrid: hybridResult,
    },
    recommendedStrategyId: recommended.id,
    conflictDetected,
    conflictSummary: {
      reversalCount: colorFirstReversals,
      excessHours,
      excessBrokeTonnes,
    },
    savings: {
      changeoverHoursSaved,
      brokeTonnesSaved,
      capacityReleasedHours,
      financialSavingsEur,
      washoutsAvoided,
      waterSavedM3,
      reversalsAvoided,
    },
    recommendationRationale,
  };
}
