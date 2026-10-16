import React from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { Cpu, Clock, CheckCircle2, AlertCircle, RefreshCw, Database, Server, ChevronDown } from 'lucide-react';
import { ALGORITHM_OPTIONS, type ActiveOptimizer } from '../../types/cpsat';

export const OptimizerSelector: React.FC = () => {
  const {
    activeOptimizer,
    setActiveOptimizer,
    cpsatResult,
    isSolvingCpsat,
    solverHealth,
  } = usePlanning();

  const activeOption = ALGORITHM_OPTIONS.find((opt) => opt.id === activeOptimizer) || ALGORITHM_OPTIONS[0];
  const telemetry = cpsatResult?.telemetry;

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '18px 24px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Top Header & Disclaimers */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu size={22} color="var(--brand-blue)" />
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Production Sequence Optimizer Selection
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Select an optimization algorithm to sequence the paper machine campaign
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

      {/* 4-Algorithm Dropdown Selector Control */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--off-white-bg)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          border: '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <label
              htmlFor="optimizer-algorithm-select"
              style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--navy-dark)', whiteSpace: 'nowrap' }}
            >
              Optimization Algorithm:
            </label>
            <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
              <select
                id="optimizer-algorithm-select"
                value={activeOptimizer}
                onChange={(e) => setActiveOptimizer(e.target.value as ActiveOptimizer)}
                style={{
                  width: '100%',
                  padding: '9px 36px 9px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid var(--brand-blue)',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  color: 'var(--navy-dark)',
                  background: '#FFFFFF',
                  cursor: 'pointer',
                  appearance: 'none',
                  outline: 'none',
                }}
              >
                {ALGORITHM_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.family})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={18}
                color="var(--brand-blue)"
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              />
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                background: activeOption.badgeColor,
                color: 'var(--navy-dark)',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0,0,0,0.08)',
                whiteSpace: 'nowrap',
              }}
            >
              {activeOption.badge}
            </span>
          </div>

          {/* Health / Connection Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem' }}>
            {solverHealth?.isHealthy ? (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--success-green)',
                  fontWeight: 600,
                }}
              >
                <Server size={14} />
                Live Multi-Solver Connected (OR-Tools v{solverHealth.version})
              </span>
            ) : (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                <Database size={14} />
                Offline Demo Mode
              </span>
            )}
          </div>
        </div>

        {/* Algorithm Rationale Description */}
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.45 }}>
          {activeOption.description}
        </p>
      </div>

      {/* Loading Banner when solving */}
      {isSolvingCpsat && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 16px',
            borderRadius: '6px',
            background: '#F0F9FF',
            border: '1px solid #BAE6FD',
            fontSize: '0.8rem',
            color: 'var(--brand-blue)',
            fontWeight: 600,
          }}
        >
          <RefreshCw size={15} className="animate-spin" />
          <span>Solving campaign sequence with {activeOption.name} (4.0s timeout, 0.5% gap limit)...</span>
        </div>
      )}

      {/* Compact Read-Only Telemetry Strip */}
      {!isSolvingCpsat && telemetry && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            background: '#F8FAFC',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            fontSize: '0.76rem',
          }}
        >
          {/* Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '4px',
                background:
                  telemetry.status === 'OPTIMAL'
                    ? 'var(--success-bg)'
                    : telemetry.status === 'FEASIBLE'
                    ? '#FEF3C7'
                    : '#F1F5F9',
                color:
                  telemetry.status === 'OPTIMAL'
                    ? 'var(--success-green)'
                    : telemetry.status === 'FEASIBLE'
                    ? '#92400E'
                    : 'var(--text-secondary)',
                border: `1px solid ${
                  telemetry.status === 'OPTIMAL' ? '#BBF7D0' : telemetry.status === 'FEASIBLE' ? '#FDE68A' : '#CBD5E1'
                }`,
              }}
            >
              {telemetry.status}
            </span>
          </div>

          {/* Lower Bound */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Proven Lower Bound:</span>
            <strong style={{ color: 'var(--navy-dark)' }}>
              {telemetry.bestLowerBoundEur !== null
                ? `€${telemetry.bestLowerBoundEur.toLocaleString()}`
                : activeOptimizer === 'routing'
                ? 'N/A (Local Search)'
                : '—'}
            </strong>
          </div>

          {/* Optimality Gap */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Optimality Gap:</span>
            <strong style={{ color: telemetry.optimalityGapPct === 0 ? 'var(--success-green)' : 'var(--warning-amber)' }}>
              {telemetry.optimalityGapPct !== null ? `${telemetry.optimalityGapPct.toFixed(2)}%` : '—'}
            </strong>
          </div>

          {/* Solve Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={12} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-secondary)' }}>Solve Time:</span>
            <strong style={{ color: 'var(--navy-dark)' }}>
              {telemetry.solveTimeMs < 1000 ? `${telemetry.solveTimeMs.toFixed(0)} ms` : `${(telemetry.solveTimeMs / 1000).toFixed(2)} s`}
            </strong>
          </div>

          {/* Arcs & Runs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Graph:</span>
            <span style={{ color: 'var(--navy-dark)', fontWeight: 600 }}>
              {telemetry.runCount} runs • {telemetry.arcCount} arcs
            </span>
          </div>

          {/* Due Date Risks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
            {telemetry.dueDateViolations === 0 || telemetry.dueDateViolations === null ? (
              <span style={{ color: 'var(--success-green)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                <CheckCircle2 size={13} />
                All Customer Due Dates Met
              </span>
            ) : (
              <span style={{ color: 'var(--warning-amber)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                <AlertCircle size={13} />
                {telemetry.dueDateViolations} Due-Date Risk(s) Flagged
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
