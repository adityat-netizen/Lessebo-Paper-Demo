import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import {
  Table,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Check,
  Download,
} from 'lucide-react';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvExport';
import type { FeasibilityStatus } from '../../types/scenarioWorkbench';

export const ScenarioComparisonTable: React.FC = () => {
  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    allScenarioEvaluations,
    baselineEvaluation,
  } = usePlanning();

  // Selected scenario IDs for comparison (Baseline is always pinned as column 1)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    // Default to Baseline plus up to 3 scenarios (including active)
    const initial = ['baseline'];
    if (activeScenarioId !== 'baseline' && !initial.includes(activeScenarioId)) {
      initial.push(activeScenarioId);
    }
    scenarios.forEach((s) => {
      if (initial.length < 4 && !initial.includes(s.id)) {
        initial.push(s.id);
      }
    });
    return initial;
  });

  const toggleScenario = (id: string) => {
    if (id === 'baseline') return; // Baseline cannot be unselected
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedIds(scenarios.map((s) => s.id));
  };

  const selectActiveOnly = () => {
    setSelectedIds(['baseline', activeScenarioId]);
  };

  const displayedScenarios = scenarios.filter((s) => selectedIds.includes(s.id));

  const handleExportComparison = () => {
    const columns = [
      { key: 'metric', label: 'Operational & Financial Metric' },
      { key: 'unit', label: 'Unit' },
      ...displayedScenarios.flatMap((s) => {
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
      displayedScenarios.forEach((s) => {
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
        scenarioName: `Comparison Across ${displayedScenarios.length} Scenarios`,
        assumptions: {
          Baseline: 'Baseline Mill Plan (Locked)',
          DisplayedScenarios: displayedScenarios.map((s) => s.name).join(' | '),
        },
      },
      columns,
      rows
    );

    downloadCsvFile('scenario_impact_matrix', 'comparison', csv);
  };

  // Render Feasibility Badge
  const renderFeasibility = (status: FeasibilityStatus) => {
    if (status === 'Infeasible') {
      return (
        <span
          style={{
            background: 'rgba(220, 38, 38, 0.1)',
            color: '#DC2626',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
          }}
        >
          <XCircle size={12} /> Infeasible
        </span>
      );
    }
    if (status === 'Capacity-Constrained') {
      return (
        <span
          style={{
            background: 'rgba(217, 119, 6, 0.1)',
            color: '#D97706',
            fontSize: '0.72rem',
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            textTransform: 'uppercase',
          }}
        >
          <AlertTriangle size={12} /> Constrained
        </span>
      );
    }
    return (
      <span
        style={{
          background: 'rgba(16, 124, 65, 0.1)',
          color: '#107C41',
          fontSize: '0.72rem',
          fontWeight: 800,
          padding: '3px 8px',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          textTransform: 'uppercase',
        }}
      >
        <CheckCircle2 size={12} /> Feasible
      </span>
    );
  };

  // Helper for rendering delta vs baseline
  const renderDelta = (
    currentVal: number,
    baseVal: number,
    unit: string,
    lowerIsBetter: boolean = false,
    formatAsCurrency: boolean = false
  ) => {
    const delta = currentVal - baseVal;
    if (Math.abs(delta) < 0.01) {
      return <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>— baseline</span>;
    }

    const isGood = lowerIsBetter ? delta < 0 : delta > 0;
    const color = isGood ? 'var(--success-green)' : 'var(--danger-crimson)';
    const sign = delta > 0 ? '+' : '';

    const formattedDelta = formatAsCurrency
      ? `${sign}€${Math.round(delta).toLocaleString()}`
      : `${sign}${Math.round(delta * 10) / 10} ${unit}`;

    return (
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color,
          display: 'inline-block',
          marginLeft: '6px',
        }}
      >
        ({formattedDelta})
      </span>
    );
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header and Scenario Filter Pills */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-light)',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Table size={18} color="var(--brand-blue)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 800, margin: 0 }}>
              Side-by-Side Scenario Impact Matrix
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
            Compare operational loading, changeover penalties, scrap fiber, and SLA delivery compliance against the locked Baseline benchmark.
          </p>
        </div>

        {/* Quick select buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={selectActiveOnly}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              background: '#FFFFFF',
              border: '1px solid var(--border-light)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            Baseline vs Active
          </button>
          <button
            onClick={selectAll}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              background: 'var(--brand-blue-light)',
              border: '1px solid rgba(0, 82, 152, 0.2)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: 'var(--brand-blue)',
            }}
          >
            Compare All ({scenarios.length})
          </button>
          <button
            onClick={handleExportComparison}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              background: '#005298',
              border: 'none',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            title="Download side-by-side comparison CSV"
          >
            <Download size={13} />
            Export Table CSV
          </button>
        </div>
      </div>

      {/* Scenario Selection Chips */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          background: '#FFFFFF',
        }}
      >
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-dark)', marginRight: '4px' }}>
          Include in Comparison:
        </span>
        {scenarios.map((s) => {
          const isIncluded = selectedIds.includes(s.id);
          const isBaseline = s.id === 'baseline';
          return (
            <button
              key={s.id}
              onClick={() => toggleScenario(s.id)}
              disabled={isBaseline}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '16px',
                border: isIncluded ? '1px solid var(--brand-blue)' : '1px solid var(--border-light)',
                background: isIncluded ? 'var(--brand-blue-light)' : '#F8FAFC',
                color: isIncluded ? 'var(--brand-blue)' : 'var(--text-secondary)',
                fontSize: '0.74rem',
                fontWeight: isIncluded ? 700 : 500,
                cursor: isBaseline ? 'default' : 'pointer',
                opacity: isBaseline ? 0.9 : 1,
              }}
            >
              {isIncluded && <Check size={12} />}
              {s.name}
              {isBaseline && ' (Pinned)'}
            </button>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.82rem',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-light)' }}>
              <th
                style={{
                  padding: '14px 20px',
                  fontWeight: 800,
                  color: 'var(--navy-dark)',
                  minWidth: '240px',
                  position: 'sticky',
                  left: 0,
                  background: '#F8FAFC',
                  zIndex: 2,
                }}
              >
                Operational &amp; Financial Metric
              </th>
              {displayedScenarios.map((s) => {
                const isActive = activeScenarioId === s.id;
                const isBaseline = s.id === 'baseline';
                return (
                  <th
                    key={s.id}
                    style={{
                      padding: '14px 20px',
                      fontWeight: 800,
                      color: isActive ? 'var(--brand-blue)' : 'var(--navy-dark)',
                      minWidth: '200px',
                      background: isActive ? '#F0FAFD' : '#F8FAFC',
                      borderLeft: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem' }}>{s.name}</span>
                      {isActive ? (
                        <span
                          style={{
                            background: 'var(--cyan-accent)',
                            color: 'var(--navy-dark)',
                            fontSize: '0.6rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          ACTIVE
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveScenarioId(s.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--brand-blue)',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                          title="Switch active workbench to this scenario"
                        >
                          <Eye size={12} /> Activate
                        </button>
                      )}
                    </div>
                    {isBaseline && (
                      <span style={{ fontSize: '0.68rem', color: '#64748B', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                        Benchmark Standard
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Row 1: Feasibility Status */}
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#FAFCFD' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 700,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FAFCFD',
                  zIndex: 1,
                }}
              >
                Feasibility Status
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                    }}
                  >
                    {renderFeasibility(eval_.feasibilityStatus)}
                  </td>
                );
              })}
            </tr>

            {/* Row 2: Total Net Production Demand */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                <div>Net Production Demand</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Finished goods tonnage required</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{eval_.netRequiredTonnes.toLocaleString()} t</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.netRequiredTonnes,
                        baselineEvaluation.netRequiredTonnes,
                        't',
                        false
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 2b: Gross Production Requirement */}
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#F0FAFD' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 700,
                  color: 'var(--brand-blue)',
                  position: 'sticky',
                  left: 0,
                  background: '#F0FAFD',
                  zIndex: 1,
                }}
              >
                <div>Gross Production Requirement</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Net demand + expected yield losses</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const grossVal = eval_.grossRequiredTonnes ?? eval_.netRequiredTonnes;
                const baseGrossVal = baselineEvaluation.grossRequiredTonnes ?? baselineEvaluation.netRequiredTonnes;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 800,
                      color: 'var(--brand-blue)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{grossVal.toLocaleString()} t</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        grossVal,
                        baseGrossVal,
                        't',
                        false
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 2c: Total Expected Yield Losses */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                <div>Total Expected Yield Losses</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Trim, web-breaks, broke, setup</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const lossVal = eval_.totalYieldLossTonnes ?? 0;
                const baseLossVal = baselineEvaluation.totalYieldLossTonnes ?? 0;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      color: lossVal > 0 ? '#D97706' : 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{lossVal.toFixed(1)} t</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        lossVal,
                        baseLossVal,
                        't',
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 2d: First-Pass Yield Efficiency */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '10px 20px',
                  color: 'var(--text-secondary)',
                  paddingLeft: '32px',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                First-Pass Yield Efficiency (Net / Gross)
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const yieldPct = eval_.totalYieldPct ?? 100;
                const baseYieldPct = baselineEvaluation.totalYieldPct ?? 100;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '10px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      color: yieldPct < 90 ? '#D97706' : 'var(--success-green)',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{yieldPct.toFixed(1)}%</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        yieldPct,
                        baseYieldPct,
                        '%',
                        false
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 3: Combined Machine Utilization */}
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#FAFCFD' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FAFCFD',
                  zIndex: 1,
                }}
              >
                <div>Combined Machine Utilization</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>PM1 + PM2 net required / net available</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const isOver = eval_.combinedUtilizationPct > 100;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 800,
                      color: isOver ? '#DC2626' : 'var(--navy-dark)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{eval_.combinedUtilizationPct}%</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.combinedUtilizationPct,
                        baselineEvaluation.combinedUtilizationPct,
                        '%',
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 4: PM1 Utilization Breakdown */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '10px 20px',
                  color: 'var(--text-secondary)',
                  paddingLeft: '32px',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                PM1 Loading ({allScenarioEvaluations[activeScenarioId]?.pm1RequiredHours}h / {allScenarioEvaluations[activeScenarioId]?.pm1NetAvailableHours}h)
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '10px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      color: eval_.pm1UtilizationPct > 100 ? '#DC2626' : 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {eval_.pm1UtilizationPct}%
                  </td>
                );
              })}
            </tr>

            {/* Row 5: PM2 Utilization Breakdown */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '10px 20px',
                  color: 'var(--text-secondary)',
                  paddingLeft: '32px',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                PM2 Loading ({allScenarioEvaluations[activeScenarioId]?.pm2RequiredHours}h / {allScenarioEvaluations[activeScenarioId]?.pm2NetAvailableHours}h)
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '10px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      color: eval_.pm2UtilizationPct > 100 ? '#DC2626' : 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {eval_.pm2UtilizationPct}%
                  </td>
                );
              })}
            </tr>

            {/* Row 6: Changeover Transition Hours */}
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#FAFCFD' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FAFCFD',
                  zIndex: 1,
                }}
              >
                <div>Optimized Changeover Duration</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Washouts, setups, grammage steps</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{eval_.totalChangeoverHours} h</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.totalChangeoverHours,
                        baselineEvaluation.totalChangeoverHours,
                        'h',
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 7: Transition Broke Scrap */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                <div>Transition Broke Scrap</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Grade change fiber loss</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{eval_.totalBrokeTonnes} t</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.totalBrokeTonnes,
                        baselineEvaluation.totalBrokeTonnes,
                        't',
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 7b: Washout Cleaning Effluent Water */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                <div>Washout Effluent Water Loss</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Chest chemical flush volume</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const waterVal = eval_.washoutWaterM3 ?? 0;
                const baseWaterVal = baselineEvaluation.washoutWaterM3 ?? 0;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      color: 'var(--cyan-accent)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{waterVal.toFixed(0)} m³</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        waterVal,
                        baseWaterVal,
                        'm³',
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 7c: Broke Furnish Recycling Ratio */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                <div>Broke Furnish Recycling Ratio</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Broke as % of gross furnish (Max ceiling ~15%)</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const brokePct = eval_.brokeFurnishPct ?? 0;
                const baseBrokePct = baselineEvaluation.brokeFurnishPct ?? 0;
                const isExceeded = !!eval_.brokeRecycleExceeded;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      color: isExceeded ? '#DC2626' : 'var(--navy-dark)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{brokePct.toFixed(1)}%</span>
                      {isExceeded && (
                        <span
                          style={{
                            background: '#FEE2E2',
                            color: '#DC2626',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          CEILING
                        </span>
                      )}
                    </div>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        brokePct,
                        baseBrokePct,
                        '%',
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 8: Estimated Total Financial Cost */}
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#FAFCFD' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FAFCFD',
                  zIndex: 1,
                }}
              >
                <div>Estimated Financial Cost</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Operating hours + fiber loss valuation</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 800,
                      color: 'var(--navy-dark)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>€{eval_.totalFinancialCostEur.toLocaleString()}</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.totalFinancialCostEur,
                        baselineEvaluation.totalFinancialCostEur,
                        'EUR',
                        true,
                        true
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 9: SLA Compliance */}
            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FFFFFF',
                  zIndex: 1,
                }}
              >
                <div>Customer SLA Delivery Compliance</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Orders completed on or before deadline</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                const isLow = eval_.slaCompliancePct < 90;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 800,
                      color: isLow ? '#DC2626' : 'var(--success-green)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{eval_.slaCompliancePct}%</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.slaCompliancePct,
                        baselineEvaluation.slaCompliancePct,
                        '%',
                        false
                      )}
                  </td>
                );
              })}
            </tr>

            {/* Row 10: Orders at Risk */}
            <tr style={{ borderBottom: '1px solid var(--border-light)', background: '#FAFCFD' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontWeight: 600,
                  color: 'var(--navy-dark)',
                  position: 'sticky',
                  left: 0,
                  background: '#FAFCFD',
                  zIndex: 1,
                }}
              >
                <div>Orders Near / At Risk of Delay</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Due date margin &lt;= 0 days</div>
              </td>
              {displayedScenarios.map((s) => {
                const eval_ = allScenarioEvaluations[s.id] || baselineEvaluation;
                return (
                  <td
                    key={s.id}
                    style={{
                      padding: '12px 20px',
                      borderLeft: '1px solid var(--border-light)',
                      fontWeight: 700,
                      color: eval_.ordersAtRiskCount > 0 ? '#DC2626' : 'var(--success-green)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    <span>{eval_.ordersAtRiskCount} order(s)</span>
                    {s.id !== 'baseline' &&
                      renderDelta(
                        eval_.ordersAtRiskCount,
                        baselineEvaluation.ordersAtRiskCount,
                        'orders',
                        true
                      )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
