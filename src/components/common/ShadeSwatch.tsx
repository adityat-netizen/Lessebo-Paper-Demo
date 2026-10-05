import React from 'react';

interface Props {
  hex: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const ShadeSwatch: React.FC<Props> = ({ hex, name, size = 'md', showLabel = false }) => {
  const dim = size === 'sm' ? 12 : size === 'lg' ? 20 : 16;
  const isLight = hex.toUpperCase() === '#FFFFFF' || hex.toUpperCase() === '#F6F4ED' || hex.toUpperCase() === '#EFE7D3';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          display: 'inline-block',
          width: `${dim}px`,
          height: `${dim}px`,
          borderRadius: '50%',
          backgroundColor: hex,
          border: isLight ? '1px solid #CBD5E1' : '1px solid rgba(0,0,0,0.15)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
          flexShrink: 0,
        }}
        title={`${name} (${hex})`}
      />
      {showLabel && <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{name}</span>}
    </div>
  );
};
