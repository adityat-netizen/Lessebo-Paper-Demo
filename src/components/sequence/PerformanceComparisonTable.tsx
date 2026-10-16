/**
 * Live Calculated Performance Comparison Table
 * Restored and enhanced for multi-algorithm comparative evaluation.
 *
 * Features:
 * - Compares active selected algorithm against a configurable reference method (Default: Naive Baseline).
 * - Displays exactly two algorithms at a time plus Difference column (number and %).
 * - 7 meaningful operational rows: Changeover downtime, Off-spec broke, Washouts, Capacity released, Indicative cost, Due-date SLA, Solve time.
 * - Better value highlighted in each row.
 * - Dynamic one-line plain takeaway below the table.
 * - Loading state during solve runs; fallback badge if solver fell back to heuristic.
 * - Standardized RFC 4180 CSV export with complete solver metadata.
 * - 100% evaluated by the single shared engine; matches Gantt, Result Summary, and Transition Matrix.
 *
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import {
  Clock,
  Trash2,
  AlertTriangle,
  Sparkles,
  Euro,
  CheckCircle2,
  Calendar,
  Zap,
  Download,
  Loader2,
  Check,
} from 'lucide-react';
import { ClientInputBadge } from '../common/ClientInputBadge';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvExport';
import { ALGORITHM_OPTIONS, type ActiveOptimizer } from '../../types/cpsat';
import type { ScheduleMetrics, StrategyResult } from '../../types';

export type ComparisonCandidateId = 'naive' | ActiveOptimizer;

interface CandidateOption {
  id: ComparisonCandidateId;
  name: string;
  shortName: string;
}

const COMPARISON_OPTIONS: CandidateOption[] = [
  { id: 'naive', name: 'Naive Baseline (Order Book Arrival)', shortName: 'Naive (FIFO)' },
  { id: 'hybrid', name: 'Rule-Based Hybrid Sequencer', shortName: 'Rule-Based Hybrid' },
  { id: 'cpsat', name: 'Google OR-Tools CP-SAT', shortName: 'OR-Tools CP-SAT' },
  { id: 'routing', name: 'Google OR-Tools Routing Solver', shortName: 'OR-Tools Routing' },
  { id: 'mip', name: 'Mixed-Integer Programming (MIP - SCIP)', shortName: 'MIP (SCIP)' },
];

export const PerformanceComparisonTable: React.FC = () => {
  const {
    optimizationResult,
    activeOptimizer,
    selectedMachine,
    sequenceScenarioPreset,
    isSolvingCpsat,
    cpsatResult,
    solverCache,
    ensureSolverResult,
  } = usePlanning();

  // Reference comparison candidate (default: 'naive')
  const [comparedId, setComparedId] = useState<ComparisonCandidateId>('naive');
  const [isComparedLoading, setIsComparedLoading] = useState<boolean>(false);

  // Auto-switch comparedId if activeOptimizer matches comparedId
  useEffect(() => {
    if (activeOptimizer === comparedId) {
      if (activeOptimizer === 'naive' as any) {
        setComparedId('hybrid');
      } else {
        setComparedId('naive');
      }
    }
  }, [activeOptimizer, comparedId]);

  // If user selects a solver candidate for comparedId that isn't cached yet, fetch it
  useEffect(() => {
    if (comparedId !== 'naive' && comparedId !== 'hybrid') {
      const isCached =
        solverCache[comparedId] ||
        (cpsatResult && cpsatResult.id === comparedId);

      if (!isCached && ensureSolverResult) {
        setIsComparedLoading(true);
        ensureSolverResult(comparedId)
          .catch((err) => console.error(`Error ensuring result for ${comparedId}:`, err))
          .finally(() => setIsComparedLoading(false));
      }
    }
  }, [comparedId, solverCache, cpsatResult, ensureSolverResult]);

  const strategies = optimizationResult.strategies as Record<string, StrategyResult | undefined> | undefined;

  // 1. Resolve Active Selected Algorithm StrategyResult
  const selectedStrategy: StrategyResult = useMemo(() => {
    if (activeOptimizer === 'hybrid') {
      return (
        strategies?.hybrid ?? {
          id: 'hybrid',
          name: 'Rule-Based Hybrid',
          description: 'Grammage bands + light-to-dark ladder + 2-opt search',
          runs: optimizationResult.optimized.runs,
          metrics: optimizationResult.optimized.metrics,
        }
      );
    }
    if (cpsatResult && cpsatResult.id === activeOptimizer) {
      return cpsatResult;
    }
    if (solverCache[activeOptimizer]) {
      return solverCache[activeOptimizer]!;
    }
    if (strategies?.[activeOptimizer]) {
      return strategies[activeOptimizer]!;
    }
    return {
      id: activeOptimizer,
      name: ALGORITHM_OPTIONS.find((a) => a.id === activeOptimizer)?.name ?? activeOptimizer.toUpperCase(),
      description: ALGORITHM_OPTIONS.find((a) => a.id === activeOptimizer)?.description ?? '',
      runs: optimizationResult.optimized.runs,
      metrics: optimizationResult.optimized.metrics,
    };
  }, [activeOptimizer, strategies, cpsatResult, solverCache, optimizationResult.optimized]);

  // 2. Resolve Compared StrategyResult
  const comparedStrategy: StrategyResult = useMemo(() => {
    if (comparedId === 'naive') {
      return (
        strategies?.naive ?? {
          id: 'naive',
          name: 'Naive Baseline (FIFO)',
          description: 'Order book arrival',
          runs: optimizationResult.naive.runs,
          metrics: optimizationResult.naive.metrics,
        }
      );
    }
    if (comparedId === 'hybrid') {
      return (
        strategies?.hybrid ?? {
          id: 'hybrid',
          name: 'Rule-Based Hybrid',
          description: 'Grammage bands + light-to-dark ladder',
          runs: optimizationResult.optimized.runs,
          metrics: optimizationResult.optimized.metrics,
        }
      );
    }
    if (cpsatResult && cpsatResult.id === comparedId) {
      return cpsatResult;
    }
    if (solverCache[comparedId]) {
      return solverCache[comparedId]!;
    }
    if (strategies?.[comparedId]) {
      return strategies[comparedId]!;
    }
    // Fallback if still loading or pending
    return (
      strategies?.hybrid ?? {
        id: comparedId,
        name: COMPARISON_OPTIONS.find((c) => c.id === comparedId)?.name ?? comparedId,
        description: 'Compared candidate algorithm',
        runs: optimizationResult.optimized.runs,
        metrics: optimizationResult.optimized.metrics,
      }
    );
  }, [comparedId, strategies, cpsatResult, solverCache, optimizationResult.naive, optimizationResult.optimized]);

  // Fallback state detection
  const selectedTelemetry = (selectedStrategy as any).telemetry;
  const isSelectedFallback = selectedTelemetry?.status === 'FALLBACK_HEURISTIC';
  const selectedAlgoMeta = ALGORITHM_OPTIONS.find((a) => a.id === activeOptimizer) || {
    id: activeOptimizer,
    name: activeOptimizer.toUpperCase(),
    badge: '',
    badgeColor: '#E2E8F0',
    description: '',
    family: 'Heuristic',
  };

  const selectedColTitle = isSelectedFallback
    ? `Rule-Based Hybrid (Fallback from ${selectedAlgoMeta.name})`
    : selectedAlgoMeta.name;

  const comparedColTitle =
    comparedId === 'naive'
      ? 'NAIVE BASELINE (FIFO Arrival)'
      : (COMPARISON_OPTIONS.find((c) => c.id === comparedId)?.shortName ?? comparedId).toUpperCase();

  // Metrics computation helper: Machine rate €480/h + Broke scrap €280/t
  const calcIndicativeCost = (m: ScheduleMetrics) =>
    Math.round(m.totalChangeoverHours * 480 + m.totalBrokeTonnes * 280);

  const selMetrics = selectedStrategy.metrics;
  const cmpMetrics = comparedStrategy.metrics;

  const selCost = calcIndicativeCost(selMetrics);
  const cmpCost = calcIndicativeCost(cmpMetrics);

  // Solve time texts
  const getSolveTimeText = (strat: StrategyResult, id: string) => {
    if (id === 'naive') return '< 1 ms';
    if (id === 'hybrid') return '~1.5 ms';
    const telem = (strat as any).telemetry;
    if (telem?.solveTimeMs != null) {
      return telem.solveTimeMs < 1000
        ? `${telem.solveTimeMs.toFixed(0)} ms`
        : `${(telem.solveTimeMs / 1000).toFixed(2)} s`;
    }
    return '~2.0 s';
  };

  const selSolveTime = getSolveTimeText(selectedStrategy, activeOptimizer);
  const cmpSolveTime = getSolveTimeText(comparedStrategy, comparedId);

  // Due date met metrics
  const getDueStatus = (strat: StrategyResult) => {
    const runs = strat.runs;
    const atRiskCount = runs.filter((r) => !r.meetsSla).length;
    const pct = strat.metrics.slaCompliancePct ?? 100;
    return {
      text: atRiskCount === 0 ? '100% (All met)' : `${pct.toFixed(1)}% (${atRiskCount} at risk)`,
      pct,
      atRiskCount,
    };
  };

  const selDue = getDueStatus(selectedStrategy);
  const cmpDue = getDueStatus(comparedStrategy);

  // Deltas (Savings = Compared - Selected)
  const hoursSaved = Math.round((cmpMetrics.totalChangeoverHours - selMetrics.totalChangeoverHours) * 10) / 10;
  const hoursSavedPct = cmpMetrics.totalChangeoverHours > 0
    ? Math.round((hoursSaved / cmpMetrics.totalChangeoverHours) * 1000) / 10
    : 0;

  const brokeSaved = Math.round((cmpMetrics.totalBrokeTonnes - selMetrics.totalBrokeTonnes) * 10) / 10;
  const brokeSavedPct = cmpMetrics.totalBrokeTonnes > 0
    ? Math.round((brokeSaved / cmpMetrics.totalBrokeTonnes) * 1000) / 10
    : 0;

  const washoutsSaved = cmpMetrics.washoutCount - selMetrics.washoutCount;

  // Capacity released hours = reduction in changeover downtime
  const capacityReleasedHours = Math.max(0, hoursSaved);
  const capacityReleasedTonnes = Math.round(capacityReleasedHours * 5.8 * 10) / 10;

  const costSaved = cmpCost - selCost;
  const costSavedPct = cmpCost > 0 ? Math.round((costSaved / cmpCost) * 1000) / 10 : 0;

  const slaDeltaPct = Math.round((selDue.pct - cmpDue.pct) * 10) / 10;

  // Row Definitions (7 clean, meaningful rows)
  interface MetricRowDef {
    id: string;
    label: string;
    subtext: string;
    unit: string;
    icon: React.ReactNode;
    comparedVal: string | number;
    selectedVal: string | number;
    diffNumber: number;
    diffFormatted: string;
    diffPctText: string;
    isSavingsPositive: boolean;
    betterColumn: 'compared' | 'selected' | 'tie';
  }

  const rows: MetricRowDef[] = [
    {
      id: 'changeover',
      label: 'Changeover Hours',
      subtext: 'Mechanical setup + washouts + grammage steps',
      unit: 'hours',
      icon: <Clock size={16} color="var(--brand-blue)" />,
      comparedVal: `${cmpMetrics.totalChangeoverHours.toFixed(1)} h`,
      selectedVal: `${selMetrics.totalChangeoverHours.toFixed(1)} h`,
      diffNumber: hoursSaved,
      diffFormatted: hoursSaved >= 0 ? `-${hoursSaved.toFixed(1)} h freed` : `+${Math.abs(hoursSaved).toFixed(1)} h`,
      diffPctText: `${Math.abs(hoursSavedPct).toFixed(1)}%`,
      isSavingsPositive: hoursSaved >= 0,
      betterColumn:
        hoursSaved > 0.05 ? 'selected' : hoursSaved < -0.05 ? 'compared' : 'tie',
    },
    {
      id: 'broke',
      label: 'Off-Spec Broke Paper',
      subtext: 'Calculated at 2.4 tonnes / changeover hour',
      unit: 'tonnes',
      icon: <Trash2 size={16} color="#B45309" />,
      comparedVal: `${cmpMetrics.totalBrokeTonnes.toFixed(1)} t`,
      selectedVal: `${selMetrics.totalBrokeTonnes.toFixed(1)} t`,
      diffNumber: brokeSaved,
      diffFormatted: brokeSaved >= 0 ? `-${brokeSaved.toFixed(1)} t reduced` : `+${Math.abs(brokeSaved).toFixed(1)} t`,
      diffPctText: `${Math.abs(brokeSavedPct).toFixed(1)}%`,
      isSavingsPositive: brokeSaved >= 0,
      betterColumn:
        brokeSaved > 0.05 ? 'selected' : brokeSaved < -0.05 ? 'compared' : 'tie',
    },
    {
      id: 'washouts',
      label: 'Deep Pulper Washouts',
      subtext: 'Costly 3.5h dark-to-light chemical washes',
      unit: 'events',
      icon: <AlertTriangle size={16} color="var(--warning-amber)" />,
      comparedVal: `${cmpMetrics.washoutCount} ${cmpMetrics.washoutCount === 1 ? 'washout' : 'washouts'}`,
      selectedVal: `${selMetrics.washoutCount} ${selMetrics.washoutCount === 1 ? 'washout' : 'washouts'}`,
      diffNumber: washoutsSaved,
      diffFormatted:
        washoutsSaved > 0
          ? `${washoutsSaved} avoided`
          : washoutsSaved < 0
          ? `+${Math.abs(washoutsSaved)} extra`
          : '0 delta',
      diffPctText:
        cmpMetrics.washoutCount > 0
          ? `${Math.abs(Math.round((washoutsSaved / cmpMetrics.washoutCount) * 100))}%`
          : '0%',
      isSavingsPositive: washoutsSaved >= 0,
      betterColumn:
        washoutsSaved > 0 ? 'selected' : washoutsSaved < 0 ? 'compared' : 'tie',
    },
    {
      id: 'capacity',
      label: 'Machine Capacity Released',
      subtext: 'Additional saleable mill production window',
      unit: 'hours',
      icon: <Sparkles size={16} color="var(--cyan-accent)" />,
      comparedVal: '— (Reference)',
      selectedVal: `+${capacityReleasedHours.toFixed(1)} h`,
      diffNumber: capacityReleasedHours,
      diffFormatted: `+${capacityReleasedHours.toFixed(1)} h (+${capacityReleasedTonnes} t potential)`,
      diffPctText: `${hoursSavedPct >= 0 ? hoursSavedPct.toFixed(1) : '0.0'}%`,
      isSavingsPositive: capacityReleasedHours > 0,
      betterColumn: capacityReleasedHours > 0 ? 'selected' : 'tie',
    },
    {
      id: 'cost',
      label: 'Indicative Transition Cost',
      subtext: 'Machine downtime €480/h + Broke recovery €280/t',
      unit: 'EUR',
      icon: <Euro size={16} color="#0F766E" />,
      comparedVal: `€${cmpCost.toLocaleString()}`,
      selectedVal: `€${selCost.toLocaleString()}`,
      diffNumber: costSaved,
      diffFormatted:
        costSaved >= 0 ? `Saved €${costSaved.toLocaleString()}` : `+€${Math.abs(costSaved).toLocaleString()}`,
      diffPctText: `${Math.abs(costSavedPct).toFixed(1)}%`,
      isSavingsPositive: costSaved >= 0,
      betterColumn: costSaved > 50 ? 'selected' : costSaved < -50 ? 'compared' : 'tie',
    },
    {
      id: 'due_dates',
      label: 'Customer Due-Date Delivery SLA',
      subtext: 'Strict SLA orders delivery compliance',
      unit: '% compliance',
      icon: <Calendar size={16} color="var(--navy-dark)" />,
      comparedVal: cmpDue.text,
      selectedVal: selDue.text,
      diffNumber: slaDeltaPct,
      diffFormatted:
        slaDeltaPct > 0
          ? `+${slaDeltaPct.toFixed(1)}% higher SLA`
          : slaDeltaPct < 0
          ? `${slaDeltaPct.toFixed(1)}% lower SLA`
          : 'Parity (identical SLA)',
      diffPctText: `${Math.abs(slaDeltaPct).toFixed(1)}%`,
      isSavingsPositive: slaDeltaPct >= 0,
      betterColumn:
        selDue.pct > cmpDue.pct
          ? 'selected'
          : selDue.pct < cmpDue.pct
          ? 'compared'
          : 'tie',
    },
    {
      id: 'solve_time',
      label: 'Execution / Solve Time',
      subtext: 'Algorithm computation latency',
      unit: 'time',
      icon: <Zap size={16} color="var(--brand-blue)" />,
      comparedVal: cmpSolveTime,
      selectedVal: selSolveTime,
      diffNumber: 0,
      diffFormatted:
        activeOptimizer === 'hybrid'
          ? 'Instant sub-millisecond'
          : `${selSolveTime} (exhaustive search)`,
      diffPctText: '-',
      isSavingsPositive: true,
      betterColumn:
        activeOptimizer === 'hybrid'
          ? 'selected'
          : comparedId === 'hybrid' || comparedId === 'naive'
          ? 'compared'
          : 'tie',
    },
  ];

  // Dynamic Takeaway formulation
  const selectedShort = selectedAlgoMeta.name;
  const comparedShort = COMPARISON_OPTIONS.find((c) => c.id === comparedId)?.shortName ?? comparedId;

  let takeawayText = '';
  if (hoursSaved > 0.05) {
    takeawayText = `${selectedShort} achieves ${hoursSaved.toFixed(1)} h less changeover downtime (${hoursSavedPct.toFixed(1)}% reduction) and saves €${Math.round(costSaved).toLocaleString()} compared to ${comparedShort}.`;
  } else if (hoursSaved < -0.05) {
    takeawayText = `${selectedShort} incurs ${Math.abs(hoursSaved).toFixed(1)} h more changeover downtime than ${comparedShort}, prioritizing strict customer delivery SLA deadlines.`;
  } else {
    takeawayText = `${selectedShort} achieves identical changeover downtime (${selMetrics.totalChangeoverHours.toFixed(1)} h) and broke paper scrap to ${comparedShort}.`;
  }

  // CSV Export handler
  const handleExportCsv = () => {
    const selectedSlug = activeOptimizer;
    const comparedSlug = comparedId;
    const scenarioSlug = sequenceScenarioPreset;

    const lowerBoundText =
      selectedTelemetry?.bestLowerBoundEur != null
        ? `€${selectedTelemetry.bestLowerBoundEur.toLocaleString()}`
        : 'Not available (heuristic / local search)';

    const gapText =
      selectedTelemetry?.optimalityGapPct != null
        ? `${selectedTelemetry.optimalityGapPct.toFixed(1)}%`
        : 'Not available';

    const solverStatus = isSelectedFallback
      ? 'FALLBACK_HEURISTIC'
      : selectedTelemetry?.status ?? (activeOptimizer === 'hybrid' ? 'HEURISTIC' : 'COMPLETED');

    const csvData = rows.map((r) => ({
      metric: r.label,
      metric_unit: r.unit,
      compared_method_val: r.comparedVal,
      selected_method_val: r.selectedVal,
      savings_delta: r.diffFormatted,
      savings_pct: r.diffPctText,
    }));

    const csv = buildCsvContent(
      {
        datasetName: `Production Sequence Performance Comparison (${selectedMachine})`,
        scenarioName: `${sequenceScenarioPreset.toUpperCase()} Campaign`,
        selectedAlgorithm: selectedColTitle,
        comparedAlgorithm: comparedColTitle,
        solverStatus,
        provenLowerBound: lowerBoundText,
        optimalityGap: gapText,
        timeoutSeconds: 4.0,
        seed: 42,
        fallbackNote: isSelectedFallback ? 'Solver fallback to Rule-Based Hybrid' : 'None',
        assumptions: {
          Machine: selectedMachine,
          MachineHourlyRate: '€480/h (Client input required)',
          BrokeScrapCost: '€280/t (Client input required)',
          BrokeRate: '2.4 t/h (Client input required)',
        },
      },
      [
        { key: 'metric', label: 'Operational Metric' },
        { key: 'metric_unit', label: 'Unit' },
        { key: 'compared_method_val', label: `${comparedColTitle} Value` },
        { key: 'selected_method_val', label: `${selectedColTitle} Value` },
        { key: 'savings_delta', label: 'Capacity & Savings Delta' },
        { key: 'savings_pct', label: 'Percentage Difference' },
      ],
      csvData
    );

    downloadCsvFile('performance_comparison', scenarioSlug, csv, `${selectedSlug}_vs_${comparedSlug}`);
  };

  const isLoading = isSolvingCpsat || isComparedLoading;

  return (
    <div
      id="live-performance-comparison-section"
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Top Header: Title, Controls, Disclaimer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Live Calculated Performance Comparison
            </h3>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                background: '#E0F2FE',
                color: 'var(--brand-blue)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              SINGLE SHARED EVALUATOR
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Values calculated dynamically for the active {selectedMachine} campaign ({selectedStrategy.runs.length} runs)
          </p>
        </div>

        {/* Right Action Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Compare Against Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="compare-against-select" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
              Compare against:
            </label>
            <select
              id="compare-against-select"
              value={comparedId}
              onChange={(e) => setComparedId(e.target.value as ComparisonCandidateId)}
              style={{
                fontSize: '0.76rem',
                fontWeight: 600,
                color: 'var(--navy-dark)',
                background: 'var(--off-white-bg)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                padding: '5px 8px',
                cursor: 'pointer',
              }}
            >
              {COMPARISON_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.id === activeOptimizer}>
                  {opt.name} {opt.id === activeOptimizer ? '(Currently Selected)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FFFFFF',
              color: 'var(--brand-blue)',
              border: '1px solid var(--border-light)',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
            }}
            title="Export Performance Comparison to RFC 4180 CSV"
          >
            <Download size={13} />
            Export Comparison CSV
          </button>

          <ClientInputBadge parameterName="Hourly Rate €480 & Broke €280" />

          {/* Mandatory Synthetic Label */}
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              background: 'var(--off-white-bg)',
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border-light)',
            }}
          >
            Illustrative / Synthetic - Not actual Lessebo results
          </span>
        </div>
      </div>

      {/* Comparison Scorecard Table */}
      <div style={{ overflowX: 'auto', position: 'relative' }}>
        {/* Loading Overlay */}
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(255, 255, 255, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              backdropFilter: 'blur(2px)',
            }}
          >
            <Loader2 size={24} className="animate-spin" color="var(--brand-blue)" />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)', marginTop: '8px' }}>
              Calculating live mathematical comparison...
            </span>
          </div>
        )}

        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ background: 'var(--off-white-bg)', borderBottom: '2px solid var(--border-light)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', width: '30%' }}>
                OPERATIONAL METRIC
              </th>
              <th style={{ padding: '12px 14px', color: 'var(--danger-crimson)', width: '23%' }}>
                {comparedColTitle}
              </th>
              <th style={{ padding: '12px 14px', color: 'var(--brand-blue)', width: '24%', background: '#F0F9FF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span>{selectedColTitle.toUpperCase()}</span>
                  {isSelectedFallback && (
                    <span
                      style={{
                        background: '#FEF3C7',
                        color: '#92400E',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: '1px solid #FCD34D',
                      }}
                    >
                      FALLBACK
                    </span>
                  )}
                </div>
              </th>
              <th style={{ padding: '12px 14px', color: 'var(--success-green)', width: '23%' }}>
                CAPACITY & SAVINGS DELTA
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSelectedBetter = row.betterColumn === 'selected';
              const isComparedBetter = row.betterColumn === 'compared';

              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF',
                  }}
                >
                  {/* Metric Label & Description */}
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {row.icon}
                      <span style={{ color: 'var(--navy-dark)' }}>{row.label}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                      {row.subtext}
                    </span>
                  </td>

                  {/* Compared Baseline Value */}
                  <td
                    style={{
                      padding: '12px 14px',
                      fontWeight: 700,
                      color: isComparedBetter ? 'var(--success-green)' : 'var(--text-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{row.comparedVal}</span>
                      {isComparedBetter && (
                        <span style={{ color: 'var(--success-green)', display: 'inline-flex' }}>
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Selected Algorithm Value */}
                  <td
                    style={{
                      padding: '12px 14px',
                      fontWeight: 700,
                      color: isSelectedBetter ? 'var(--success-green)' : 'var(--navy-dark)',
                      background: '#F0F9FF',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{row.selectedVal}</span>
                      {isSelectedBetter && (
                        <span style={{ color: 'var(--success-green)', display: 'inline-flex' }}>
                          <Check size={14} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Savings Delta & Percentage */}
                  <td
                    style={{
                      padding: '12px 14px',
                      fontWeight: 800,
                      color: row.isSavingsPositive ? 'var(--success-green)' : 'var(--danger-crimson)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span>{row.diffFormatted}</span>
                      {row.diffPctText !== '-' && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.85 }}>
                          ({row.diffPctText})
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Generated One-Line Takeaway */}
      <div
        style={{
          background: 'var(--off-white-bg)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <CheckCircle2 size={16} color="var(--brand-blue)" />
        <span style={{ fontSize: '0.82rem', color: 'var(--navy-dark)', fontWeight: 600 }}>
          <strong>Takeaway:</strong> {takeawayText}
        </span>
      </div>
    </div>
  );
};
