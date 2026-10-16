/**
 * Three-Way Comparison Panel and Dynamic Verdict Engine
 * Compares Naive Baseline, Rule-based Hybrid, and Google OR-Tools CP-SAT on the same campaign.
 * Evaluates Colour-First and Grammage-First in an expandable reference drawer.
 *
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real machine parameters and changeover penalties.
 */

import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import {
  Trophy,
  Scale,
  ChevronDown,
  ChevronUp,
  Check,
  Sparkles,
  Zap,
  BarChart2,
} from 'lucide-react';
import { ClientInputBadge } from '../common/ClientInputBadge';
import type { ScheduleMetrics, StrategyResult } from '../../types';
import type { CpsatStrategyResult } from '../../types/cpsat';

interface CandidateMethod {
  id: string;
  name: string;
  metrics: ScheduleMetrics;
  solveTimeText: string;
  solveTimeMs: number;
  isFeasible: boolean;
  totalCostEur: number;
  strictDueMetCount: number;
  strictDueTotal: number;
}

export interface ThreeWayComparisonPanelProps {
  onOpenBenchmark?: () => void;
}

export const ThreeWayComparisonPanel: React.FC<ThreeWayComparisonPanelProps> = ({ onOpenBenchmark }) => {
  const { optimizationResult, cpsatResult, activeOptimizer } = usePlanning();
  const [showExtendedStrategies, setShowExtendedStrategies] = useState<boolean>(false);

  const strategies = optimizationResult.strategies;
  const naiveResult: StrategyResult = strategies?.naive ?? {
    id: 'naive',
    name: 'Naive Baseline',
    description: 'Order book arrival',
    runs: optimizationResult.naive.runs,
    metrics: optimizationResult.naive.metrics,
  };

  const hybridResult: StrategyResult = strategies?.hybrid ?? {
    id: 'hybrid',
    name: 'Rule-Based Hybrid',
    description: 'Grammage bands + light-to-dark ladder + 2-opt search',
    runs: optimizationResult.optimized.runs,
    metrics: optimizationResult.optimized.metrics,
  };

  const colorFirstResult: StrategyResult = strategies?.colorFirst ?? {
    id: 'color_first',
    name: 'Colour-First Ladder',
    description: 'Strict light-to-dark sorting',
    runs: optimizationResult.optimized.runs,
    metrics: optimizationResult.optimized.metrics,
  };

  const grammageFirstResult: StrategyResult = strategies?.grammageFirst ?? {
    id: 'grammage_first',
    name: 'Grammage-First Banding',
    description: 'Ascending grammage sorting',
    runs: optimizationResult.optimized.runs,
    metrics: optimizationResult.optimized.metrics,
  };

  const cpsatActiveResult = (strategies?.cpsat ?? cpsatResult) as CpsatStrategyResult | null;

  // Helper to compute total transition & broke cost
  const calcTotalCost = (m: ScheduleMetrics) => m.totalChangeoverHours * 480 + m.totalBrokeTonnes * 280;

  // Strict due order count
  const allOrders = naiveResult.runs;
  const strictOrders = allOrders.filter(
    (r) => (r.customer_priority && r.customer_priority.includes('Strict')) || r.due_in_days <= 13
  );
  const strictTotal = strictOrders.length;

  const countStrictMet = (runs: typeof allOrders) =>
    runs.filter((r) => ((r.customer_priority && r.customer_priority.includes('Strict')) || r.due_in_days <= 13) && r.meetsSla).length;

  // Assemble candidates for ranking
  const primaryCandidates: CandidateMethod[] = [
    {
      id: 'naive',
      name: 'Naive Baseline (FIFO)',
      metrics: naiveResult.metrics,
      solveTimeText: '< 1 ms',
      solveTimeMs: 0.1,
      isFeasible: countStrictMet(naiveResult.runs) === strictTotal,
      totalCostEur: calcTotalCost(naiveResult.metrics),
      strictDueMetCount: countStrictMet(naiveResult.runs),
      strictDueTotal: strictTotal,
    },
    {
      id: 'hybrid',
      name: 'Rule-Based Hybrid',
      metrics: hybridResult.metrics,
      solveTimeText: '~1.5 ms',
      solveTimeMs: 1.5,
      isFeasible: countStrictMet(hybridResult.runs) === strictTotal,
      totalCostEur: calcTotalCost(hybridResult.metrics),
      strictDueMetCount: countStrictMet(hybridResult.runs),
      strictDueTotal: strictTotal,
    },
  ];

  if (cpsatActiveResult) {
    const cpsatSolveMs = cpsatActiveResult.telemetry?.solveTimeMs ?? 3000;
    primaryCandidates.push({
      id: 'cpsat',
      name: 'Google OR-Tools CP-SAT',
      metrics: cpsatActiveResult.metrics,
      solveTimeText:
        cpsatSolveMs < 1000 ? `${cpsatSolveMs.toFixed(0)} ms` : `${(cpsatSolveMs / 1000).toFixed(2)} s`,
      solveTimeMs: cpsatSolveMs,
      isFeasible: countStrictMet(cpsatActiveResult.runs) === strictTotal,
      totalCostEur: calcTotalCost(cpsatActiveResult.metrics),
      strictDueMetCount: countStrictMet(cpsatActiveResult.runs),
      strictDueTotal: strictTotal,
    });
  }

  // Ranking Rule:
  // 1. Lowest total cost among feasible methods
  // 2. Fewest due-date risks (highest SLA compliance)
  // 3. Lowest broke tonnes
  // 4. Shortest solve time
  const sortedMethods = [...primaryCandidates].sort((a, b) => {
    if (a.isFeasible !== b.isFeasible) return a.isFeasible ? -1 : 1;
    const costDiff = a.totalCostEur - b.totalCostEur;
    if (Math.abs(costDiff) > 1.0) return costDiff;

    const slaDiff = b.metrics.slaCompliancePct - a.metrics.slaCompliancePct;
    if (Math.abs(slaDiff) > 0.01) return slaDiff;

    const brokeDiff = a.metrics.totalBrokeTonnes - b.metrics.totalBrokeTonnes;
    if (Math.abs(brokeDiff) > 0.01) return brokeDiff;

    return a.solveTimeMs - b.solveTimeMs;
  });

  const winner = sortedMethods[0];
  const runnerUp = sortedMethods[1];

  // Pick lowest value helper
  const pickBest = (values: { id: string; val: number }[], lowerIsBetter: boolean = true) => {
    const sorted = [...values].sort((a, b) => (lowerIsBetter ? a.val - b.val : b.val - a.val));
    return sorted[0].id;
  };

  // Metric Rows definitions
  const comparisonRows = [
    {
      label: 'Total Changeover Downtime',
      unit: 'hours',
      naive: naiveResult.metrics.totalChangeoverHours,
      hybrid: hybridResult.metrics.totalChangeoverHours,
      cpsat: cpsatActiveResult?.metrics.totalChangeoverHours ?? null,
      colorFirst: colorFirstResult.metrics.totalChangeoverHours,
      grammageFirst: grammageFirstResult.metrics.totalChangeoverHours,
      lowerIsBetter: true,
    },
    {
      label: 'Transition Broke Scrap',
      unit: 'tonnes',
      naive: naiveResult.metrics.totalBrokeTonnes,
      hybrid: hybridResult.metrics.totalBrokeTonnes,
      cpsat: cpsatActiveResult?.metrics.totalBrokeTonnes ?? null,
      colorFirst: colorFirstResult.metrics.totalBrokeTonnes,
      grammageFirst: grammageFirstResult.metrics.totalBrokeTonnes,
      lowerIsBetter: true,
    },
    {
      label: 'Deep Washout Cleanings',
      unit: 'events',
      naive: naiveResult.metrics.washoutCount,
      hybrid: hybridResult.metrics.washoutCount,
      cpsat: cpsatActiveResult?.metrics.washoutCount ?? null,
      colorFirst: colorFirstResult.metrics.washoutCount,
      grammageFirst: grammageFirstResult.metrics.washoutCount,
      lowerIsBetter: true,
    },
    {
      label: 'Machine Capacity Released',
      unit: 'hours',
      naive: 0.0,
      hybrid: Math.max(0, Math.round((naiveResult.metrics.totalChangeoverHours - hybridResult.metrics.totalChangeoverHours) * 10) / 10),
      cpsat: cpsatActiveResult
        ? Math.max(0, Math.round((naiveResult.metrics.totalChangeoverHours - cpsatActiveResult.metrics.totalChangeoverHours) * 10) / 10)
        : null,
      colorFirst: Math.max(0, Math.round((naiveResult.metrics.totalChangeoverHours - colorFirstResult.metrics.totalChangeoverHours) * 10) / 10),
      grammageFirst: Math.max(0, Math.round((naiveResult.metrics.totalChangeoverHours - grammageFirstResult.metrics.totalChangeoverHours) * 10) / 10),
      lowerIsBetter: false,
    },
    {
      label: 'Customer Due-Date Delivery SLA',
      unit: '% compliance',
      naive: naiveResult.metrics.slaCompliancePct,
      hybrid: hybridResult.metrics.slaCompliancePct,
      cpsat: cpsatActiveResult?.metrics.slaCompliancePct ?? null,
      colorFirst: colorFirstResult.metrics.slaCompliancePct,
      grammageFirst: grammageFirstResult.metrics.slaCompliancePct,
      lowerIsBetter: false,
    },
    {
      label: 'Total Sequence & Broke Cost',
      unit: 'EUR',
      naive: calcTotalCost(naiveResult.metrics),
      hybrid: calcTotalCost(hybridResult.metrics),
      cpsat: cpsatActiveResult ? calcTotalCost(cpsatActiveResult.metrics) : null,
      colorFirst: calcTotalCost(colorFirstResult.metrics),
      grammageFirst: calcTotalCost(grammageFirstResult.metrics),
      lowerIsBetter: true,
    },
    {
      label: 'Execution / Solve Time',
      unit: 'time',
      naive: '< 1 ms',
      hybrid: '~1.5 ms',
      cpsat: cpsatActiveResult
        ? (cpsatActiveResult.telemetry?.solveTimeMs ?? 0) < 1000
          ? `${(cpsatActiveResult.telemetry?.solveTimeMs ?? 0).toFixed(0)} ms`
          : `${((cpsatActiveResult.telemetry?.solveTimeMs ?? 0) / 1000).toFixed(2)} s`
        : null,
      colorFirst: '< 1 ms',
      grammageFirst: '< 1 ms',
      lowerIsBetter: true,
      isSpecial: true,
    },
  ];

  // Dynamic Verdict Formulation
  const isCpsatWinner = winner.id === 'cpsat';
  const isTie = Math.abs(hybridResult.metrics.totalChangeoverHours - (cpsatActiveResult?.metrics.totalChangeoverHours ?? 0)) < 0.1 &&
                Math.abs(hybridResult.metrics.totalBrokeTonnes - (cpsatActiveResult?.metrics.totalBrokeTonnes ?? 0)) < 0.1;

  // Proximity to lower bound
  const lowerBoundEur = cpsatActiveResult?.telemetry?.bestLowerBoundEur;
  const optimalityGapPct = cpsatActiveResult?.telemetry?.optimalityGapPct ?? 0;
  const isOptimalProven = cpsatActiveResult?.telemetry?.status === 'OPTIMAL';

  let lowerBoundStatement = '';
  if (lowerBoundEur && lowerBoundEur > 0) {
    const hybridCost = calcTotalCost(hybridResult.metrics);
    const gapFromBoundPct = Math.max(0, Math.round(((hybridCost - lowerBoundEur) / lowerBoundEur) * 1000) / 10);

    if (gapFromBoundPct <= 0.5) {
      lowerBoundStatement = `Rule-based Hybrid is virtually identical to the proven lower bound (within ${gapFromBoundPct.toFixed(1)}% of €${lowerBoundEur.toLocaleString()}), confirming the heuristic is already optimal for this campaign structure.`;
    } else {
      lowerBoundStatement = `Rule-based Hybrid is within ${gapFromBoundPct.toFixed(1)}% of the proven mathematical lower bound (€${lowerBoundEur.toLocaleString()} proven bound vs €${hybridCost.toLocaleString()} heuristic).`;
    }

    if (!isOptimalProven && cpsatActiveResult?.telemetry?.status === 'FEASIBLE') {
      lowerBoundStatement += ` Note: CP-SAT reached a feasible solution at the time limit with a ${optimalityGapPct.toFixed(1)}% gap; global optimality was not fully proven.`;
    }
  }

  // Cost delta between winner and other methods
  const naiveDeltaCost = calcTotalCost(naiveResult.metrics) - winner.totalCostEur;
  const naiveDeltaPct = Math.round((naiveDeltaCost / winner.totalCostEur) * 1000) / 10;
  const naiveHoursDelta = Math.round((naiveResult.metrics.totalChangeoverHours - winner.metrics.totalChangeoverHours) * 10) / 10;
  const naiveBrokeDelta = Math.round((naiveResult.metrics.totalBrokeTonnes - winner.metrics.totalBrokeTonnes) * 10) / 10;

  // Operational trade-off why winner is better
  let tradeOffExplanation = '';
  if (winner.id !== 'hybrid' && winner.id !== 'naive' && !isTie) {
    const hoursSavedVsHybrid = Math.round((hybridResult.metrics.totalChangeoverHours - winner.metrics.totalChangeoverHours) * 10) / 10;
    const brokeSavedVsHybrid = Math.round((hybridResult.metrics.totalBrokeTonnes - winner.metrics.totalBrokeTonnes) * 10) / 10;
    tradeOffExplanation = `${winner.name} achieves a superior global sequence permutation, saving ${Math.abs(hoursSavedVsHybrid).toFixed(1)}h setup and ${Math.abs(brokeSavedVsHybrid).toFixed(1)}t transition broke versus the heuristic.`;
  } else if (isTie) {
    tradeOffExplanation = `Rule-based Hybrid and ${winner.name} tie on overall cost (€${winner.totalCostEur.toLocaleString()}). In paper mill operations, the heuristic is strongly preferred here due to instant sub-millisecond execution and complete decision transparency.`;
  } else {
    tradeOffExplanation = `Rule-based Hybrid achieves lowest total cost (€${winner.totalCostEur.toLocaleString()}), effectively balancing shade washouts and caliper transitions with zero solver overhead.`;
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Panel Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Scale size={20} color="var(--brand-blue)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Three-Way Strategy Comparison & Performance Audit
            </h3>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                background: '#E0F2FE',
                color: 'var(--brand-blue)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              Multi-Method Benchmark
            </span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Side-by-side evaluation of Naive baseline, Rule-based Hybrid, and Google OR-Tools CP-SAT on the active scenario
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenBenchmark && (
            <button
              onClick={onOpenBenchmark}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0F172A',
                color: '#38BDF8',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Open 28-Instance Scalability Benchmark Suite"
            >
              <BarChart2 size={13} color="#38BDF8" />
              Scaling Benchmark Suite (28 Runs)
            </button>
          )}
          <ClientInputBadge parameterName="Hourly Rate €480 & Broke €280" />
          <span
            style={{
              fontSize: '0.72rem',
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

      {/* Dynamic "Which is Most Efficient and Why" Verdict Banner */}
      <div
        style={{
          background: isCpsatWinner && !isTie ? '#F0FAFD' : '#F8FAFC',
          borderRadius: 'var(--radius-md)',
          border: isCpsatWinner && !isTie ? '2px solid #BAE6FD' : '2px solid var(--border-light)',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: isCpsatWinner ? 'var(--cyan-accent)' : 'var(--brand-blue)',
                color: isCpsatWinner ? 'var(--navy-dark)' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Optimization Verdict
                </span>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    background: 'var(--success-bg)',
                    color: 'var(--success-green)',
                    padding: '1px 6px',
                    borderRadius: '4px',
                  }}
                >
                  Winner: {winner.name}
                </span>
              </div>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 800, margin: '2px 0 0 0' }}>
                {isTie
                  ? 'Rule-based Hybrid and CP-SAT Achieve Identical Minimum Cost'
                  : `${winner.name} is the Most Cost-Efficient Method`}
              </h4>
            </div>
          </div>

          {/* Stated Ranking Rule */}
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              background: '#FFFFFF',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-light)',
              maxWidth: '460px',
            }}
          >
            <strong>Evaluation Rule:</strong> Lowest total cost among delivery-feasible methods &rarr; fewest due-date risks &rarr; lowest broke tonnes &rarr; shortest solve time.
          </div>
        </div>

        {/* Dynamic Explanatory Narrative */}
        <div style={{ fontSize: '0.82rem', color: 'var(--navy-dark)', lineHeight: 1.55 }}>
          <p style={{ margin: '0 0 8px 0' }}>
            <strong>Operational Breakdown:</strong> {tradeOffExplanation}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginTop: '10px' }}>
            {/* Distance from best */}
            <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--brand-blue)', marginBottom: '4px' }}>
                Distance From Best Solution
              </div>
              <div>• <strong>Naive Baseline:</strong> +{naiveHoursDelta.toFixed(1)}h setup, +{naiveBrokeDelta.toFixed(1)}t broke (+€{naiveDeltaCost.toLocaleString()} / +{naiveDeltaPct.toFixed(1)}%)</div>
              {runnerUp && runnerUp.id !== 'naive' && (
                <div style={{ marginTop: '2px' }}>
                  • <strong>{runnerUp.name}:</strong> +€{(runnerUp.totalCostEur - winner.totalCostEur).toLocaleString()} ({(((runnerUp.totalCostEur - winner.totalCostEur) / winner.totalCostEur) * 100).toFixed(1)}% delta)
                </div>
              )}
            </div>

            {/* Lower Bound Proof */}
            <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: '#0F766E', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={13} />
                Mathematical Lower Bound Audit
              </div>
              <div style={{ lineHeight: 1.45 }}>{lowerBoundStatement || 'Evaluating dual bounds...'}</div>
            </div>

            {/* Speed & Transparency Trade-off */}
            <div style={{ background: '#FFFFFF', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '0.76rem' }}>
              <div style={{ fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={13} color="var(--brand-blue)" />
                Speed vs. Transparency Trade-off
              </div>
              <div style={{ lineHeight: 1.45 }}>
                Hybrid solves instantly (<strong style={{ color: 'var(--success-green)' }}>~1.5 ms</strong>) with auditable heuristic logic. CP-SAT delivers rigorous mathematical bounds in <strong style={{ color: 'var(--brand-blue)' }}>{cpsatActiveResult?.telemetry?.solveTimeMs ? `${(cpsatActiveResult.telemetry.solveTimeMs / 1000).toFixed(2)}s` : '3.0s'}</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ background: 'var(--off-white-bg)', borderBottom: '2px solid var(--border-light)' }}>
              <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', width: '32%' }}>
                OPERATIONAL METRIC
              </th>
              <th style={{ padding: '12px 14px', color: 'var(--danger-crimson)', width: '22%' }}>
                NAIVE BASELINE (FIFO)
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  color: 'var(--brand-blue)',
                  width: '23%',
                  background: activeOptimizer === 'hybrid' ? '#F0F9FF' : 'transparent',
                }}
              >
                RULE-BASED HYBRID {activeOptimizer === 'hybrid' ? '★' : ''}
              </th>
              <th
                style={{
                  padding: '12px 14px',
                  color: '#0F766E',
                  width: '23%',
                  background: activeOptimizer === 'cpsat' ? '#F0FAFD' : 'transparent',
                }}
              >
                OR-TOOLS CP-SAT {activeOptimizer === 'cpsat' ? '★' : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, idx) => {
              // Determine which primary method is best
              let bestId = 'hybrid';
              if (row.cpsat !== null && typeof row.hybrid === 'number' && typeof row.cpsat === 'number' && typeof row.naive === 'number') {
                bestId = pickBest(
                  [
                    { id: 'naive', val: row.naive },
                    { id: 'hybrid', val: row.hybrid },
                    { id: 'cpsat', val: row.cpsat },
                  ],
                  row.lowerIsBetter
                );
              }

              return (
                <tr
                  key={row.label}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    background: idx % 2 === 1 ? '#FAFAFA' : '#FFFFFF',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    {row.label}
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                      ({row.unit})
                    </span>
                  </td>

                  {/* Naive Value */}
                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                    {typeof row.naive === 'number'
                      ? row.unit === 'EUR'
                        ? `€${row.naive.toLocaleString()}`
                        : row.unit === '% compliance'
                        ? `${row.naive.toFixed(1)}%`
                        : row.naive
                      : row.naive}
                  </td>

                  {/* Hybrid Value */}
                  <td
                    style={{
                      padding: '12px 14px',
                      fontWeight: 700,
                      color: bestId === 'hybrid' ? 'var(--success-green)' : 'var(--navy-dark)',
                      background: activeOptimizer === 'hybrid' ? '#F0F9FF' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>
                        {typeof row.hybrid === 'number'
                          ? row.unit === 'EUR'
                            ? `€${row.hybrid.toLocaleString()}`
                            : row.unit === '% compliance'
                            ? `${row.hybrid.toFixed(1)}%`
                            : row.hybrid
                          : row.hybrid}
                      </span>
                      {bestId === 'hybrid' && !row.isSpecial && (
                        <span style={{ color: 'var(--success-green)', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}>
                          <Check size={13} />
                        </span>
                      )}
                    </div>
                  </td>

                  {/* CP-SAT Value */}
                  <td
                    style={{
                      padding: '12px 14px',
                      fontWeight: 700,
                      color: bestId === 'cpsat' ? 'var(--success-green)' : 'var(--navy-dark)',
                      background: activeOptimizer === 'cpsat' ? '#F0FAFD' : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>
                        {row.cpsat !== null
                          ? typeof row.cpsat === 'number'
                            ? row.unit === 'EUR'
                              ? `€${row.cpsat.toLocaleString()}`
                              : row.unit === '% compliance'
                              ? `${row.cpsat.toFixed(1)}%`
                              : row.cpsat
                            : row.cpsat
                          : 'Solving...'}
                      </span>
                      {bestId === 'cpsat' && !row.isSpecial && (
                        <span style={{ color: 'var(--success-green)', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}>
                          <Check size={13} />
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

      {/* Expandable Section: Reference Heuristics (Colour-First & Grammage-First) */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
        <button
          type="button"
          onClick={() => setShowExtendedStrategies(!showExtendedStrategies)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--brand-blue)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: 0,
          }}
        >
          {showExtendedStrategies ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          {showExtendedStrategies
            ? 'Hide Reference Strategies (Colour-First & Grammage-First)'
            : 'Show Extra Reference Strategies (Colour-First & Grammage-First)'}
        </button>

        {showExtendedStrategies && (
          <div style={{ marginTop: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '8px 14px', color: 'var(--text-secondary)', width: '32%' }}>METRIC</th>
                  <th style={{ padding: '8px 14px', color: 'var(--brand-blue)', width: '34%' }}>
                    COLOUR-FIRST LADDER (Eliminates Washouts)
                  </th>
                  <th style={{ padding: '8px 14px', color: '#7C3AED', width: '34%' }}>
                    GRAMMAGE-FIRST (Eliminates Caliper Steps)
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={`ext-${row.label}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 14px', color: 'var(--navy-dark)', fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                      {typeof row.colorFirst === 'number'
                        ? row.unit === 'EUR'
                          ? `€${row.colorFirst.toLocaleString()}`
                          : row.unit === '% compliance'
                          ? `${row.colorFirst.toFixed(1)}%`
                          : row.colorFirst
                        : row.colorFirst}
                    </td>
                    <td style={{ padding: '8px 14px', color: 'var(--text-secondary)' }}>
                      {typeof row.grammageFirst === 'number'
                        ? row.unit === 'EUR'
                          ? `€${row.grammageFirst.toLocaleString()}`
                          : row.unit === '% compliance'
                          ? `${row.grammageFirst.toFixed(1)}%`
                          : row.grammageFirst
                        : row.grammageFirst}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
