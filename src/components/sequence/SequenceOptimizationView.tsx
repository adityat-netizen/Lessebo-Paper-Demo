import React, { useState, useMemo } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { ShadeSwatch } from '../common/ShadeSwatch';
import { ClientInputBadge } from '../common/ClientInputBadge';
import {
  Sparkles,
  AlertTriangle,
  Clock,
  Trash2,
  TrendingUp,
  Eye,
  Grid,
  Droplets,
  Layers,
  Sliders,
} from 'lucide-react';
import { CsvExportButton, type CsvExportOption } from '../common/CsvExportButton';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvExport';
import type { ScheduledRun, ScheduleMetrics, StrategyResult } from '../../types';

export const SequenceOptimizationView: React.FC = () => {
  const {
    optimizationResult,
    selectedRunId,
    setSelectedRunId,
    selectedMachine,
    lossModelConfig,
    sequenceScenarioPreset,
    setSequenceScenarioPreset,
    grammageDownPenaltyHours,
    setGrammageDownPenaltyHours,
  } = usePlanning();

  type ViewModeOption = 'sideBySide' | 'hybrid' | 'color_first' | 'grammage_first' | 'naive';
  const [viewMode, setViewMode] = useState<ViewModeOption>('sideBySide');
  const [showTransitionMatrix, setShowTransitionMatrix] = useState<boolean>(false);

  const { naive, optimized, savings } = optimizationResult;
  const strategies = optimizationResult.strategies;
  const naiveResult: StrategyResult = strategies?.naive ?? {
    id: 'naive',
    name: 'Naive Baseline',
    description: 'Order book arrival',
    runs: naive.runs,
    metrics: naive.metrics,
  };
  const colorFirstResult: StrategyResult = strategies?.colorFirst ?? {
    id: 'color_first',
    name: 'Colour-First Ladder',
    description: 'Format then shade ladder',
    runs: optimized.runs,
    metrics: optimized.metrics,
  };
  const grammageFirstResult: StrategyResult = strategies?.grammageFirst ?? {
    id: 'grammage_first',
    name: 'Grammage-First Banding',
    description: 'Ascending grammage bands then shade ladder',
    runs: optimized.runs,
    metrics: optimized.metrics,
  };
  const hybridResult: StrategyResult = strategies?.hybrid ?? {
    id: 'hybrid',
    name: 'Hybrid / Cost-Minimizing',
    description: 'Grammage banding with local 2-opt search',
    runs: optimized.runs,
    metrics: optimized.metrics,
    isRecommended: true,
  };
  const recommendedResult = optimized;

  // Active strategy runs depending on viewMode
  const currentDisplayedRuns: ScheduledRun[] = useMemo(() => {
    if (viewMode === 'color_first') return colorFirstResult.runs;
    if (viewMode === 'grammage_first') return grammageFirstResult.runs;
    if (viewMode === 'naive') return naiveResult.runs;
    if (viewMode === 'hybrid') return hybridResult.runs;
    return recommendedResult.runs;
  }, [viewMode, colorFirstResult, grammageFirstResult, naiveResult, hybridResult, recommendedResult]);

  // Selected run for explainability inspection (defaults to first run with significant savings or selected by user)
  const activeSelectedRun: ScheduledRun =
    (selectedRunId
      ? currentDisplayedRuns.find((r) => r.order_id === selectedRunId) ||
        recommendedResult.runs.find((r) => r.order_id === selectedRunId) ||
        naiveResult.runs.find((r) => r.order_id === selectedRunId)
      : null) ??
    currentDisplayedRuns[3] ??
    currentDisplayedRuns[0] ??
    recommendedResult.runs[0];

  const shadeNames = [
    'Bright White',
    'Natural White',
    'Warm Ivory',
    'Chamois / Vanilla',
    'Canary Yellow',
    'Sky Blue',
    'Forest Green',
    'Deep Charcoal',
  ];

  const exportSequenceOptions: CsvExportOption[] = [
    {
      label: `Optimized Production Sequence (${selectedMachine})`,
      description: 'Ordered runs with light-to-dark color sequence, transition hours, broke & SLA',
      onExport: () => {
        const runData = optimized.runs.map((r) => ({
          run_sequence: r.runSequence,
          order_id: r.order_id,
          customer_name: r.customer_name,
          customer_priority: r.customer_priority,
          sku_id: r.sku_id,
          brand_line: r.brand_line,
          shade_name: r.shade_name,
          shade_group: r.shade_group,
          grammage_gsm: r.grammage_gsm,
          format_type: r.format_type,
          sheet_dimensions: r.sheet_dimensions ?? 'N/A',
          quantity_tonnes: r.quantity_tonnes,
          production_hours: r.production_hours,
          start_hour: r.startHour,
          end_hour: r.endHour,
          changeover_hours: r.changeoverHours,
          base_setup_hours: r.changeoverBreakdown.baseSetup,
          washout_hours: r.changeoverBreakdown.washoutHours,
          grammage_hours: r.changeoverBreakdown.grammageHours,
          format_hours: r.changeoverBreakdown.formatHours,
          is_washout: r.isWashout ? 'YES' : 'NO',
          color_broke_tonnes: r.changeoverBreakdown.colorBrokeTonnes ?? 0,
          grammage_broke_tonnes: r.changeoverBreakdown.grammageBrokeTonnes ?? 0,
          format_broke_tonnes: r.changeoverBreakdown.formatBrokeTonnes ?? 0,
          startup_broke_tonnes: r.changeoverBreakdown.startupBrokeTonnes ?? 0,
          washout_water_m3: r.changeoverBreakdown.washoutWaterM3 ?? 0,
          broke_tonnes: r.brokeTonnes,
          due_in_days: r.due_in_days,
          meets_sla: r.meetsSla ? 'YES' : 'NO (At Risk)',
          changeover_reason: r.changeoverBreakdown.reason,
        }));

        const csv = buildCsvContent(
          {
            datasetName: `Optimized Production Run Sequence (${selectedMachine})`,
            scenarioName: 'Optimized Light-to-Dark Heuristic',
            assumptions: {
              Machine: selectedMachine,
              BrokeRate: '2.4 t/h (Client input required)',
              HourlyOperatingCost: '€480/h (Client input required)',
            },
          },
          [
            { key: 'run_sequence', label: 'Sequence Position' },
            { key: 'order_id', label: 'Order ID' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'customer_priority', label: 'Priority SLA' },
            { key: 'sku_id', label: 'SKU' },
            { key: 'brand_line', label: 'Brand Line' },
            { key: 'shade_name', label: 'Shade Name' },
            { key: 'shade_group', label: 'Shade Tier' },
            { key: 'grammage_gsm', label: 'Grammage', unit: 'gsm' },
            { key: 'format_type', label: 'Format' },
            { key: 'quantity_tonnes', label: 'Run Quantity', unit: 'tonnes' },
            { key: 'production_hours', label: 'Run Duration', unit: 'hours' },
            { key: 'start_hour', label: 'Start Hour', unit: 'hours' },
            { key: 'end_hour', label: 'End Hour', unit: 'hours' },
            { key: 'changeover_hours', label: 'Total Changeover', unit: 'hours' },
            { key: 'base_setup_hours', label: 'Base Setup', unit: 'hours' },
            { key: 'washout_hours', label: 'Color Washout', unit: 'hours' },
            { key: 'grammage_hours', label: 'Grammage Step', unit: 'hours' },
            { key: 'format_hours', label: 'Format Switch', unit: 'hours' },
            { key: 'is_washout', label: 'Deep Washout Required' },
            { key: 'color_broke_tonnes', label: 'Color Transition Broke', unit: 'tonnes' },
            { key: 'grammage_broke_tonnes', label: 'Grammage Delta Broke', unit: 'tonnes' },
            { key: 'format_broke_tonnes', label: 'Format Switch Broke', unit: 'tonnes' },
            { key: 'startup_broke_tonnes', label: 'Start-up Calibration Broke', unit: 'tonnes' },
            { key: 'washout_water_m3', label: 'Washout Effluent Water', unit: 'm3' },
            { key: 'broke_tonnes', label: 'Total Transition Broke', unit: 'tonnes' },
            { key: 'due_in_days', label: 'Customer Due Deadline', unit: 'days' },
            { key: 'meets_sla', label: 'SLA Delivery Compliance' },
            { key: 'changeover_reason', label: 'Engineering Changeover Reason' },
          ],
          runData
        );

        downloadCsvFile(`optimized_sequence_${selectedMachine.toLowerCase()}`, 'optimized', csv);
      },
    },
    {
      label: `Naive Production Sequence (${selectedMachine})`,
      description: 'Unoptimized order-arrival sequence exhibiting high washouts and broke',
      onExport: () => {
        const runData = naive.runs.map((r) => ({
          run_sequence: r.runSequence,
          order_id: r.order_id,
          customer_name: r.customer_name,
          customer_priority: r.customer_priority,
          sku_id: r.sku_id,
          brand_line: r.brand_line,
          shade_name: r.shade_name,
          shade_group: r.shade_group,
          grammage_gsm: r.grammage_gsm,
          format_type: r.format_type,
          quantity_tonnes: r.quantity_tonnes,
          production_hours: r.production_hours,
          start_hour: r.startHour,
          end_hour: r.endHour,
          changeover_hours: r.changeoverHours,
          is_washout: r.isWashout ? 'YES' : 'NO',
          color_broke_tonnes: r.changeoverBreakdown.colorBrokeTonnes ?? 0,
          grammage_broke_tonnes: r.changeoverBreakdown.grammageBrokeTonnes ?? 0,
          format_broke_tonnes: r.changeoverBreakdown.formatBrokeTonnes ?? 0,
          startup_broke_tonnes: r.changeoverBreakdown.startupBrokeTonnes ?? 0,
          washout_water_m3: r.changeoverBreakdown.washoutWaterM3 ?? 0,
          broke_tonnes: r.brokeTonnes,
          due_in_days: r.due_in_days,
          meets_sla: r.meetsSla ? 'YES' : 'NO (At Risk)',
          changeover_reason: r.changeoverBreakdown.reason,
        }));

        const csv = buildCsvContent(
          {
            datasetName: `Naive FIFO Production Run Sequence (${selectedMachine})`,
            scenarioName: 'Naive FIFO Baseline',
            assumptions: {
              Machine: selectedMachine,
              BrokeRate: '2.4 t/h (Client input required)',
            },
          },
          [
            { key: 'run_sequence', label: 'Sequence Position' },
            { key: 'order_id', label: 'Order ID' },
            { key: 'customer_name', label: 'Customer' },
            { key: 'sku_id', label: 'SKU' },
            { key: 'shade_name', label: 'Shade Name' },
            { key: 'grammage_gsm', label: 'Grammage', unit: 'gsm' },
            { key: 'quantity_tonnes', label: 'Run Quantity', unit: 'tonnes' },
            { key: 'start_hour', label: 'Start Hour', unit: 'hours' },
            { key: 'end_hour', label: 'End Hour', unit: 'hours' },
            { key: 'changeover_hours', label: 'Total Changeover', unit: 'hours' },
            { key: 'is_washout', label: 'Deep Washout Required' },
            { key: 'color_broke_tonnes', label: 'Color Transition Broke', unit: 'tonnes' },
            { key: 'grammage_broke_tonnes', label: 'Grammage Delta Broke', unit: 'tonnes' },
            { key: 'format_broke_tonnes', label: 'Format Switch Broke', unit: 'tonnes' },
            { key: 'startup_broke_tonnes', label: 'Start-up Calibration Broke', unit: 'tonnes' },
            { key: 'washout_water_m3', label: 'Washout Effluent Water', unit: 'm3' },
            { key: 'broke_tonnes', label: 'Transition Broke Scrap', unit: 'tonnes' },
            { key: 'due_in_days', label: 'Customer Due Deadline', unit: 'days' },
            { key: 'meets_sla', label: 'SLA Delivery Compliance' },
            { key: 'changeover_reason', label: 'Engineering Changeover Reason' },
          ],
          runData
        );

        downloadCsvFile(`naive_sequence_${selectedMachine.toLowerCase()}`, 'naive', csv);
      },
    },
    {
      label: 'Sequence Comparison Summary',
      description: 'Side-by-side KPI comparison of changeover hours, broke fiber, and capacity gains',
      onExport: () => {
        const summaryData = [
          {
            metric: 'Total Sequence Changeover Hours',
            naive_value: naive.metrics.totalChangeoverHours,
            optimized_value: optimized.metrics.totalChangeoverHours,
            delta_savings: savings.changeoverHoursSaved,
            unit: 'hours',
            improvement_pct: Math.round((savings.changeoverHoursSaved / (naive.metrics.totalChangeoverHours || 1)) * 1000) / 10,
          },
          {
            metric: 'Total Transition Broke Scrap',
            naive_value: naive.metrics.totalBrokeTonnes,
            optimized_value: optimized.metrics.totalBrokeTonnes,
            delta_savings: savings.brokeTonnesSaved,
            unit: 'tonnes',
            improvement_pct: Math.round((savings.brokeTonnesSaved / (naive.metrics.totalBrokeTonnes || 1)) * 1000) / 10,
          },
          {
            metric: 'Deep Washout Chest Cleanings',
            naive_value: naive.metrics.washoutCount,
            optimized_value: optimized.metrics.washoutCount,
            delta_savings: savings.washoutsAvoided,
            unit: 'events',
            improvement_pct: Math.round((savings.washoutsAvoided / (naive.metrics.washoutCount || 1)) * 1000) / 10,
          },
          {
            metric: 'Net Schedule Campaign Span',
            naive_value: naive.metrics.totalSpanHours,
            optimized_value: optimized.metrics.totalSpanHours,
            delta_savings: savings.capacityReleasedHours,
            unit: 'hours',
            improvement_pct: Math.round((savings.capacityReleasedHours / (naive.metrics.totalSpanHours || 1)) * 1000) / 10,
          },
          {
            metric: 'Estimated Operational Financial Cost',
            naive_value: naive.metrics.totalOperatingCostEur + naive.metrics.totalBrokeCostEur,
            optimized_value: optimized.metrics.totalOperatingCostEur + optimized.metrics.totalBrokeCostEur,
            delta_savings: savings.financialSavingsEur,
            unit: 'EUR',
            improvement_pct: Math.round((savings.financialSavingsEur / ((naive.metrics.totalOperatingCostEur + naive.metrics.totalBrokeCostEur) || 1)) * 1000) / 10,
          },
          {
            metric: 'Customer SLA On-Time Delivery Compliance',
            naive_value: naive.metrics.slaCompliancePct,
            optimized_value: optimized.metrics.slaCompliancePct,
            delta_savings: Math.round((optimized.metrics.slaCompliancePct - naive.metrics.slaCompliancePct) * 10) / 10,
            unit: '%',
            improvement_pct: Math.round((optimized.metrics.slaCompliancePct - naive.metrics.slaCompliancePct) * 10) / 10,
          },
          {
            metric: 'Washout Cleaning Effluent Water',
            naive_value: naive.metrics.totalWashoutWaterM3 ?? 0,
            optimized_value: optimized.metrics.totalWashoutWaterM3 ?? 0,
            delta_savings: savings.waterSavedM3 ?? 0,
            unit: 'm3',
            improvement_pct: Math.round(((savings.waterSavedM3 ?? 0) / ((naive.metrics.totalWashoutWaterM3 ?? 0) || 1)) * 1000) / 10,
          },
          {
            metric: 'Broke Furnish Recycling Ratio',
            naive_value: naive.metrics.brokeFurnishPct ?? 0,
            optimized_value: optimized.metrics.brokeFurnishPct ?? 0,
            delta_savings: Math.round(((naive.metrics.brokeFurnishPct ?? 0) - (optimized.metrics.brokeFurnishPct ?? 0)) * 10) / 10,
            unit: '%',
            improvement_pct: Math.round(((naive.metrics.brokeFurnishPct ?? 0) - (optimized.metrics.brokeFurnishPct ?? 0)) * 10) / 10,
          },
        ];

        const csv = buildCsvContent(
          {
            datasetName: `Production Sequence Comparison Summary (${selectedMachine})`,
            scenarioName: 'Naive vs Optimized',
          },
          [
            { key: 'metric', label: 'Operational KPI' },
            { key: 'naive_value', label: 'Naive FIFO Baseline' },
            { key: 'optimized_value', label: 'Sequence Optimized' },
            { key: 'delta_savings', label: 'Net Savings / Delta' },
            { key: 'unit', label: 'Unit' },
            { key: 'improvement_pct', label: 'Improvement Percentage', unit: '%' },
          ],
          summaryData
        );

        downloadCsvFile(`sequence_comparison_${selectedMachine.toLowerCase()}`, 'summary', csv);
      },
    },
  ];

  const renderTimeline = (
    runs: ScheduledRun[],
    metrics: ScheduleMetrics,
    badgeText: string,
    badgeBg: string,
    badgeColor: string,
    badgeBorder: string,
    subtitle: string,
    isRecommended: boolean = false
  ) => {
    // Dynamic headline calculation
    const washoutHeadline =
      metrics.washoutCount === 0
        ? 'Zero Intermediate Washouts'
        : `${metrics.washoutCount} Intermediate Washout${metrics.washoutCount > 1 ? 's' : ''}`;
    const reversalCount = metrics.grammageReversalsCount ?? 0;
    const reversalHeadline = reversalCount > 0 ? `${reversalCount} GSM Reversal${reversalCount > 1 ? 's' : ''}` : null;
    const setupHeadline = `${metrics.totalChangeoverHours}h Setup Downtime`;

    return (
      <div key={badgeText}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: badgeBg,
                color: badgeColor,
                border: `1px solid ${badgeBorder}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {badgeText}
            </span>
            {isRecommended && (
              <span
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success-green)',
                  border: '1px solid #BBF7D0',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                }}
              >
                RECOMMENDED
              </span>
            )}
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
              {subtitle}
            </span>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              color: metrics.washoutCount > 0 ? 'var(--danger-crimson)' : 'var(--success-green)',
              fontWeight: 700,
            }}
          >
            {washoutHeadline} • {reversalHeadline ? `${reversalHeadline} • ` : ''}{setupHeadline}
          </span>
        </div>

        {/* Visual blocks */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            background: isRecommended
              ? 'linear-gradient(90deg, #F0FAFD 0%, #FFFFFF 100%)'
              : 'var(--off-white-bg)',
            padding: '8px',
            borderRadius: '8px',
            border: isRecommended ? '1px solid #BCEBF5' : '1px solid var(--border-light)',
            overflowX: 'auto',
          }}
        >
          {runs.map((run) => {
            const isSelected = activeSelectedRun?.order_id === run.order_id;
            const isLight =
              run.shade_hex.toUpperCase() === '#FFFFFF' ||
              run.shade_hex.toUpperCase() === '#F6F4ED' ||
              run.shade_hex.toUpperCase() === '#EFE7D3';

            return (
              <div
                key={run.order_id}
                onClick={() => setSelectedRunId(run.order_id)}
                style={{
                  minWidth: '68px',
                  height: '76px',
                  borderRadius: '6px',
                  backgroundColor: run.shade_hex,
                  border: isSelected
                    ? '3px solid var(--brand-blue)'
                    : isLight
                    ? '1px solid #CBD5E1'
                    : '1px solid rgba(0,0,0,0.2)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  position: 'relative',
                  boxShadow: isSelected ? '0 0 12px rgba(0,82,152,0.4)' : 'none',
                  flexShrink: 0,
                }}
              >
                {/* Grammage Reversal Badge on Top-Left */}
                {run.changeoverBreakdown?.isGrammageReversal && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      left: '-6px',
                      background: 'var(--warning-amber)',
                      color: '#FFFFFF',
                      borderRadius: '3px',
                      padding: '1px 3px',
                      fontSize: '0.58rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                      zIndex: 2,
                    }}
                    title={`Grammage Step-Down Reversal: ${run.changeoverBreakdown.grammageDeltaGsm ?? ''}g GSM (${run.changeoverBreakdown.grammageDownHours ?? 0}h setup penalty)`}
                  >
                    ▼ GSM
                  </div>
                )}

                {/* Washout badge on Top-Right */}
                {run.isWashout && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: 'var(--danger-crimson)',
                      color: '#FFFFFF',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      zIndex: 2,
                    }}
                    title="Costly 3.5h washout triggered"
                  >
                    !
                  </div>
                )}
                <div
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    color: isLight ? 'var(--navy-dark)' : '#FFFFFF',
                    lineHeight: 1.1,
                  }}
                >
                  #{run.runSequence}
                </div>
                <div
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 600,
                    color: isLight ? 'var(--text-secondary)' : '#E2E8F0',
                    lineHeight: 1.1,
                  }}
                >
                  {run.grammage_gsm}g
                </div>
                <div
                  style={{
                    fontSize: '0.58rem',
                    color: isLight ? 'var(--text-muted)' : '#CBD5E1',
                  }}
                >
                  +{run.changeoverHours}h
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Banner with Executive Callout */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1A1A2E 0%, #005298 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 32px',
          color: '#FFFFFF',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ maxWidth: '850px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: 'var(--cyan-accent)',
                color: 'var(--navy-dark)',
                padding: '2px 8px',
                borderRadius: '4px',
              }}
            >
              HERO SCREEN
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
              Decision Support • Production Sequencing Engine ({selectedMachine})
            </span>
          </div>
          <h2 style={{ fontSize: '1.65rem', color: '#FFFFFF', fontWeight: 800, margin: '4px 0 8px 0' }}>
            Naive Sequence vs. Intelligent Optimized Sequence
          </h2>
          <p style={{ fontSize: '0.86rem', color: '#E2E8F0', lineHeight: 1.5, margin: 0 }}>
            Compare an un-sequenced order-arrival schedule against our deterministic light-to-dark colour ladder. Washouts, grammage adjustments, and format setups are calculated live by the engine.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CsvExportButton label="Export CSV" options={exportSequenceOptions} />
          <button
            onClick={() => setShowTransitionMatrix(!showTransitionMatrix)}
            style={{
              background: showTransitionMatrix ? 'var(--cyan-accent)' : 'rgba(255,255,255,0.12)',
              color: showTransitionMatrix ? 'var(--navy-dark)' : '#FFFFFF',
              border: '1px solid rgba(255,255,255,0.25)',
              padding: '10px 16px',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Grid size={15} />
            {showTransitionMatrix ? 'Hide Transition Matrix' : 'View Transition Matrix'}
          </button>
        </div>
      </div>

      {/* Scenario Preset & Grammage Penalty Controls Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="var(--brand-blue)" />
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                Campaign Scenario & Directional Penalty Calibration
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                Simulate standard order books versus structural trade-offs between colour ladder and grammage steps
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            background: 'var(--off-white-bg)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
          }}
        >
          {/* Preset Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                Active Campaign Scenario:
              </label>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: sequenceScenarioPreset === 'conflict' ? '#FEF3C7' : '#E0F2FE',
                  color: sequenceScenarioPreset === 'conflict' ? '#92400E' : 'var(--brand-blue)',
                }}
              >
                {sequenceScenarioPreset === 'conflict' ? 'Conflict Mode (48 runs)' : 'Standard Plan (20 runs)'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSequenceScenarioPreset('standard')}
                style={{
                  flex: 1,
                  minWidth: '150px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: sequenceScenarioPreset === 'standard' ? '2px solid var(--brand-blue)' : '1px solid var(--border-light)',
                  background: sequenceScenarioPreset === 'standard' ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                  color: sequenceScenarioPreset === 'standard' ? 'var(--brand-blue)' : 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  textAlign: 'left',
                  boxShadow: sequenceScenarioPreset === 'standard' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700 }}>Standard Campaign</span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Current unconstrained order book arrival (20 runs)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSequenceScenarioPreset('conflict')}
                style={{
                  flex: 1,
                  minWidth: '180px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: sequenceScenarioPreset === 'conflict' ? '2px solid var(--brand-blue)' : '1px solid var(--border-light)',
                  background: sequenceScenarioPreset === 'conflict' ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
                  color: sequenceScenarioPreset === 'conflict' ? 'var(--brand-blue)' : 'var(--text-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  textAlign: 'left',
                  boxShadow: sequenceScenarioPreset === 'conflict' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: 700 }}>Heavy-grammage Light Shades</span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      background: 'var(--warning-amber)',
                      color: '#FFFFFF',
                      padding: '1px 5px',
                      borderRadius: '3px',
                    }}
                  >
                    CONFLICT
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  High-GSM lights vs. low-GSM darks (48 runs, synthetic)
                </span>
              </button>
            </div>
          </div>

          {/* Grammage Step-Down Penalty Slider */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                  Extra Step-Down Penalty:
                </label>
                <ClientInputBadge parameterName="Grammage Step-Down Penalty" />
              </div>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: grammageDownPenaltyHours > 0 ? 'var(--warning-amber)' : 'var(--text-muted)',
                  background: '#FFFFFF',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                }}
              >
                +{grammageDownPenaltyHours.toFixed(1)} h / reversal
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="0.0"
                max="2.0"
                step="0.1"
                value={grammageDownPenaltyHours}
                onChange={(e) => setGrammageDownPenaltyHours(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: 'var(--brand-blue)',
                  cursor: 'pointer',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                0.0h (Symmetric baseline)
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0.0, 0.6, 1.2].map((presetVal) => (
                  <button
                    key={presetVal}
                    type="button"
                    onClick={() => setGrammageDownPenaltyHours(presetVal)}
                    style={{
                      fontSize: '0.66rem',
                      padding: '2px 6px',
                      borderRadius: '3px',
                      background: Math.abs(grammageDownPenaltyHours - presetVal) < 0.05 ? 'var(--brand-blue)' : '#FFFFFF',
                      color: Math.abs(grammageDownPenaltyHours - presetVal) < 0.05 ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    {presetVal === 0 ? '0.0h (Zero)' : `${presetVal.toFixed(1)}h`}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                2.0h (Severe penalty)
              </span>
            </div>

            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: 1.4 }}>
              Additional mechanical slice & tension calibration when moving from heavy to light paper (e.g. 150g &rarr; 80g).
            </p>
          </div>
        </div>
      </div>

      {/* Broke Furnish Recycling Ceiling Warning Banner (Component 11) */}
      {lossModelConfig.enableBrokeRecycling &&
        (optimized.metrics.brokeRecycleExceeded ||
          (optimized.metrics.brokeFurnishPct ?? 0) > (lossModelConfig.maxFurnishRecycleCeilingPct ?? 15)) && (
          <div
            style={{
              background: '#FFFBEB',
              border: '2px solid var(--warning-amber)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
            }}
          >
            <AlertTriangle size={22} color="var(--warning-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.92rem', color: '#92400E' }}>
                  Furnish Broke Recycling Ceiling Warning (Component 11)
                </strong>
                <ClientInputBadge parameterName="Furnish Broke Ceiling" />
              </div>
              <p style={{ fontSize: '0.82rem', color: '#B45309', margin: 0, lineHeight: 1.5 }}>
                Campaign broke generation represents <strong>{(optimized.metrics.brokeFurnishPct ?? 0).toFixed(1)}%</strong> of total furnish, exceeding the maximum safe repulping ceiling of <strong>{lossModelConfig.maxFurnishRecycleCeilingPct ?? 15}%</strong>. In order to avoid sheet strength and formation degradation, excess broke fiber must either be stored for future blends or downcycled, incurring additional broke recovery costs.
              </p>
            </div>
          </div>
        )}

      {/* Comparison Scorecard Table (Prompt Specified Mechanism) */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Live Calculated Performance Comparison
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Values calculated dynamically for the active {selectedMachine} campaign ({naive.runs.length} runs)
            </p>
          </div>
          <ClientInputBadge parameterName="Broke Rate & Machine Operating Cost" />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ textAlign: 'left', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'var(--off-white-bg)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', width: '35%' }}>
                  OPERATIONAL METRIC
                </th>
                <th style={{ padding: '12px 16px', color: 'var(--danger-crimson)', width: '22%' }}>
                  NAIVE SEQUENCE (Order Book Arrival)
                </th>
                <th style={{ padding: '12px 16px', color: 'var(--brand-blue)', width: '22%' }}>
                  OPTIMIZED SEQUENCE (Colour Ladder)
                </th>
                <th style={{ padding: '12px 16px', color: 'var(--success-green)', width: '21%' }}>
                  CAPACITY & SAVINGS DELTA
                </th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} color="var(--brand-blue)" />
                    <span>Changeover Hours</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Mechanical setup + washouts + grammage steps
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--danger-crimson)' }}>
                  {naive.metrics.totalChangeoverHours} h
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-blue)' }}>
                  {optimized.metrics.totalChangeoverHours} h
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  -{savings.changeoverHoursSaved} h freed
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trash2 size={16} color="var(--warning-amber)" />
                    <span>Estimated Broke / Scrap Fiber</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Calculated at 2.4 tonnes / changeover hour
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--danger-crimson)' }}>
                  {naive.metrics.totalBrokeTonnes} t
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-blue)' }}>
                  {optimized.metrics.totalBrokeTonnes} t
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  -{savings.brokeTonnesSaved} t reduced
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} color="var(--warning-amber)" />
                    <span>Deep Pulper Washout Events</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Costly 3.5h dark-to-light chemical washes
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--danger-crimson)' }}>
                  {naive.metrics.washoutCount} washouts
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-blue)' }}>
                  {optimized.metrics.washoutCount} washout (end of cycle)
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  {savings.washoutsAvoided} washouts eliminated
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Droplets size={16} color="var(--cyan-accent)" />
                    <span>Washout Effluent Water Loss</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    High-pressure chest wash volume (6 m³/washout)
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--danger-crimson)' }}>
                  {naive.metrics.totalWashoutWaterM3 ?? 0} m³
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-blue)' }}>
                  {optimized.metrics.totalWashoutWaterM3 ?? 0} m³
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  -{savings.waterSavedM3 ?? 0} m³ effluent avoided
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={16} color="var(--brand-blue)" />
                    <span>Broke Furnish Recycling Ratio</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Broke as % of gross furnish (Max ceiling: {lossModelConfig.maxFurnishRecycleCeilingPct ?? 15}%)
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--danger-crimson)' }}>
                  {(naive.metrics.brokeFurnishPct ?? 0).toFixed(1)}%
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--brand-blue)' }}>
                  {(optimized.metrics.brokeFurnishPct ?? 0).toFixed(1)}%
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  {((naive.metrics.brokeFurnishPct ?? 0) - (optimized.metrics.brokeFurnishPct ?? 0)).toFixed(1)}% lower fiber stress
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#F8FCFD' }}>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} color="var(--cyan-accent)" />
                    <span>Machine Capacity Released</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--brand-blue)' }}>
                    Additional saleable mill production window
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>—</td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--cyan-accent)' }}>
                  +{savings.capacityReleasedHours} h
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--cyan-accent)' }}>
                  +{(savings.capacityReleasedHours * 5.8).toFixed(1)} t potential output
                </td>
              </tr>

              <tr>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={16} color="var(--success-green)" />
                    <span>Net Financial Value Created</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Machine rate €480/h + Broke recovery €280/t
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>—</td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  €{savings.financialSavingsEur.toLocaleString()}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--success-green)' }}>
                  ~€{(savings.financialSavingsEur * 26).toLocaleString()} / year
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sequence vs Non-Sequence Loss Architecture Card */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Loss Classification Architecture: Sequence-Dependent vs. Non-Sequence Yield Losses
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Understanding what production scheduling can optimize versus baseline manufacturing process losses
            </p>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Illustrative / Synthetic - Not actual Lessebo results
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Card 1: Sequence-Dependent Losses */}
          <div
            style={{
              background: '#F0F9FF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #BAE6FD',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Sparkles size={18} color="var(--brand-blue)" />
              <strong style={{ fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                Sequence-Dependent Losses (Optimizable)
              </strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              Directly driven by run order and transition physics. Solved deterministically by the Light-to-Dark ladder.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px' }}>
                <span>• Shade Washout Broke & Off-Spec Transitions:</span>
                <strong style={{ color: 'var(--brand-blue)' }}>{savings.brokeTonnesSaved.toFixed(1)} t saved</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px' }}>
                <span>• Washout Chest Effluent Cleaning Water:</span>
                <strong style={{ color: 'var(--brand-blue)' }}>{(savings.waterSavedM3 ?? 0).toFixed(0)} m³ saved</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px' }}>
                <span>• Caliper / Grammage Jump Stabilization:</span>
                <strong style={{ color: 'var(--brand-blue)' }}>Continuous gradient</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• Slitter & Rewinder Deckle Width Switches:</span>
                <strong style={{ color: 'var(--brand-blue)' }}>Grouped by format</strong>
              </div>
            </div>
          </div>

          {/* Card 2: Non-Sequence Yield Losses */}
          <div
            style={{
              background: '#FAF5FF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #E9D5FF',
              padding: '18px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Layers size={18} color="#7C3AED" />
              <strong style={{ fontSize: '0.95rem', color: 'var(--navy-dark)' }}>
                Non-Sequence Yield Losses (Process Baselines)
              </strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              Inherent to machine geometry, paper grade, and finishing equipment. Fed into MRP gross requirement calculation.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px' }}>
                <span>• Deckle Edge Trim Loss (Format Geometry):</span>
                <strong style={{ color: '#7C3AED' }}>2.0% – 4.5% (Configurable)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px' }}>
                <span>• Web-Break Broke (Paper Tension by GSM):</span>
                <strong style={{ color: '#7C3AED' }}>1.5% – 3.2% (Configurable)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #CBD5E1', paddingBottom: '4px' }}>
                <span>• Fixed Startup Calibration Broke:</span>
                <strong style={{ color: '#7C3AED' }}>0.5 t / production run</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>• Converting & Finishing Scrap (Sheeting/Slit):</span>
                <strong style={{ color: '#7C3AED' }}>{lossModelConfig.enableConvertingLoss ? 'Active' : 'Off (Default)'}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Matrix Heatmap (Collapsible) */}
      {showTransitionMatrix && (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '2px solid var(--cyan-accent)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                Shade-to-Shade Transition Penalty Matrix (Hours)
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Rows: From Shade ➔ Columns: To Shade. Green indicates smooth transition (0.0h); Red indicates severe washout penalty (3.5h).
              </p>
            </div>
            <ClientInputBadge parameterName="Washout Chemistry Times" />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: '0.75rem', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: 'var(--off-white-bg)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>From \ To</th>
                  {shadeNames.map((name) => (
                    <th key={name} style={{ padding: '8px 6px', fontSize: '0.7rem' }}>
                      {name.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shadeNames.map((fromName, rIdx) => (
                  <tr key={fromName} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                      {fromName}
                    </td>
                    {shadeNames.map((toName, cIdx) => {
                      let hrs = 0.0;
                      if (rIdx === cIdx) hrs = 0.0;
                      else if (cIdx > rIdx) hrs = 0.0; // light to dark
                      else if (rIdx >= 6 && cIdx <= 1) hrs = 3.5; // dark to ultra-light
                      else if (rIdx >= 4 && cIdx <= 1) hrs = 2.0; // mid to light
                      else hrs = 1.2;

                      const bgColor =
                        hrs === 0.0 ? '#EBF9F1' : hrs >= 3.0 ? '#FEE2E2' : hrs >= 1.5 ? '#FEF3C7' : '#F0F9FF';
                      const textColor =
                        hrs === 0.0 ? '#107C41' : hrs >= 3.0 ? '#DC2626' : hrs >= 1.5 ? '#B45309' : '#0369A1';

                      return (
                        <td
                          key={toName}
                          style={{
                            padding: '8px 6px',
                            background: bgColor,
                            color: textColor,
                            fontWeight: 700,
                          }}
                        >
                          {hrs.toFixed(1)}h
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visual Gantt Schedule Comparison (Prompt Highlight: Light-to-Dark vs Random Ping-Pong) */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Visual Campaign Timeline (Gantt Schedule)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Click any production block to inspect the plain-language decision rationale in the Run Inspector below
            </p>
          </div>

          {/* Strategy Selector Toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--off-white-bg)',
              padding: '2px',
              borderRadius: '6px',
              border: '1px solid var(--border-light)',
              flexWrap: 'wrap',
              gap: '2px',
            }}
          >
            <button
              onClick={() => setViewMode('sideBySide')}
              style={{
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'sideBySide' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'sideBySide' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('hybrid')}
              style={{
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'hybrid' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'hybrid' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Hybrid {optimizationResult.recommendedStrategyId === 'hybrid' ? '(Recommended)' : ''}
            </button>
            <button
              onClick={() => setViewMode('color_first')}
              style={{
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'color_first' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'color_first' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Colour-First {optimizationResult.recommendedStrategyId === 'color_first' ? '(Recommended)' : ''}
            </button>
            <button
              onClick={() => setViewMode('grammage_first')}
              style={{
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'grammage_first' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'grammage_first' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Grammage-First {optimizationResult.recommendedStrategyId === 'grammage_first' ? '(Recommended)' : ''}
            </button>
            <button
              onClick={() => setViewMode('naive')}
              style={{
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'naive' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'naive' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Naive Baseline
            </button>
          </div>
        </div>

        {/* Schedule Timeline Rendering */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {viewMode === 'sideBySide' && (
            <>
              {renderTimeline(
                naiveResult.runs,
                naiveResult.metrics,
                'NAIVE SEQUENCE',
                'var(--danger-bg)',
                'var(--danger-crimson)',
                '#FECACA',
                'Order-Arrival (Un-sequenced FIFO Baseline)'
              )}
              {renderTimeline(
                recommendedResult.runs,
                recommendedResult.metrics,
                'RECOMMENDED SEQUENCE',
                'var(--brand-blue-light)',
                'var(--brand-blue)',
                '#BCEBF5',
                `${recommendedResult.metrics.strategyName ?? 'Intelligent Optimized'} Sequence`,
                true
              )}
            </>
          )}

          {viewMode === 'hybrid' &&
            renderTimeline(
              hybridResult.runs,
              hybridResult.metrics,
              'HYBRID SEQUENCE',
              'var(--brand-blue-light)',
              'var(--brand-blue)',
              '#BCEBF5',
              'Grammage Banding + Light-to-Dark inside Bands + 2-Opt Local Search',
              hybridResult.isRecommended ?? optimizationResult.recommendedStrategyId === 'hybrid'
            )}

          {viewMode === 'color_first' &&
            renderTimeline(
              colorFirstResult.runs,
              colorFirstResult.metrics,
              'COLOUR-FIRST LADDER',
              '#E0F2FE',
              'var(--brand-blue)',
              '#BAE6FD',
              'Strict Light-to-Dark Ladder (Format \u2192 Shade Group \u2192 Shade Tier)',
              colorFirstResult.isRecommended ?? optimizationResult.recommendedStrategyId === 'color_first'
            )}

          {viewMode === 'grammage_first' &&
            renderTimeline(
              grammageFirstResult.runs,
              grammageFirstResult.metrics,
              'GRAMMAGE-FIRST BANDING',
              '#F3E8FF',
              '#7C3AED',
              '#E9D5FF',
              'Ascending Grammage Bands \u2192 Light-to-Dark inside Bands',
              grammageFirstResult.isRecommended ?? optimizationResult.recommendedStrategyId === 'grammage_first'
            )}

          {viewMode === 'naive' &&
            renderTimeline(
              naiveResult.runs,
              naiveResult.metrics,
              'NAIVE SEQUENCE',
              'var(--danger-bg)',
              'var(--danger-crimson)',
              '#FECACA',
              'Order-Arrival (Un-sequenced FIFO Baseline)',
              naiveResult.isRecommended ?? optimizationResult.recommendedStrategyId === 'naive'
            )}

          {/* Timeline Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              padding: '10px 14px',
              background: 'var(--off-white-bg)',
              borderRadius: '6px',
              border: '1px solid var(--border-light)',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              marginTop: '4px',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--navy-dark)' }}>Timeline Legend:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  background: 'var(--danger-crimson)',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                !
              </span>
              <span>Intermediate Deep Washout (Colour backtrack)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  background: 'var(--warning-amber)',
                  color: '#FFFFFF',
                  borderRadius: '3px',
                  padding: '1px 4px',
                  fontSize: '0.58rem',
                  fontWeight: 800,
                }}
              >
                ▼ GSM
              </span>
              <span>Grammage Step-Down Reversal (Heavy &rarr; Light step)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '3px',
                  border: '2px solid var(--brand-blue)',
                  background: '#FFFFFF',
                  display: 'inline-block',
                }}
              />
              <span>Selected Run Focus</span>
            </div>
            <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Illustrative / Synthetic - Not actual Lessebo results
            </span>
          </div>
        </div>
      </div>

      {/* Explainability Inspector: "Why this sequence was selected" (Prompt Required Feature) */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '2px solid var(--brand-blue)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Eye size={18} color="var(--brand-blue)" />
              <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                Plain-Language Explainability Inspector
              </h3>
              <span
                style={{
                  background: 'var(--brand-blue)',
                  color: '#FFFFFF',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                Why this sequence was selected
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
              Explaining the multi-constraint logic behind Scheduled Run #{activeSelectedRun.runSequence}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Selected Run:</span>
            <select
              value={activeSelectedRun.order_id}
              onChange={(e) => setSelectedRunId(e.target.value)}
              style={{
                background: 'var(--off-white-bg)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--navy-dark)',
                cursor: 'pointer',
              }}
            >
              {currentDisplayedRuns.map((r) => (
                <option key={r.order_id} value={r.order_id}>
                  Run #{r.runSequence}: {r.shade_name} ({r.grammage_gsm}g) — {r.customer_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Detailed Run Card */}
        <div
          style={{
            background: 'var(--off-white-bg)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            border: '1px solid var(--border-light)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {/* Order Snapshot */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <ShadeSwatch hex={activeSelectedRun.shade_hex} name={activeSelectedRun.shade_name} size="lg" />
              <div>
                <h4 style={{ fontSize: '0.98rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                  {activeSelectedRun.brand_line} — {activeSelectedRun.shade_name}
                </h4>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {activeSelectedRun.sku_id} • {activeSelectedRun.assigned_machine}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', marginTop: '12px' }}>
              <div><strong>Customer:</strong> {activeSelectedRun.customer_name} ({activeSelectedRun.customer_priority})</div>
              <div><strong>Campaign Quantity:</strong> {activeSelectedRun.quantity_tonnes} tonnes ({activeSelectedRun.production_hours}h runtime)</div>
              <div><strong>Format / Deckle:</strong> {activeSelectedRun.format_type} {activeSelectedRun.sheet_dimensions ? `(${activeSelectedRun.sheet_dimensions})` : ''}</div>
              <div><strong>Customer Due Date:</strong> In {activeSelectedRun.due_in_days} days (Completes day {activeSelectedRun.completionDay})</div>
              <div><strong>Changeover Downtime:</strong> {activeSelectedRun.changeoverHours} hours (Broke: {activeSelectedRun.brokeTonnes} t)</div>
            </div>
          </div>

          {/* Plain-Language Rationale (Prompt Requirement) */}
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy-dark)', display: 'block', marginBottom: '8px' }}>
              Decision Engine Rationale (Why scheduled here):
            </span>

            {/* Badges */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
              {activeSelectedRun.explainability.badges.map((b, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background:
                      b.type === 'success'
                        ? 'var(--success-bg)'
                        : b.type === 'warning'
                        ? 'var(--warning-bg)'
                        : 'var(--brand-blue-light)',
                    color:
                      b.type === 'success'
                        ? 'var(--success-green)'
                        : b.type === 'warning'
                        ? 'var(--warning-amber)'
                        : 'var(--brand-blue)',
                  }}
                >
                  {b.text}
                </span>
              ))}
            </div>

            {/* Bullet points */}
            <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '18px', lineHeight: 1.6 }}>
              {activeSelectedRun.explainability.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {/* Transition Broke & Water Inspector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Droplets size={16} color="var(--brand-blue)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                Transition Broke & Effluent Water:
              </span>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid var(--border-light)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Color Washout Broke:</span>
                <strong style={{ color: (activeSelectedRun.changeoverBreakdown.colorBrokeTonnes ?? 0) > 0 ? 'var(--warning-amber)' : 'var(--text-primary)' }}>
                  {(activeSelectedRun.changeoverBreakdown.colorBrokeTonnes ?? 0).toFixed(2)} t
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Grammage Delta Broke:</span>
                <strong>{(activeSelectedRun.changeoverBreakdown.grammageBrokeTonnes ?? 0).toFixed(2)} t</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Format Switch Broke:</span>
                <strong>{(activeSelectedRun.changeoverBreakdown.formatBrokeTonnes ?? 0).toFixed(2)} t</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Start-up Calibration Broke:</span>
                <strong>{(activeSelectedRun.changeoverBreakdown.startupBrokeTonnes ?? 0).toFixed(2)} t</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Washout Effluent Water:</span>
                <strong style={{ color: 'var(--cyan-accent)' }}>
                  {(activeSelectedRun.changeoverBreakdown.washoutWaterM3 ?? 0).toFixed(1)} m³
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px', fontWeight: 700 }}>
                <span>Total Run Transition Broke:</span>
                <span style={{ color: 'var(--brand-blue)' }}>{activeSelectedRun.brokeTonnes.toFixed(2)} t</span>
              </div>
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
              Base: {activeSelectedRun.changeoverBreakdown.baseSetup}h • Washout: {activeSelectedRun.changeoverBreakdown.washoutHours}h • GSM: {activeSelectedRun.changeoverBreakdown.grammageHours}h • Format: {activeSelectedRun.changeoverBreakdown.formatHours}h
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
