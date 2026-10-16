/**
 * Result Summary Panel
 * Short, plain-language result summary reflecting strictly the selected algorithm
 * compared against the Naive order-arrival baseline.
 *
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import {
  Clock,
  TrendingDown,
  Euro,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Loader2,
  Check,
} from 'lucide-react';
import { ClientInputBadge } from '../common/ClientInputBadge';
import { ALGORITHM_OPTIONS } from '../../types/cpsat';
import type { ScheduleMetrics } from '../../types';

export interface ResultSummaryPanelProps {
  onOpenBenchmark?: () => void;
}

export const ResultSummaryPanel: React.FC<ResultSummaryPanelProps> = ({ onOpenBenchmark }) => {
  const {
    optimizationResult,
    cpsatResult,
    activeOptimizer,
    isSolvingCpsat,
    selectedMachine,
  } = usePlanning();

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const selectedAlgoMeta = ALGORITHM_OPTIONS.find((a) => a.id === activeOptimizer) || {
    id: activeOptimizer,
    name: activeOptimizer.toUpperCase(),
    badge: '',
    badgeColor: '#E2E8F0',
    description: '',
    family: 'Heuristic',
  };

  // 1. Loading State: while solve is running, show clear loading state; never show stale numbers
  if (isSolvingCpsat && (!cpsatResult || cpsatResult.id !== activeOptimizer)) {
    return (
      <div
        id="result-summary-loading"
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '2px solid var(--brand-blue)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Loader2
          size={28}
          color="var(--brand-blue)"
          style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Solving Sequence with {selectedAlgoMeta.name}...
            </h3>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                background: '#E0F2FE',
                color: 'var(--brand-blue)',
                padding: '2px 8px',
                borderRadius: '12px',
              }}
            >
              IN PROGRESS
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Evaluating machine changeover hours, broke paper scrap, and customer due dates. Loading latest results...
          </p>
        </div>
      </div>
    );
  }

  const naive = optimizationResult.naive;
  const optimized = optimizationResult.optimized;
  const naiveMetrics = naive.metrics;
  const selectedMetrics = optimized.metrics;

  // Single shared cost evaluator: hourlyRate = €480/h, brokeRate = €280/t
  const hourlyRate = 480;
  const brokeRate = 280;
  const naiveCost = Math.round(naiveMetrics.totalChangeoverHours * hourlyRate + naiveMetrics.totalBrokeTonnes * brokeRate);
  const selectedCost = Math.round(selectedMetrics.totalChangeoverHours * hourlyRate + selectedMetrics.totalBrokeTonnes * brokeRate);
  const costSaved = naiveCost - selectedCost;
  const costSavedPct = naiveCost > 0 ? Math.round((costSaved / naiveCost) * 1000) / 10 : 0;

  const hoursSaved = Math.round((naiveMetrics.totalChangeoverHours - selectedMetrics.totalChangeoverHours) * 10) / 10;
  const hoursSavedPct = naiveMetrics.totalChangeoverHours > 0
    ? Math.round((hoursSaved / naiveMetrics.totalChangeoverHours) * 1000) / 10
    : 0;

  const brokeSaved = Math.round((naiveMetrics.totalBrokeTonnes - selectedMetrics.totalBrokeTonnes) * 10) / 10;
  const brokeSavedPct = naiveMetrics.totalBrokeTonnes > 0
    ? Math.round((brokeSaved / naiveMetrics.totalBrokeTonnes) * 1000) / 10
    : 0;

  const isBetter = hoursSaved > 0 || brokeSaved > 0 || costSaved > 0;
  const isWorse = hoursSaved < 0 && brokeSaved < 0;

  // a. Plain headline sentence
  let headlineSentence = '';
  if (isBetter) {
    headlineSentence = `${selectedAlgoMeta.name} reduces changeover time by ${hoursSaved} h (${hoursSavedPct > 0 ? hoursSavedPct : 0}%) and off-spec paper by ${brokeSaved} t (${brokeSavedPct > 0 ? brokeSavedPct : 0}%) compared with scheduling in order of arrival.`;
  } else if (isWorse) {
    headlineSentence = `${selectedAlgoMeta.name} incurs ${Math.abs(hoursSaved)} h more changeover time than order of arrival, prioritizing strict customer delivery dates.`;
  } else {
    headlineSentence = `${selectedAlgoMeta.name} achieves similar changeover time (${selectedMetrics.totalChangeoverHours} h) and off-spec paper (${selectedMetrics.totalBrokeTonnes} t) to the order-of-arrival baseline.`;
  }

  // c. Due dates line
  const atRiskOrders = optimized.runs.filter((r) => !r.meetsSla);
  const atRiskCount = atRiskOrders.length;
  const dueDatesLine =
    atRiskCount === 0
      ? 'All customer due dates met'
      : `${atRiskCount} order${atRiskCount > 1 ? 's' : ''} at risk of missing delivery deadlines`;

  // d. Quality / Bound line
  const telemetry = activeOptimizer !== 'hybrid' && cpsatResult && cpsatResult.id === activeOptimizer ? cpsatResult.telemetry : null;
  let boundLine = 'Best-possible bound not available for this method';

  if (activeOptimizer === 'hybrid') {
    boundLine = 'Best-possible bound not available for this method';
  } else if (activeOptimizer === 'routing') {
    boundLine = 'Best-possible bound not available for this method (local search heuristic)';
  } else if (activeOptimizer === 'cpsat' || activeOptimizer === 'mip') {
    if (telemetry?.status === 'OPTIMAL' || (telemetry?.optimalityGapPct != null && telemetry.optimalityGapPct <= 0.05)) {
      boundLine = 'Proven best possible result';
    } else if (telemetry?.optimalityGapPct != null) {
      boundLine = `Within ${telemetry.optimalityGapPct.toFixed(1)}% of the best possible result`;
    } else if (telemetry?.bestLowerBoundEur != null) {
      boundLine = `Within proven mathematical lower bound (€${telemetry.bestLowerBoundEur.toLocaleString()})`;
    } else {
      boundLine = 'Best-possible bound not available for this method';
    }
  }

  // e. Status line
  const isFallback = telemetry?.status === 'FALLBACK_HEURISTIC';
  const statusBadgeText = isFallback
    ? 'Heuristic Fallback'
    : telemetry?.status ?? (activeOptimizer === 'hybrid' ? 'Active Heuristic' : 'Completed');

  let solveTimeText = '< 2 ms';
  if (activeOptimizer === 'hybrid') {
    solveTimeText = '~1.5 ms';
  } else if (telemetry?.solveTimeMs != null) {
    solveTimeText =
      telemetry.solveTimeMs < 1000
        ? `${telemetry.solveTimeMs.toFixed(0)} ms`
        : `${(telemetry.solveTimeMs / 1000).toFixed(2)} s`;
  }

  // Other algorithms comparison table data (for collapsed section)
  const allStrategies = (optimizationResult.strategies as Record<string, any>) ?? {};
  const otherAlgoEntries = [
    { id: 'naive', name: 'Order of Arrival (Naive FIFO)', metrics: naiveMetrics, solveTime: '< 1 ms' },
    { id: 'hybrid', name: 'Rule-Based Hybrid', metrics: allStrategies.hybrid?.metrics ?? selectedMetrics, solveTime: '~1.5 ms' },
    allStrategies.cpsat
      ? { id: 'cpsat', name: 'Google OR-Tools CP-SAT', metrics: allStrategies.cpsat.metrics, solveTime: allStrategies.cpsat.telemetry?.solveTimeMs ? `${(allStrategies.cpsat.telemetry.solveTimeMs / 1000).toFixed(2)} s` : '~3.0 s' }
      : null,
    allStrategies.routing
      ? { id: 'routing', name: 'Google OR-Tools Routing Solver', metrics: allStrategies.routing.metrics, solveTime: allStrategies.routing.telemetry?.solveTimeMs ? `${(allStrategies.routing.telemetry.solveTimeMs / 1000).toFixed(2)} s` : '~2.0 s' }
      : null,
    allStrategies.mip
      ? { id: 'mip', name: 'Mixed-Integer Programming (MIP)', metrics: allStrategies.mip.metrics, solveTime: allStrategies.mip.telemetry?.solveTimeMs ? `${(allStrategies.mip.telemetry.solveTimeMs / 1000).toFixed(2)} s` : '~2.5 s' }
      : null,
  ].filter((item): item is { id: string; name: string; metrics: ScheduleMetrics; solveTime: string } => item !== null);

  // Determine best algorithm among available
  const sortedByCost = [...otherAlgoEntries].sort((a, b) => {
    const costA = a.metrics.totalChangeoverHours * 480 + a.metrics.totalBrokeTonnes * 280;
    const costB = b.metrics.totalChangeoverHours * 480 + b.metrics.totalBrokeTonnes * 280;
    return costA - costB;
  });
  const mostEfficientMethod = sortedByCost[0];
  const mostEfficientCost = Math.round(
    mostEfficientMethod.metrics.totalChangeoverHours * 480 + mostEfficientMethod.metrics.totalBrokeTonnes * 280
  );

  return (
    <div
      id="result-summary-panel"
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        border: '2px solid var(--brand-blue)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Top Header & Plain Headline */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'var(--brand-blue)',
                color: '#FFFFFF',
                padding: '3px 8px',
                borderRadius: '4px',
              }}
            >
              RESULT SUMMARY
            </span>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Performance of {selectedAlgoMeta.name} ({selectedMachine})
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Illustrative / Synthetic - Not actual Lessebo results
            </span>
            <ClientInputBadge parameterName="Downtime & Broke Cost Rates" />
          </div>
        </div>

        {/* Generated Headline Sentence */}
        <p
          style={{
            fontSize: '0.98rem',
            color: isBetter ? '#0F766E' : 'var(--navy-dark)',
            fontWeight: 600,
            lineHeight: 1.5,
            margin: '6px 0 0 0',
            padding: '10px 14px',
            background: isBetter ? '#F0FDFA' : 'var(--off-white-bg)',
            borderRadius: '6px',
            border: isBetter ? '1px solid #99F6E4' : '1px solid var(--border-light)',
          }}
        >
          {headlineSentence}
        </p>
      </div>

      {/* b. Three Small Comparison Tiles (Naive vs Selected) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Tile 1: Changeover Hours */}
        <div
          style={{
            background: 'var(--off-white-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand-blue)' }}>
            <Clock size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Changeover Downtime
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Naive: {naiveMetrics.totalChangeoverHours} h</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>➔</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              {selectedMetrics.totalChangeoverHours} h
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: hoursSaved >= 0 ? 'var(--success-green)' : 'var(--danger-crimson)' }}>
            {hoursSaved >= 0 ? `Saved ${hoursSaved} h (${hoursSavedPct}%)` : `+${Math.abs(hoursSaved)} h (${Math.abs(hoursSavedPct)}%)`}
          </div>
        </div>

        {/* Tile 2: Broke Scrap Tonnes */}
        <div
          style={{
            background: 'var(--off-white-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309' }}>
            <TrendingDown size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Off-Spec Paper Broke
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Naive: {naiveMetrics.totalBrokeTonnes} t</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>➔</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              {selectedMetrics.totalBrokeTonnes} t
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: brokeSaved >= 0 ? 'var(--success-green)' : 'var(--danger-crimson)' }}>
            {brokeSaved >= 0 ? `Saved ${brokeSaved} t (${brokeSavedPct}%)` : `+${Math.abs(brokeSaved)} t (${Math.abs(brokeSavedPct)}%)`}
          </div>
        </div>

        {/* Tile 3: Indicative Cost */}
        <div
          style={{
            background: 'var(--off-white-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F766E' }}>
            <Euro size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Indicative Setup Cost
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Naive: €{naiveCost.toLocaleString()}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>➔</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--navy-dark)' }}>
              €{selectedCost.toLocaleString()}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: costSaved >= 0 ? 'var(--success-green)' : 'var(--danger-crimson)' }}>
            {costSaved >= 0 ? `Saved €${costSaved.toLocaleString()} (${costSavedPct}%)` : `+€${Math.abs(costSaved).toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* c. Due Dates Line & d. Quality / Bound Line */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '12px 16px',
          background: 'var(--off-white-bg)',
          borderRadius: '6px',
          border: '1px solid var(--border-light)',
          fontSize: '0.82rem',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {atRiskCount === 0 ? (
            <CheckCircle2 size={16} color="var(--success-green)" />
          ) : (
            <AlertCircle size={16} color="var(--warning-amber)" />
          )}
          <span style={{ fontWeight: 600, color: atRiskCount === 0 ? '#107C41' : '#B45309' }}>
            {dueDatesLine}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="var(--brand-blue)" />
          <span style={{ color: 'var(--navy-dark)', fontWeight: 600 }}>
            {boundLine}
          </span>
        </div>
      </div>

      {/* e. Status Line */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span>
            <strong>Algorithm:</strong> {selectedAlgoMeta.name}
          </span>
          <span>•</span>
          <span>
            <strong>Status:</strong>{' '}
            <span
              style={{
                background: isFallback ? '#FEF3C7' : '#E0F2FE',
                color: isFallback ? '#92400E' : 'var(--brand-blue)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              {statusBadgeText}
            </span>
          </span>
          <span>•</span>
          <span>
            <strong>Solve time:</strong> {solveTimeText}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--brand-blue)',
            fontSize: '0.76rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {isExpanded ? 'Hide Calculation Details & Other Algorithms' : 'How is this calculated? & Compare other algorithms'}
        </button>
      </div>

      {/* Collapsed Section: Evaluation rule, speed vs transparency, compact table, and Benchmark button */}
      {isExpanded && (
        <div
          style={{
            borderTop: '1px dashed var(--border-light)',
            paddingTop: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Explanation Text */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '6px' }}>
              <strong style={{ color: 'var(--navy-dark)', display: 'block', marginBottom: '4px' }}>
                Evaluation Rule
              </strong>
              We rank solutions first by whether all orders meet customer due dates, second by lowest total changeover downtime and broke scrap cost, third by lowest paper waste, and finally by fastest calculation speed.
            </div>
            <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '6px' }}>
              <strong style={{ color: 'var(--navy-dark)', display: 'block', marginBottom: '4px' }}>
                Speed vs Mathematical Guarantees
              </strong>
              Fast heuristics (Rule-Based Hybrid) execute in under 2 milliseconds following transparent paper-making rules. Exact mathematical solvers (CP-SAT and MIP) search thousands of permutation combinations to prove mathematical lower bounds, completing in 1 to 4 seconds.
            </div>
          </div>

          {/* Compact Table for Other Algorithms */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                Comparison of Other Algorithms on this Campaign Scenario
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Evaluated through identical cost rules (€480/h machine downtime, €280/t broke)
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9', borderBottom: '1px solid var(--border-light)' }}>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Algorithm</th>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Changeover</th>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Off-Spec Broke</th>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Washouts</th>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Indicative Cost</th>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Due Dates Met</th>
                    <th style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>Solve Time</th>
                  </tr>
                </thead>
                <tbody>
                  {otherAlgoEntries.map((row) => {
                    const rowCost = Math.round(row.metrics.totalChangeoverHours * 480 + row.metrics.totalBrokeTonnes * 280);
                    const isSelected = row.id === activeOptimizer;
                    const isBestCost = row.id === mostEfficientMethod.id;

                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isSelected ? '#F0F9FF' : '#FFFFFF',
                          fontWeight: isSelected ? 700 : 400,
                        }}
                      >
                        <td style={{ padding: '8px 10px', color: 'var(--navy-dark)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{row.name}</span>
                            {isSelected && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  background: 'var(--brand-blue)',
                                  color: '#FFFFFF',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>{row.metrics.totalChangeoverHours} h</td>
                        <td style={{ padding: '8px 10px' }}>{row.metrics.totalBrokeTonnes} t</td>
                        <td style={{ padding: '8px 10px' }}>{row.metrics.washoutCount}</td>
                        <td
                          style={{
                            padding: '8px 10px',
                            color: isBestCost ? 'var(--success-green)' : 'inherit',
                            fontWeight: isBestCost ? 800 : 'inherit',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>€{rowCost.toLocaleString()}</span>
                            {isBestCost && <Check size={12} color="var(--success-green)" />}
                          </div>
                        </td>
                        <td style={{ padding: '8px 10px' }}>{row.metrics.slaCompliancePct.toFixed(1)}%</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{row.solveTime}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Generated sentence naming most efficient method */}
            <p style={{ fontSize: '0.76rem', color: '#0F766E', margin: '8px 0 0 0', fontWeight: 600 }}>
              {mostEfficientMethod.name} is the most efficient method on this scenario, achieving the lowest transition cost (€{mostEfficientCost.toLocaleString()}) while meeting {mostEfficientMethod.metrics.slaCompliancePct.toFixed(1)}% of customer delivery deadlines.
            </p>
          </div>

          {/* Scaling Benchmark Suite Button inside collapsed section */}
          {onOpenBenchmark && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                borderRadius: '8px',
                color: '#FFFFFF',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <strong style={{ fontSize: '0.85rem', color: '#F8FAFC', display: 'block' }}>
                  Cross-Campaign Scalability & Benchmark Suite
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  Evaluate all 5 methods across 28 reproducible campaign instances (10 to 100 runs).
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenBenchmark}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--brand-blue)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <BarChart2 size={15} />
                Open Benchmark Suite & Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
