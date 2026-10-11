import React from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { ClientInputBadge } from '../common/ClientInputBadge';

export const WasteWaterfallChart: React.FC = () => {
  const { planningResult, lossModelConfig } = usePlanning();
  const {
    totalProductionTonnageRequired: netTonnes,
    totalGrossTonnageRequired: grossTonnes,
    totalLossTonnes,
    wasteSummary = [],
  } = planningResult;

  const yieldEfficiencyPct =
    grossTonnes > 0 ? Math.round((netTonnes / grossTonnes) * 1000) / 10 : 100;

  // Non-sequence component losses from wasteSummary
  const webBreak = wasteSummary.find((w) => w.componentId === 'web_break_loss')?.lossTonnes || 0;
  const trimLoss = wasteSummary.find((w) => w.componentId === 'deckle_trim_loss')?.lossTonnes || 0;
  const qualityRejects = wasteSummary.find((w) => w.componentId === 'quality_rejects')?.lossTonnes || 0;
  const convertingLoss = wasteSummary.find((w) => w.componentId === 'converting_finishing_loss')?.lossTonnes || 0;
  const lotRounding = wasteSummary.find((w) => w.componentId === 'lot_rounding_surplus')?.lossTonnes || 0;

  const waterfallSteps = [
    {
      id: 'net_demand',
      name: 'Net Order Need',
      type: 'baseline',
      value: netTonnes,
      delta: 0,
      color: '#006699',
      description: 'Demand after deducting on-hand & available finished goods inventory',
    },
    {
      id: 'web_break',
      name: 'Web-Break Broke',
      type: 'loss',
      value: webBreak,
      delta: webBreak,
      color: '#E06666',
      enabled: lossModelConfig.enableWebBreakLoss,
      description: 'Paper web snap broke by grammage band (Client input: 1.2%–2.2%)',
    },
    {
      id: 'trim_loss',
      name: 'Deckle Slitter Trim',
      type: 'loss',
      value: trimLoss,
      delta: trimLoss,
      color: '#E69138',
      enabled: lossModelConfig.enableTrimLoss,
      description: 'Edge slitter trim & deckle geometry fit (Client input: 1.8%–3.4%)',
    },
    {
      id: 'quality_rejects',
      name: 'Quality Rejects',
      type: 'loss',
      value: qualityRejects,
      delta: qualityRejects,
      color: '#9966CC',
      enabled: lossModelConfig.enableQualityRejects,
      description: 'Shade & visual off-spec rejection rate (Client input: 0.8%–2.6%)',
    },
    {
      id: 'converting_loss',
      name: 'Finishing / Converting',
      type: 'loss',
      value: convertingLoss,
      delta: convertingLoss,
      color: '#CC5500',
      enabled: lossModelConfig.enableConvertingLoss,
      description: 'Sheeter and packaging broke loss (Client input: 0.5%–2.0%)',
    },
    {
      id: 'lot_rounding',
      name: 'Lot Min. Batch Buffer',
      type: 'buffer',
      value: lotRounding,
      delta: lotRounding,
      color: '#2B8A3E',
      enabled: lossModelConfig.enableLotRounding,
      description: 'Batch rounding surplus held for next order cycle (Client input: 5t min)',
    },
    {
      id: 'gross_requirement',
      name: 'Gross Requirement',
      type: 'total',
      value: grossTonnes,
      delta: totalLossTonnes,
      color: '#1E293B',
      description: 'Total mill gross production requirement loaded onto paper machines',
    },
  ];

  // Max value for waterfall chart scaling
  const maxScale = Math.max(1, grossTonnes * 1.15);

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Header with Title and Badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Yield Loss & Waste Waterfall (Net-to-Gross Step-Up)
            </h3>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(217, 119, 6, 0.12)',
                color: 'var(--warning-amber)',
                border: '1px solid rgba(217, 119, 6, 0.3)',
              }}
            >
              Illustrative / Synthetic - Not actual Lessebo results
            </span>
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Calculates gross mill production by adding non-sequence broke, edge trim, and quality allowances to net order demand
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClientInputBadge parameterName="Waste & Yield Rates" />
        </div>
      </div>

      {/* KPI Overview Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          background: 'var(--off-white-bg)',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid var(--border-light)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
            Net Order Demand
          </span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--brand-blue)', fontWeight: 700 }}>
            {netTonnes.toLocaleString()} t
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
            Expected Losses & Broke
          </span>
          <strong style={{ fontSize: '1.15rem', color: '#D97706', fontWeight: 700 }}>
            +{totalLossTonnes.toLocaleString()} t
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
            Gross Production Required
          </span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 800 }}>
            {grossTonnes.toLocaleString()} t
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
            Expected Mill First-Pass Yield
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong style={{ fontSize: '1.15rem', color: 'var(--success-green)', fontWeight: 700 }}>
              {yieldEfficiencyPct}%
            </strong>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              ({Math.round((100 - yieldEfficiencyPct) * 10) / 10}% total loss)
            </span>
          </div>
        </div>
      </div>

      {/* Visual Waterfall Chart */}
      <div style={{ padding: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '180px', gap: '10px', borderBottom: '2px solid var(--border-light)', paddingBottom: '8px' }}>
          {waterfallSteps.map((step) => {
            const barHeightPct = Math.max(4, (step.value / maxScale) * 100);
            const isLoss = step.type === 'loss' || step.type === 'buffer';
            const isZero = step.value <= 0;

            return (
              <div
                key={step.id}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                  position: 'relative',
                }}
              >
                {/* Value Badge above bar */}
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: step.color,
                    marginBottom: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isLoss ? `+${step.value} t` : `${step.value} t`}
                </div>

                {/* Vertical Bar */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '48px',
                    height: `${barHeightPct}%`,
                    background: isZero
                      ? '#E2E8F0'
                      : step.type === 'baseline'
                      ? 'linear-gradient(180deg, #0088CC 0%, #005580 100%)'
                      : step.type === 'total'
                      ? 'linear-gradient(180deg, #334155 0%, #0F172A 100%)'
                      : `linear-gradient(180deg, ${step.color}DD 0%, ${step.color} 100%)`,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.4s ease',
                    boxShadow: isZero ? 'none' : '0 2px 4px rgba(0,0,0,0.08)',
                    opacity: step.enabled === false ? 0.4 : 1.0,
                  }}
                  title={`${step.name}: ${step.value} t`}
                />
              </div>
            );
          })}
        </div>

        {/* Labels below bars */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '10px' }}>
          {waterfallSteps.map((step) => (
            <div
              key={step.id}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.2,
              }}
            >
              <div style={{ fontWeight: 600, color: step.color }}>{step.name}</div>
              {step.enabled === false && (
                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>(Disabled)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Component Level Breakdown Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
            Itemized Loss Component Contribution
          </h4>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            All loss rates tagged as placeholder client parameters
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.74rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--off-white-bg)', borderBottom: '1px solid var(--border-light)' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Loss Component</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Category</th>
                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Status</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Loss Tonnes</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>% of Gross</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Machine Time</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Est. Cost</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Client Input Tag</th>
              </tr>
            </thead>
            <tbody>
              {wasteSummary
                .filter((w) => !w.isSequenceDependent)
                .map((comp) => (
                  <tr
                    key={comp.componentId}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      opacity: comp.isEnabled ? 1 : 0.6,
                    }}
                  >
                    <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--navy-dark)' }}>
                      {comp.componentName}
                    </td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                      {comp.category}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontSize: '0.66rem',
                          fontWeight: 600,
                          background: comp.isEnabled ? 'rgba(34, 197, 94, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                          color: comp.isEnabled ? 'var(--success-green)' : 'var(--text-muted)',
                        }}
                      >
                        {comp.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: comp.isEnabled ? '#D97706' : 'var(--text-muted)' }}>
                      {comp.isEnabled ? `${comp.lossTonnes} t` : '0.0 t'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      {comp.isEnabled ? `${comp.wastePercentageOfGross}%` : '0.0%'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {comp.isEnabled ? `${comp.machineHoursLost} h` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                      {comp.isEnabled ? `€${comp.estimatedCostEur.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          color: 'var(--brand-blue)',
                          background: 'var(--brand-blue-light)',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          fontWeight: 600,
                        }}
                      >
                        {comp.clientInputTag}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
