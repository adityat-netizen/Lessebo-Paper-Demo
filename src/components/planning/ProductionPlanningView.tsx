import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { MetricCard } from '../common/MetricCard';
import { ShadeSwatch } from '../common/ShadeSwatch';
import { ClientInputBadge } from '../common/ClientInputBadge';
import {
  CalendarDays,
  Factory,
  ArrowRight,
  Sliders,
  Filter,
} from 'lucide-react';

export const ProductionPlanningView: React.FC = () => {
  const {
    planningResult,
    forecastHorizon,
    selectedMachine,
    setSelectedMachine,
    safetyBufferDays,
    setSafetyBufferDays,
    pm1DowntimeHours,
    setPm1DowntimeHours,
    setActiveTab,
  } = usePlanning();

  const [filterMachine, setFilterMachine] = useState<'ALL' | 'PM1' | 'PM2'>('ALL');

  const { netRequirements, machineLoading, totalProductionTonnageRequired, totalMachineHoursRequired } =
    planningResult;

  const pm1 = machineLoading.PM1;
  const pm2 = machineLoading.PM2;

  const filteredRequirements = netRequirements.filter((req) => {
    return filterMachine === 'ALL' || req.assigned_machine === filterMachine;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Title & Assumption Controls */}
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
            <CalendarDays size={18} color="var(--brand-blue)" />
            <h2 style={{ fontSize: '1.25rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Production Requirements & Capacity Planning (MRP)
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
              Gross Demand − Stock + Target Safety Buffer
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Translating the {forecastHorizon}-month sales demand forecast into required mill operating hours across PM1 and PM2.
          </p>
        </div>

        {/* Real-time planning assumption controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={14} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Safety Stock Buffer:
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[7, 10, 14, 21].map((days) => (
                <button
                  key={days}
                  onClick={() => setSafetyBufferDays(days)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    fontWeight: safetyBufferDays === days ? 700 : 500,
                    background: safetyBufferDays === days ? 'var(--brand-blue)' : 'var(--off-white-bg)',
                    color: safetyBufferDays === days ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              PM1 Maint. Stop:
            </span>
            <input
              type="range"
              min="0"
              max="48"
              step="12"
              value={pm1DowntimeHours}
              onChange={(e) => setPm1DowntimeHours(parseInt(e.target.value, 10))}
              style={{ width: '80px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {pm1DowntimeHours}h
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Net Production Required"
          value={`${totalProductionTonnageRequired.toLocaleString()} t`}
          unit="Total Tonnage"
          sublabel={`Across ${forecastHorizon} months after deducting inventory`}
          icon={<Factory size={20} />}
          variant="highlight"
        />

        <MetricCard
          label="Total Machine Hours Required"
          value={`${totalMachineHoursRequired.toLocaleString()} h`}
          unit="Mill Operating Hours"
          sublabel="Net of changeover buffers and run setups"
          icon={<CalendarDays size={20} />}
        />

        <MetricCard
          label="PM1 Machine Loading"
          value={`${pm1.utilizationPct}%`}
          unit={`${pm1.totalRunHoursRequired}h / ${pm1.netAvailableHours}h`}
          sublabel={pm1.isBottleneck ? 'High load: Campaign scheduling critical' : 'Feasible loading with normal headroom'}
          variant={pm1.isBottleneck ? 'warning' : 'success'}
          badgeText="Graphic Mill"
        />

        <MetricCard
          label="PM2 Machine Loading"
          value={`${pm2.utilizationPct}%`}
          unit={`${pm2.totalRunHoursRequired}h / ${pm2.netAvailableHours}h`}
          sublabel="Cover & Heavy Packaging capacity comfortable"
          variant="success"
          badgeText="Cover Mill"
        />
      </div>

      {/* Machine Capacity Visualization Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        {/* PM1 Capacity Details */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: selectedMachine === 'PM1' ? '2px solid var(--brand-blue)' : '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
          onClick={() => setSelectedMachine('PM1')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'var(--brand-blue)',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  PM1
                </span>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                  Paper Machine 1 (Graphic Grades)
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Deckle 260 cm • 80–150 gsm (Lessebo Smooth & 1.3 Rough)
              </p>
            </div>
            <ClientInputBadge parameterName="PM1 Speed & Capacity" />
          </div>

          {/* Progress Bar */}
          <div style={{ margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>Capacity Utilization</span>
              <span style={{ fontWeight: 700, color: pm1.isBottleneck ? 'var(--warning-amber)' : 'var(--brand-blue)' }}>
                {pm1.utilizationPct}% ({pm1.totalRunHoursRequired}h / {pm1.netAvailableHours}h)
              </span>
            </div>
            <div style={{ width: '100%', height: '12px', background: '#E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, pm1.utilizationPct)}%`,
                  height: '100%',
                  background: pm1.isBottleneck ? 'var(--warning-amber)' : 'var(--brand-blue)',
                  borderRadius: '6px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              background: 'var(--off-white-bg)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Required Tonnage</span>
              <strong style={{ fontSize: '0.85rem' }}>{pm1.totalTonnageRequired.toLocaleString()} t</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Headroom Hours</span>
              <strong style={{ fontSize: '0.85rem', color: pm1.headroomHours < 30 ? 'var(--warning-amber)' : 'var(--success-green)' }}>
                {pm1.headroomHours} h
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Maintenance Allowance</span>
              <strong style={{ fontSize: '0.85rem' }}>48h + {pm1.scenarioDowntimeHours}h</strong>
            </div>
          </div>
        </div>

        {/* PM2 Capacity Details */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: selectedMachine === 'PM2' ? '2px solid var(--brand-blue)' : '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
          }}
          onClick={() => setSelectedMachine('PM2')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'var(--cyan-accent)',
                    color: 'var(--navy-dark)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  PM2
                </span>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                  Paper Machine 2 (Cover & Heavy Grades)
                </h3>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Deckle 285 cm • 240–300 gsm (Lessebo Cover & Packaging)
              </p>
            </div>
            <ClientInputBadge parameterName="PM2 Speed & Capacity" />
          </div>

          {/* Progress Bar */}
          <div style={{ margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '6px' }}>
              <span style={{ fontWeight: 600 }}>Capacity Utilization</span>
              <span style={{ fontWeight: 700, color: 'var(--cyan-accent)' }}>
                {pm2.utilizationPct}% ({pm2.totalRunHoursRequired}h / {pm2.netAvailableHours}h)
              </span>
            </div>
            <div style={{ width: '100%', height: '12px', background: '#E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.min(100, pm2.utilizationPct)}%`,
                  height: '100%',
                  background: 'var(--cyan-accent)',
                  borderRadius: '6px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              background: 'var(--off-white-bg)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '0.75rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Required Tonnage</span>
              <strong style={{ fontSize: '0.85rem' }}>{pm2.totalTonnageRequired.toLocaleString()} t</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Headroom Hours</span>
              <strong style={{ fontSize: '0.85rem', color: 'var(--success-green)' }}>
                {pm2.headroomHours} h
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Maintenance Allowance</span>
              <strong style={{ fontSize: '0.85rem' }}>48h</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Net Requirements MRP Calculation Table */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Detailed Net Production Requirements Matrix
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Inventory deduction, safety stock buffer adjustment, and required machine run time
            </p>
          </div>

          {/* Table Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Machine:</span>
              {(['ALL', 'PM1', 'PM2'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setFilterMachine(m)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.72rem',
                    borderRadius: '4px',
                    fontWeight: filterMachine === m ? 700 : 500,
                    background: filterMachine === m ? 'var(--brand-blue)' : 'var(--off-white-bg)',
                    color: filterMachine === m ? '#FFFFFF' : 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveTab('sequencing')}
              style={{
                background: 'var(--brand-blue)',
                color: '#FFFFFF',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Feed into Sequence Optimizer
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: '0.78rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--off-white-bg)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '8px 10px' }}>SKU</th>
                <th style={{ padding: '8px 10px' }}>Product Line</th>
                <th style={{ padding: '8px 10px' }}>Shade</th>
                <th style={{ padding: '8px 10px' }}>Grammage</th>
                <th style={{ padding: '8px 10px' }}>Format</th>
                <th style={{ padding: '8px 10px' }}>Machine</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Gross Demand</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Avail. Stock</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Safety Target</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--brand-blue)' }}>Net Production</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Run Hours</th>
                <th style={{ padding: '8px 10px', textAlign: 'center' }}>Plan Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequirements.map((req) => (
                <tr
                  key={req.sku_id}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{req.sku_id}</td>
                  <td style={{ padding: '8px 10px' }}>{req.brand_line}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <ShadeSwatch hex={req.shade_hex} name={req.shade_name} showLabel />
                  </td>
                  <td style={{ padding: '8px 10px' }}>{req.grammage_gsm}g</td>
                  <td style={{ padding: '8px 10px' }}>{req.format_type}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span
                      style={{
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: req.assigned_machine === 'PM1' ? 'var(--brand-blue-light)' : 'rgba(13, 187, 223, 0.15)',
                        color: req.assigned_machine === 'PM1' ? 'var(--brand-blue)' : '#007A94',
                      }}
                    >
                      {req.assigned_machine}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{req.forecastDemandTonnes} t</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{req.availableStockTonnes} t</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                    {req.safetyStockTargetTonnes} t
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--navy-dark)' }}>
                    {req.netProductionRequirementTonnes} t
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>
                    {req.requiredMachineHours} h
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        background:
                          req.status === 'Production Needed'
                            ? 'var(--brand-blue-light)'
                            : req.status === 'Surplus'
                            ? 'var(--success-bg)'
                            : 'var(--off-white-bg)',
                        color:
                          req.status === 'Production Needed'
                            ? 'var(--brand-blue)'
                            : req.status === 'Surplus'
                            ? 'var(--success-green)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {req.status}
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
