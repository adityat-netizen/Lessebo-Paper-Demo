import React from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { HonestyBanner } from '../common/HonestyBanner';
import { Factory, Calendar, Settings2 } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    forecastHorizon,
    setForecastHorizon,
    selectedMachine,
    setSelectedMachine,
    activePreset,
    applyPreset,
  } = usePlanning();

  return (
    <header style={{ background: 'var(--navy-dark)', color: '#FFFFFF', borderBottom: '1px solid #2D3748' }}>
      <HonestyBanner />

      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        {/* Brand & Client Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid rgba(255,255,255,0.2)',
              paddingRight: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: 'var(--cyan-accent)',
                }}
              />
              <span style={{ fontWeight: 800, letterSpacing: '0.08em', fontSize: '0.85rem', color: '#FFFFFF' }}>
                TATRAS DATA
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', color: '#94A3B8', letterSpacing: '0.02em' }}>
              Industrial Intelligence
            </span>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '1.25rem', color: '#FFFFFF', fontWeight: 700, margin: 0 }}>
                Lessebo Paper AB
              </h1>
              <span
                style={{
                  background: 'rgba(13, 187, 223, 0.15)',
                  color: 'var(--cyan-accent)',
                  border: '1px solid rgba(13, 187, 223, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                Mill Planning System
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0 }}>
              Sales Forecasting ➔ Production Planning ➔ Sequence & Washout Optimization
            </p>
          </div>
        </div>

        {/* Global Controls: Machine & Horizon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Machine selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.06)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Factory size={14} color="var(--cyan-accent)" />
            <span style={{ fontSize: '0.75rem', color: '#CBD5E1', marginRight: '4px' }}>Machine:</span>
            <button
              onClick={() => setSelectedMachine('PM1')}
              style={{
                padding: '3px 8px',
                fontSize: '0.75rem',
                borderRadius: '4px',
                fontWeight: 600,
                background: selectedMachine === 'PM1' ? 'var(--brand-blue)' : 'transparent',
                color: selectedMachine === 'PM1' ? '#FFFFFF' : '#94A3B8',
              }}
            >
              PM1 (Graphic)
            </button>
            <button
              onClick={() => setSelectedMachine('PM2')}
              style={{
                padding: '3px 8px',
                fontSize: '0.75rem',
                borderRadius: '4px',
                fontWeight: 600,
                background: selectedMachine === 'PM2' ? 'var(--brand-blue)' : 'transparent',
                color: selectedMachine === 'PM2' ? '#FFFFFF' : '#94A3B8',
              }}
            >
              PM2 (Cover)
            </button>
          </div>

          {/* Forecast Horizon selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.06)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Calendar size={14} color="var(--cyan-accent)" />
            <span style={{ fontSize: '0.75rem', color: '#CBD5E1', marginRight: '4px' }}>Horizon:</span>
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setForecastHorizon(m as 3 | 6 | 12)}
                style={{
                  padding: '3px 8px',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  background: forecastHorizon === m ? 'var(--brand-blue)' : 'transparent',
                  color: forecastHorizon === m ? '#FFFFFF' : '#94A3B8',
                }}
              >
                {m}M
              </button>
            ))}
          </div>

          {/* Preset quick picker */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255,255,255,0.06)',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Settings2 size={14} color="var(--cyan-accent)" />
            <span style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>Mode:</span>
            <select
              value={activePreset}
              onChange={(e) => applyPreset(e.target.value as any)}
              style={{
                background: 'var(--navy-dark)',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                fontSize: '0.75rem',
                padding: '3px 6px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="baseline">Baseline Mill Schedule</option>
              <option value="peak_demand">Q4 Packaging Surge (+20%)</option>
              <option value="pm1_breakdown">PM1 Maintenance Stop (-36h)</option>
              <option value="vip_rush">VIP Rush Campaign (+10% / Washout)</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
