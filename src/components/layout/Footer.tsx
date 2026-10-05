import React from 'react';
import { ShieldAlert, Cpu } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        marginTop: 'auto',
        background: '#FFFFFF',
        borderTop: '1px solid var(--border-light)',
        padding: '24px',
        color: 'var(--text-secondary)',
        fontSize: '0.78rem',
      }}
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={16} color="var(--brand-blue)" />
          <span>
            <strong>Positioning:</strong> An intelligent decision-support system that helps planners understand future demand, generate feasible production plans, and optimize production sequencing while considering real operational constraints.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={14} color="var(--warning-amber)" />
            <span>Parameters flagged with [Client Input Required] require mill calibration.</span>
          </div>
          <span style={{ color: '#CBD5E1' }}>|</span>
          <span>© 2026 Tatras Data • Built for Lessebo Paper AB</span>
        </div>
      </div>
    </footer>
  );
};
