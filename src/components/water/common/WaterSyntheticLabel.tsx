import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface Props {
  text?: string;
  style?: React.CSSProperties;
}

export const WaterSyntheticLabel: React.FC<Props> = ({
  text = 'Illustrative / Synthetic — Not actual Lessebo results.',
  style
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '4px',
        backgroundColor: 'rgba(217, 119, 6, 0.12)',
        color: '#D97706',
        border: '1px solid rgba(217, 119, 6, 0.35)',
        fontSize: '0.72rem',
        fontWeight: 700,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        ...style
      }}
    >
      <ShieldAlert size={12} style={{ flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
};
