import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { MetricCard } from '../common/MetricCard';
import { ScenarioInputControls } from './ScenarioInputControls';
import { ScenarioComparisonTable } from './ScenarioComparisonTable';
import { CsvExportButton } from '../common/CsvExportButton';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvExport';
import {
  SlidersHorizontal,
  RotateCcw,
  Plus,
  Lock,
  Layers,
} from 'lucide-react';

export const ScenarioAnalysisView: React.FC = () => {
  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    createScenario,
    resetAssumptions,
    activeScenarioEvaluation,
    activeScenario,
    activeScenarioParams,
    allScenarioEvaluations,
    baselineEvaluation,
    optimizationResult,
  } = usePlanning();

  const [showNewModal, setShowNewModal] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioDesc, setNewScenarioDesc] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenarioName.trim()) return;
    createScenario(newScenarioName.trim(), newScenarioDesc.trim());
    setNewScenarioName('');
    setNewScenarioDesc('');
    setShowNewModal(false);
  };

  const eval_ = activeScenarioEvaluation;

  const exportScenarioOptions = [
    {
      label: `Download Active Scenario (${activeScenario.name})`,
      description: 'Assumptions, KPI scorecard, and scheduled production runs for this scenario',
      onExport: () => {
        const runRows = optimizationResult.optimized.runs.map((r) => ({
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
          broke_tonnes: r.brokeTonnes,
          due_in_days: r.due_in_days,
          meets_sla: r.meetsSla ? 'YES' : 'NO',
          changeover_reason: r.changeoverBreakdown.reason,
        }));

        const csv = buildCsvContent(
          {
            datasetName: `Scenario Operational Run Schedule (${activeScenario.name})`,
            scenarioName: activeScenario.name,
            assumptions: {
              ScenarioDescription: activeScenario.description,
              FeasibilityStatus: activeScenarioEvaluation.feasibilityStatus,
              GlobalDemandScaling: `${activeScenarioParams.demandDeltaPct}%`,
              WhiteShadesMultiplier: `${activeScenarioParams.whiteDemandMult}x`,
              IvoryShadesMultiplier: `${activeScenarioParams.ivoryDemandMult}x`,
              ColorShadesMultiplier: `${activeScenarioParams.colorDemandMult}x`,
              UrgentOrdersShare: `${activeScenarioParams.urgentOrderSharePct}%`,
              PM1UnplannedStop: `${activeScenarioParams.pm1DowntimeHours} hours`,
              PM2UnplannedStop: `${activeScenarioParams.pm2DowntimeHours} hours`,
              LineSpeedMultiplier: `${Math.round(activeScenarioParams.productionSpeedMultiplier * 100)}%`,
              SafetyBufferDays: `${activeScenarioParams.safetyBufferDays} days`,
              WashoutPenalty: `${activeScenarioParams.washoutMultiplier}x`,
              BrokeRate: `${activeScenarioParams.brokeRateTph} t/h (Client input required)`,
              HourlyMachineCost: `€${activeScenarioParams.hourlyOperatingCostEur}/h (Client input required)`,
              BrokeScrapCost: `€${activeScenarioParams.brokeCostPerTonneEur}/t (Client input required)`,
              GrossProductionRequirement: `${activeScenarioEvaluation.grossRequiredTonnes ?? activeScenarioEvaluation.netRequiredTonnes} tonnes`,
              TotalExpectedYieldLoss: `${(activeScenarioEvaluation.totalYieldLossTonnes ?? 0).toFixed(1)} tonnes`,
              FirstPassYield: `${(activeScenarioEvaluation.totalYieldPct ?? 100).toFixed(1)}%`,
              WashoutEffluentWater: `${activeScenarioEvaluation.washoutWaterM3 ?? 0} m3`,
              BrokeFurnishRecyclingRatio: `${(activeScenarioEvaluation.brokeFurnishPct ?? 0).toFixed(1)}%`,
              CombinedUtilization: `${activeScenarioEvaluation.combinedUtilizationPct}%`,
              TotalChangeoverHours: `${activeScenarioEvaluation.totalChangeoverHours}h`,
              TotalBrokeScrap: `${activeScenarioEvaluation.totalBrokeTonnes}t`,
              TotalFinancialCost: `€${activeScenarioEvaluation.totalFinancialCostEur.toLocaleString()}`,
              SLAComplianceRate: `${activeScenarioEvaluation.slaCompliancePct}%`,
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
            { key: 'changeover_hours', label: 'Changeover Duration', unit: 'hours' },
            { key: 'broke_tonnes', label: 'Transition Broke Scrap', unit: 'tonnes' },
            { key: 'due_in_days', label: 'Customer Due Deadline', unit: 'days' },
            { key: 'meets_sla', label: 'SLA Delivery Compliance' },
            { key: 'changeover_reason', label: 'Changeover Engineering Reason' },
          ],
          runRows
        );

        downloadCsvFile(`scenario_${activeScenario.id.toLowerCase()}_schedule`, activeScenario.id.toLowerCase(), csv);
      },
    },
    {
      label: 'Download Side-by-Side Comparison Matrix',
      description: 'Tabular comparison of all persisted scenarios against the Baseline benchmark',
      onExport: () => {
        const columns = [
          { key: 'metric', label: 'Operational & Financial Metric' },
          { key: 'unit', label: 'Unit' },
          ...scenarios.flatMap((s) => {
            const cols = [{ key: `${s.id}_val`, label: `${s.name}` }];
            if (s.id !== 'baseline') {
              cols.push({ key: `${s.id}_delta`, label: `${s.name} (Delta vs Baseline)` });
            }
            return cols;
          }),
        ];

        const makeRow = (
          metric: string,
          unit: string,
          accessor: (ev: typeof baselineEvaluation) => number | string,
          isDeltaNumber: boolean = true
        ) => {
          const row: Record<string, string | number> = { metric, unit };
          const baseVal = accessor(baselineEvaluation);
          scenarios.forEach((s) => {
            const ev = allScenarioEvaluations[s.id] || baselineEvaluation;
            const val = accessor(ev);
            row[`${s.id}_val`] = val;
            if (s.id !== 'baseline') {
              if (isDeltaNumber && typeof val === 'number' && typeof baseVal === 'number') {
                const delta = Math.round((val - baseVal) * 10) / 10;
                row[`${s.id}_delta`] = delta > 0 ? `+${delta}` : `${delta}`;
              } else {
                row[`${s.id}_delta`] = val === baseVal ? 'Same' : `${val} vs ${baseVal}`;
              }
            }
          });
          return row;
        };

        const rows = [
          makeRow('Feasibility Status', 'Status', (ev) => ev.feasibilityStatus, false),
          makeRow('Net Production Demand', 'tonnes', (ev) => ev.netRequiredTonnes),
          makeRow('Gross Production Requirement', 'tonnes', (ev) => ev.grossRequiredTonnes ?? ev.netRequiredTonnes),
          makeRow('Total Expected Yield Losses', 'tonnes', (ev) => ev.totalYieldLossTonnes ?? 0),
          makeRow('First-Pass Yield Efficiency', '%', (ev) => ev.totalYieldPct ?? 100),
          makeRow('Combined Machine Utilization', '%', (ev) => ev.combinedUtilizationPct),
          makeRow('PM1 Machine Loading Utilization', '%', (ev) => ev.pm1UtilizationPct),
          makeRow('PM2 Machine Loading Utilization', '%', (ev) => ev.pm2UtilizationPct),
          makeRow('Optimized Changeover Duration', 'hours', (ev) => ev.totalChangeoverHours),
          makeRow('Transition Broke Scrap', 'tonnes', (ev) => ev.totalBrokeTonnes),
          makeRow('Washout Cleaning Effluent Water', 'm3', (ev) => ev.washoutWaterM3 ?? 0),
          makeRow('Broke Furnish Recycling Ratio', '%', (ev) => ev.brokeFurnishPct ?? 0),
          makeRow('Estimated Total Financial Cost', 'EUR', (ev) => ev.totalFinancialCostEur),
          makeRow('Customer SLA On-Time Compliance', '%', (ev) => ev.slaCompliancePct),
          makeRow('Orders Near / At Risk of Delay', 'orders', (ev) => ev.ordersAtRiskCount),
        ];

        const csv = buildCsvContent(
          {
            datasetName: 'Side-by-Side What-If Scenario Impact Matrix',
            scenarioName: `Comparison Across ${scenarios.length} Scenarios`,
            assumptions: {
              Baseline: 'Baseline Mill Plan (Locked)',
              TotalScenarios: scenarios.length,
            },
          },
          columns,
          rows
        );

        downloadCsvFile('scenario_comparison_matrix', 'comparison', csv);
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <SlidersHorizontal size={18} color="var(--brand-blue)" />
            <h2 style={{ fontSize: '1.25rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Adjustable What-If Scenario Workbench
            </h2>
            <span
              style={{
                fontSize: '0.7rem',
                background: 'var(--brand-blue-light)',
                color: 'var(--brand-blue)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              Real-Time Simulation Engine
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Simulate operational paper mill resilience under demand volatility, machine outages, and urgent order disruptions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CsvExportButton label="Export CSV" options={exportScenarioOptions} />
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              background: 'var(--brand-blue)',
              color: '#FFFFFF',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Plus size={14} />
            New Scenario
          </button>

          <button
            onClick={resetAssumptions}
            style={{
              background: 'var(--off-white-bg)',
              border: '1px solid var(--border-light)',
              color: 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Reset active scenario view to Baseline"
          >
            <RotateCcw size={14} />
            Switch to Baseline
          </button>
        </div>
      </div>

      {/* New Scenario Modal */}
      {showNewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26, 26, 46, 0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 28px',
              width: '100%',
              maxWidth: '480px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: '0 0 16px 0' }}>
              Create New What-If Scenario
            </h3>
            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Scenario Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Extended Q3 Maintenance + 15% Demand"
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  Scenario Description / Rationale
                </label>
                <textarea
                  rows={3}
                  placeholder="Operational context and expected bottlenecks..."
                  value={newScenarioDesc}
                  onChange={(e) => setNewScenarioDesc(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.82rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '4px',
                    background: '#F1F5F9',
                    border: 'none',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '4px',
                    background: 'var(--brand-blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Create &amp; Edit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scenario Selector Ribbon (Minimum 5 Scenarios Persisted) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Layers size={16} color="var(--brand-blue)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
            Available Scenarios ({scenarios.length})
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            Persisted in browser storage • Baseline locked
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {scenarios.map((s) => {
            const isSelected = activeScenarioId === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setActiveScenarioId(s.id)}
                style={{
                  background: isSelected
                    ? 'linear-gradient(135deg, #F0FAFD 0%, #FFFFFF 100%)'
                    : '#FFFFFF',
                  border: isSelected
                    ? '2px solid var(--cyan-accent)'
                    : '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  cursor: 'pointer',
                  boxShadow: isSelected
                    ? '0 4px 12px rgba(13, 187, 223, 0.15)'
                    : 'var(--shadow-sm)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <h4
                    style={{
                      fontSize: '0.84rem',
                      color: isSelected ? 'var(--brand-blue)' : 'var(--navy-dark)',
                      fontWeight: 700,
                      margin: 0,
                      lineHeight: 1.3,
                    }}
                  >
                    {s.name}
                  </h4>
                  {s.isLockedBaseline ? (
                    <span
                      style={{
                        background: 'rgba(100, 116, 139, 0.12)',
                        color: '#475569',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <Lock size={9} /> Locked
                    </span>
                  ) : isSelected ? (
                    <span
                      style={{
                        background: 'var(--cyan-accent)',
                        color: 'var(--navy-dark)',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Active
                    </span>
                  ) : null}
                </div>
                <p
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.35,
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {s.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Scenario Parameter Sliders & Controls */}
      <ScenarioInputControls />

      {/* Simulated Campaign Performance Metrics */}
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
          <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
            Simulated Campaign Performance: {activeScenario.name}
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Live recalculation across net demand, machine loading, and changeover penalties
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <MetricCard
            label="Gross Production Requirement"
            value={`${(eval_.grossRequiredTonnes ?? eval_.netRequiredTonnes).toLocaleString()} t`}
            unit={`Net Need: ${eval_.netRequiredTonnes.toLocaleString()} t`}
            sublabel={`Includes +${(eval_.totalYieldLossTonnes ?? 0).toFixed(1)} t expected yield losses`}
            variant="highlight"
            badgeText={`${(eval_.totalYieldPct ?? 100).toFixed(1)}% Yield`}
          />

          <MetricCard
            label="Combined Machine Utilization"
            value={`${eval_.combinedUtilizationPct}%`}
            unit={`PM1: ${eval_.pm1UtilizationPct}% | PM2: ${eval_.pm2UtilizationPct}%`}
            variant={eval_.combinedUtilizationPct > 100 ? 'warning' : 'success'}
            sublabel={
              eval_.combinedUtilizationPct > 100
                ? 'Over capacity limit! Re-scheduling or load shifting required'
                : 'Feasible operational headroom available'
            }
            badgeText={eval_.feasibilityStatus}
          />

          <MetricCard
            label="Optimized Changeover Hours"
            value={`${eval_.totalChangeoverHours} h`}
            unit="Transition Hours"
            sublabel="Calculated using sequence optimization heuristic"
            variant="highlight"
            badgeText="Sequenced"
          />

          <MetricCard
            label="Transition Broke Scrap"
            value={`${eval_.totalBrokeTonnes} t`}
            unit="Fiber Waste"
            sublabel={`Valued at €${eval_.totalBrokeCostEur.toLocaleString()} scrap recovery cost`}
            variant="warning"
          />

          <MetricCard
            label="Effluent Water & Broke Furnish"
            value={`${(eval_.washoutWaterM3 ?? 0).toFixed(0)} m³`}
            unit={`Broke Furnish: ${(eval_.brokeFurnishPct ?? 0).toFixed(1)}%`}
            sublabel={
              eval_.brokeRecycleExceeded
                ? 'Furnish ceiling exceeded! Repulping alert'
                : 'Within safe furnish repulping ceiling'
            }
            variant={eval_.brokeRecycleExceeded ? 'warning' : 'default'}
            badgeText={eval_.brokeRecycleExceeded ? 'Ceiling Alert' : 'Furnish Safe'}
          />

          <MetricCard
            label="Customer SLA Compliance"
            value={`${eval_.slaCompliancePct}%`}
            unit="On-Time Delivery"
            sublabel={`${eval_.ordersAtRiskCount} order(s) close to SLA deadline`}
            variant={eval_.slaCompliancePct >= 90 ? 'success' : 'warning'}
          />
        </div>
      </div>

      {/* Side-by-Side Multi-Scenario Comparison Matrix */}
      <ScenarioComparisonTable />
    </div>
  );
};
