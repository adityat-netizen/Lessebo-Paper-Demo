import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';

export interface CsvExportOption {
  label: string;
  description?: string;
  onExport: () => void;
}

interface Props {
  label?: string;
  options?: CsvExportOption[];
  onExport?: () => void;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

export const CsvExportButton: React.FC<Props> = ({
  label = 'Export CSV',
  options,
  onExport,
  size = 'md',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasMultipleOptions = options && options.length > 1;

  const handleMainClick = () => {
    if (hasMultipleOptions) {
      setIsOpen((prev) => !prev);
    } else if (options && options.length === 1) {
      options[0].onExport();
    } else if (onExport) {
      onExport();
    }
  };

  const padY = size === 'sm' ? '5px' : '7px';
  const padX = size === 'sm' ? '10px' : '14px';
  const fontSize = size === 'sm' ? '0.74rem' : '0.8rem';

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      <button
        onClick={handleMainClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: `${padY} ${padX}`,
          background: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--brand-blue)',
          fontWeight: 600,
          fontSize,
          boxShadow: 'var(--shadow-sm)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--brand-blue-light)';
          e.currentTarget.style.borderColor = 'var(--brand-blue)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#FFFFFF';
          e.currentTarget.style.borderColor = 'var(--border-subtle)';
        }}
      >
        <Download size={size === 'sm' ? 13 : 15} />
        <span>{label}</span>
        {hasMultipleOptions && <ChevronDown size={14} style={{ opacity: 0.7 }} />}
      </button>

      {hasMultipleOptions && isOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(26, 26, 46, 0.12)',
            zIndex: 1000,
            minWidth: '240px',
            padding: '6px 0',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '4px',
            }}
          >
            Select Dataset to Export
          </div>
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsOpen(false);
                opt.onExport();
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '8px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--brand-blue-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                {opt.label}
              </span>
              {opt.description && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {opt.description}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
