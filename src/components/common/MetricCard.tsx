import React from 'react';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'highlight' | 'warning' | 'success';
  badgeText?: string;
  clientInputRequired?: boolean;
}

export const MetricCard: React.FC<Props> = ({
  label,
  value,
  unit,
  sublabel,
  icon,
  variant = 'default',
  badgeText,
  clientInputRequired = false,
}) => {
  const getBorderColor = () => {
    if (variant === 'highlight') return 'var(--cyan-accent)';
    if (variant === 'success') return 'var(--success-green)';
    if (variant === 'warning') return 'var(--warning-amber)';
    return 'var(--border-subtle)';
  };

  const getAccentBg = () => {
    if (variant === 'highlight') return 'linear-gradient(135deg, #FFFFFF 0%, #F0FAFD 100%)';
    if (variant === 'success') return 'linear-gradient(135deg, #FFFFFF 0%, #F2FAF5 100%)';
    if (variant === 'warning') return 'linear-gradient(135deg, #FFFFFF 0%, #FEF9EE 100%)';
    return '#FFFFFF';
  };

  return (
    <div
      style={{
        background: getAccentBg(),
        border: `1px solid ${getBorderColor()}`,
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        {icon && <div style={{ color: variant === 'highlight' ? 'var(--cyan-accent)' : 'var(--brand-blue)' }}>{icon}</div>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0 6px 0' }}>
        <span
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            fontFamily: 'Arial, sans-serif',
            color: 'var(--navy-dark)',
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {unit}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
        {sublabel && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {sublabel}
          </span>
        )}
        {badgeText && (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              background: variant === 'highlight' ? 'rgba(13, 187, 223, 0.15)' : 'var(--brand-blue-light)',
              color: variant === 'highlight' ? '#007A94' : 'var(--brand-blue)',
            }}
          >
            {badgeText}
          </span>
        )}
        {clientInputRequired && (
          <span
            className="badge-client-input"
            style={{ fontSize: '0.62rem', padding: '1px 4px' }}
            title="Formula includes mill specific variables needing calibration"
          >
            Client Input
          </span>
        )}
      </div>
    </div>
  );
};
