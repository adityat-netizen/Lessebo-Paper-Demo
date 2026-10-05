import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const HonestyBanner: React.FC = () => {
  return (
    <div className="honesty-banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="honesty-badge">
          <ShieldCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Illustrative / Synthetic Data
        </span>
        <span style={{ color: '#94A3B8' }}>
          All figures, order books, and operational metrics are synthetic models developed by Tatras Data for demonstration purposes — Not actual Lessebo Paper AB internal figures.
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#0DBBDF' }}>
        <Info size={13} />
        <span>Intelligent Decision-Support Prototype</span>
      </div>
    </div>
  );
};
