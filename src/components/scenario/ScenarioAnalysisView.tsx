import React from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { MetricCard } from '../common/MetricCard';
import {
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';

export const ScenarioAnalysisView: React.FC = () => {
  const {
    activePreset,
    applyPreset,
    demandDeltaPct,
    setDemandDeltaPct,
    pm1DowntimeHours,
    setPm1DowntimeHours,
    safetyBufferDays,
    setSafetyBufferDays,
    washoutMultiplier,
    setWashoutMultiplier,
    resetAssumptions,
    planningResult,
    optimizationResult,
  } = usePlanning();

  const { machineLoading } = planningResult;
  const { naive, optimized, savings } = optimizationResult;

  const presets = [
    {
      id: 'baseline' as const,
      title: 'Baseline Mill Plan',
      desc: 'Standard organic demand (+0%), 100% standard machine uptime, 10d safety stock.',
    },
    {
      id: 'peak_demand' as const,
      title: 'Q4 Packaging Surge (+20%)',
      desc: 'Autumn pre-holiday packaging spike; tests machine capacity saturation.',
    },
    {
      id: 'pm1_breakdown' as const,
      title: 'PM1 Unplanned Stop (-36h)',
      desc: 'Emergency headbox mechanical repair; tests SLA resilience and run prioritization.',
    },
    {
      id: 'vip_rush' as const,
      title: 'VIP Rush Order Insertion',
      desc: 'Urgent luxury publisher campaign inserted into existing schedule; tests washout handling.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Title */}
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
              Scenario Simulation & What-If Sandbox
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
              Sub-16ms Real-Time Engine
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Stress-test mill resilience under demand volatility, machine outages, and urgent order disruptions.
          </p>
        </div>

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
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={14} />
          Reset to Baseline
        </button>
      </div>

      {/* Preset Scenario Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
        {presets.map((preset) => {
          const isSelected = activePreset === preset.id;
          return (
            <div
              key={preset.id}
              onClick={() => applyPreset(preset.id)}
              style={{
                background: isSelected ? 'linear-gradient(135deg, #F0FAFD 0%, #FFFFFF 100%)' : '#FFFFFF',
                border: isSelected ? '2px solid var(--cyan-accent)' : '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                cursor: 'pointer',
                boxShadow: isSelected ? '0 4px 12px rgba(13, 187, 223, 0.15)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h4 style={{ fontSize: '0.88rem', color: isSelected ? 'var(--brand-blue)' : 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                  {preset.title}
                </h4>
                {isSelected && (
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
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                {preset.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Interactive Sliders Panel */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, marginBottom: '20px' }}>
          Interactive Mill Parameter Sliders
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Slider 1: Demand Delta */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                Demand Surge / Drop
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: demandDeltaPct > 0 ? 'var(--brand-blue)' : demandDeltaPct < 0 ? 'var(--danger-crimson)' : 'var(--text-primary)',
                }}
              >
                {demandDeltaPct > 0 ? `+${demandDeltaPct}%` : `${demandDeltaPct}%`}
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="30"
              step="5"
              value={demandDeltaPct}
              onChange={(e) => setDemandDeltaPct(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Range: -20% (Market slowdown) to +30% (Severe peak)
            </span>
          </div>

          {/* Slider 2: PM1 Downtime */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                PM1 Unplanned Downtime
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: pm1DowntimeHours > 0 ? 'var(--warning-amber)' : 'var(--navy-dark)' }}>
                {pm1DowntimeHours} hours
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="48"
              step="6"
              value={pm1DowntimeHours}
              onChange={(e) => setPm1DowntimeHours(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Simulates mechanical breakdowns & wire changes
            </span>
          </div>

          {/* Slider 3: Safety Buffer Days */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                Target Safety Buffer
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {safetyBufferDays} days
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="25"
              step="1"
              value={safetyBufferDays}
              onChange={(e) => setSafetyBufferDays(parseInt(e.target.value, 10))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Finished goods warehouse protection days
            </span>
          </div>

          {/* Slider 4: Washout Penalty Multiplier */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                Washout Severity
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {washoutMultiplier.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="1.0"
              max="1.75"
              step="0.05"
              value={washoutMultiplier}
              onChange={(e) => setWashoutMultiplier(parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Accounts for deep dye stains or cold winter water wash
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Scenario Sensitivity Scorecard */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, marginBottom: '16px' }}>
          Simulated Campaign Performance Under Selected Scenario
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <MetricCard
            label="PM1 Machine Loading"
            value={`${machineLoading.PM1.utilizationPct}%`}
            unit={`${machineLoading.PM1.totalRunHoursRequired}h / ${machineLoading.PM1.netAvailableHours}h`}
            variant={machineLoading.PM1.isBottleneck ? 'warning' : 'success'}
            sublabel={machineLoading.PM1.isBottleneck ? 'Over capacity limit! Re-scheduling needed' : 'Feasible headroom available'}
            badgeText={machineLoading.PM1.isBottleneck ? 'Bottleneck' : 'Feasible'}
          />

          <MetricCard
            label="Optimized Changeover Savings"
            value={`-${savings.changeoverHoursSaved}h`}
            unit="Saved"
            sublabel={`${optimized.metrics.totalChangeoverHours}h optimized vs ${naive.metrics.totalChangeoverHours}h naive`}
            variant="highlight"
            badgeText="Preserved Under Stress"
          />

          <MetricCard
            label="Broke Avoidance"
            value={`-${savings.brokeTonnesSaved} t`}
            unit="Fiber Saved"
            sublabel={`${optimized.metrics.totalBrokeTonnes}t broke vs ${naive.metrics.totalBrokeTonnes}t naive`}
            variant="success"
          />

          <MetricCard
            label="Customer SLA Compliance"
            value={`${optimized.metrics.slaCompliancePct}%`}
            unit="On-Time Delivery"
            sublabel={optimized.metrics.slaCompliancePct < 90 ? 'Tight deadline pressure' : 'All critical orders protected'}
            variant={optimized.metrics.slaCompliancePct >= 95 ? 'success' : 'warning'}
          />
        </div>
      </div>
    </div>
  );
};
