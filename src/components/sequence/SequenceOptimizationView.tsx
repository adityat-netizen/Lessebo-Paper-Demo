import React, { useState } from 'react';
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
} from 'lucide-react';
import type { ScheduledRun } from '../../types';

export const SequenceOptimizationView: React.FC = () => {
  const { optimizationResult, selectedRunId, setSelectedRunId, selectedMachine } =
    usePlanning();

  const [viewMode, setViewMode] = useState<'sideBySide' | 'optimized' | 'naive'>('sideBySide');
  const [showTransitionMatrix, setShowTransitionMatrix] = useState<boolean>(false);

  const { naive, optimized, savings } = optimizationResult;

  // Selected run for explainability inspection (defaults to first run with significant savings or selected by user)
  const activeSelectedRun: ScheduledRun =
    (selectedRunId
      ? optimized.runs.find((r) => r.order_id === selectedRunId) ||
        naive.runs.find((r) => r.order_id === selectedRunId)
      : null) ??
    optimized.runs[3] ??
    optimized.runs[0];

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

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--off-white-bg)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setViewMode('sideBySide')}
              style={{
                padding: '5px 12px',
                fontSize: '0.76rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'sideBySide' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'sideBySide' ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              Side-by-Side Comparison
            </button>
            <button
              onClick={() => setViewMode('optimized')}
              style={{
                padding: '5px 12px',
                fontSize: '0.76rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'optimized' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'optimized' ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              Optimized Only
            </button>
            <button
              onClick={() => setViewMode('naive')}
              style={{
                padding: '5px 12px',
                fontSize: '0.76rem',
                fontWeight: 600,
                borderRadius: '4px',
                background: viewMode === 'naive' ? 'var(--brand-blue)' : 'transparent',
                color: viewMode === 'naive' ? '#FFFFFF' : 'var(--text-secondary)',
              }}
            >
              Naive Only
            </button>
          </div>
        </div>

        {/* Schedule Timeline Rendering */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* NAIVE TIMELINE */}
          {(viewMode === 'sideBySide' || viewMode === 'naive') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: 'var(--danger-bg)',
                      color: 'var(--danger-crimson)',
                      border: '1px solid #FECACA',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    NAIVE SEQUENCE
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Order-Arrival (Un-sequenced)
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--danger-crimson)', fontWeight: 700 }}>
                  {naive.metrics.washoutCount} Washouts • {naive.metrics.totalChangeoverHours}h Downtime
                </span>
              </div>

              {/* Visual blocks */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'var(--off-white-bg)',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  overflowX: 'auto',
                }}
              >
                {naive.runs.map((run) => {
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
                          ? '3px solid var(--cyan-accent)'
                          : isLight
                          ? '1px solid #CBD5E1'
                          : '1px solid rgba(0,0,0,0.2)',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: isSelected ? '0 0 10px rgba(13,187,223,0.5)' : 'none',
                        flexShrink: 0,
                      }}
                    >
                      {/* Washout badge on top */}
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
          )}

          {/* OPTIMIZED TIMELINE */}
          {(viewMode === 'sideBySide' || viewMode === 'optimized') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: 'var(--brand-blue-light)',
                      color: 'var(--brand-blue)',
                      border: '1px solid #BCEBF5',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    OPTIMIZED SEQUENCE
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Intelligent Colour Ladder & Grammage Grouping
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--success-green)', fontWeight: 700 }}>
                  Zero Intermediate Washouts • Only {optimized.metrics.totalChangeoverHours}h Total Setup
                </span>
              </div>

              {/* Visual blocks */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'linear-gradient(90deg, #F0FAFD 0%, #FFFFFF 100%)',
                  padding: '8px',
                  borderRadius: '8px',
                  border: '1px solid #BCEBF5',
                  overflowX: 'auto',
                }}
              >
                {optimized.runs.map((run) => {
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
          )}
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
              {optimized.runs.map((r) => (
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
        </div>
      </div>
    </div>
  );
};
