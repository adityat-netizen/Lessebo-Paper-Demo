import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { useWater } from '../../../context/WaterContext';
import { WaterSyntheticLabel } from '../common/WaterSyntheticLabel';
import { ClientInputBadge } from '../../common/ClientInputBadge';
import { Activity, Clock, Sliders, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CsvExportButton } from '../../common/CsvExportButton';
import { buildCsvContent, downloadCsvFile } from '../../../utils/csvExport';
import type { TagId } from '../../../types/water';

export const WaterTelemetryView: React.FC = () => {
  const {
    tags,
    filteredTelemetry,
    selectedTags,
    toggleTag,
    timeRange,
    setTimeRange,
  } = useWater();

  const [activeSubsystem, setActiveSubsystem] = useState<string>('ALL');

  // Subsystem filter options
  const subsystems = [
    'ALL',
    'Equalization & Primary Intake',
    'Chemical Conditioning Loop',
    'Pre-treatment & Filtration',
    'Biological Aeration Loop',
    'Mechanical Pumping Station'
  ];

  // Most recent telemetry reading
  const latestPoint = filteredTelemetry[filteredTelemetry.length - 1];

  // Downsample data if large for smooth Recharts performance (every 2nd or 3rd point if 14d)
  const chartData = React.useMemo(() => {
    const step = timeRange === '14d' ? 3 : timeRange === '7d' ? 2 : 1;
    if (step === 1) return filteredTelemetry;
    return filteredTelemetry.filter((_, idx) => idx % step === 0);
  }, [filteredTelemetry, timeRange]);

  const visibleTags = tags.filter(t => activeSubsystem === 'ALL' || t.subsystem === activeSubsystem);

  // Status helper for tile row
  const getStatus = (tagId: TagId, val: number) => {
    const meta = tags.find(t => t.tagId === tagId);
    if (!meta) return { text: 'Normal', color: '#107C41', bg: '#EBF9F1' };
    if (val < meta.criticalLow || val > meta.criticalHigh) {
      return { text: 'Critical', color: '#DC2626', bg: '#FEE2E2' };
    }
    if (val < meta.warningLow || val > meta.warningHigh) {
      return { text: 'Warning', color: '#D97706', bg: '#FEF3C7' };
    }
    return { text: 'Nominal', color: '#107C41', bg: '#EBF9F1' };
  };

  const exportTelemetryOptions = [
    {
      label: `Export Process Telemetry (${timeRange.toUpperCase()})`,
      description: `Time-series readings for all 10 SCADA tags over the ${timeRange} window`,
      onExport: () => {
        const columns = [
          { key: 'timestamp', label: 'Timestamp (UTC)' },
          ...tags.map((t) => ({
            key: t.tagId,
            label: `${t.tagName} (${t.tagId})`,
            unit: t.unit,
          })),
          { key: 'anomaly_flag', label: 'Ground Truth Anomaly' },
        ];

        const rows = filteredTelemetry.map((pt) => {
          const row: Record<string, string | number> = {
            timestamp: pt.timestamp,
            anomaly_flag: pt.groundTruthAnomalyId || 'None',
          };
          tags.forEach((t) => {
            row[t.tagId] = pt.values[t.tagId];
          });
          return row;
        });

        const csv = buildCsvContent(
          {
            datasetName: `SCADA Water Process Historian Telemetry (${timeRange})`,
            scenarioName: 'Operational Telemetry Stream',
            assumptions: {
              TimeWindow: timeRange,
              DataPoints: filteredTelemetry.length,
              TagMapping: 'Generic SCADA tags (Client input required)',
            },
          },
          columns,
          rows
        );

        downloadCsvFile(`water_telemetry_${timeRange}`, 'scada', csv);
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner: Synthetic Notice & Scope */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--brand-blue-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-blue)',
            }}
          >
            <Activity size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', margin: 0 }}>
                SCADA Water Process &amp; Wastewater Telemetry
              </h2>
              <WaterSyntheticLabel />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Continuous multi-signal historian telemetry across generic mill water recovery, biological clarification &amp; neutralization loops.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CsvExportButton label="Export CSV" options={exportTelemetryOptions} />
          <ClientInputBadge parameterName="SCADA Historian Tag Mapping" tooltip="Real tag names, units, and equipment IDs will be mapped during client discovery" />
        </div>
      </div>

      {/* Live Status Tile Row (4 Primary Key Indicators) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {[
          { tagId: 'FIT_101' as TagId, name: 'Inlet Raw Inflow', icon: Activity },
          { tagId: 'AIT_102' as TagId, name: 'Neutralization pH', icon: Sliders },
          { tagId: 'AIT_103' as TagId, name: 'Effluent Turbidity', icon: AlertTriangle },
          { tagId: 'AIT_202' as TagId, name: 'Aeration Dissolved Oxygen', icon: CheckCircle2 }
        ].map(item => {
          const meta = tags.find(t => t.tagId === item.tagId)!;
          const val = latestPoint ? latestPoint.values[item.tagId] : meta.nominalMin;
          const status = getStatus(item.tagId, val);
          const isSelected = selectedTags.includes(item.tagId);

          return (
            <div
              key={item.tagId}
              onClick={() => toggleTag(item.tagId)}
              style={{
                background: '#FFFFFF',
                border: `1px solid ${isSelected ? meta.color : 'var(--border-light)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                boxShadow: 'var(--shadow-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {meta.tagId} · {item.name}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: status.bg,
                    color: status.color,
                  }}
                >
                  {status.text}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--navy-dark)', fontFamily: 'Arial, sans-serif' }}>
                  {val}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {meta.unit}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>Bands: {meta.nominalMin} – {meta.nominalMax} {meta.unit}</span>
                <span style={{ color: isSelected ? meta.color : 'inherit', fontWeight: isSelected ? 700 : 500 }}>
                  {isSelected ? '● On Chart' : '○ Click to plot'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Chart Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Controls Bar: Subsystem Filter, Time Range, Tag Multi-select */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Subsystem Loop:
            </span>
            <select
              value={activeSubsystem}
              onChange={e => setActiveSubsystem(e.target.value)}
              style={{
                fontSize: '0.8rem',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: '#FFFFFF',
                color: 'var(--navy-dark)',
                outline: 'none',
              }}
            >
              {subsystems.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <span style={{ margin: '0 4px', color: 'var(--border-subtle)' }}>|</span>

            {/* Time range buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={14} color="var(--text-secondary)" />
              {(['24h', '3d', '7d', '14d'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: timeRange === r ? 'var(--brand-blue)' : 'var(--border-subtle)',
                    background: timeRange === r ? 'var(--brand-blue)' : '#FFFFFF',
                    color: timeRange === r ? '#FFFFFF' : 'var(--text-secondary)',
                  }}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sampling: 5-minute resolution ({chartData.length.toLocaleString()} points)
            </span>
          </div>
        </div>

        {/* Tag Selector Pills */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '16px',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>
            Active Signals:
          </span>
          {visibleTags.map(tag => {
            const isSelected = selectedTags.includes(tag.tagId);
            return (
              <button
                key={tag.tagId}
                onClick={() => toggleTag(tag.tagId)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  border: `1px solid ${isSelected ? tag.color : 'var(--border-subtle)'}`,
                  background: isSelected ? `${tag.color}15` : '#FFFFFF',
                  color: isSelected ? tag.color : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isSelected ? tag.color : '#CBD5E1',
                  }}
                />
                <span>{tag.tagId}</span>
                <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>({tag.unit})</span>
              </button>
            );
          })}
        </div>

        {/* Multi-Tag Time-Series LineChart */}
        <div style={{ width: '100%', height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(val: string) => val ? val.slice(5, 16) : ''}
                minTickGap={45}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div
                        style={{
                          background: 'rgba(26, 26, 46, 0.95)',
                          color: '#FFFFFF',
                          padding: '10px 14px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          minWidth: '220px',
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--cyan-accent)' }}>
                          Time: {label}
                        </div>
                        {payload.map((p: any) => {
                          const meta = tags.find(t => t.tagId === p.dataKey);
                          return (
                            <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0' }}>
                              <span style={{ color: p.color, fontWeight: 600 }}>{p.dataKey}:</span>
                              <span>
                                {p.value} {meta?.unit}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: '0.68rem', color: '#94A3B8' }}>
                          Synthetic Telemetry · Client Input Required
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }}
                formatter={(val) => {
                  const meta = tags.find(t => t.tagId === val);
                  return `${val} - ${meta?.tagName} (${meta?.unit})`;
                }}
              />

              {/* Render dynamic threshold lines for the first primary selected tag */}
              {selectedTags.length > 0 && (() => {
                const primaryMeta = tags.find(t => t.tagId === selectedTags[0]);
                if (!primaryMeta) return null;
                return (
                  <>
                    <ReferenceLine
                      y={primaryMeta.warningHigh}
                      stroke={primaryMeta.color}
                      strokeDasharray="4 4"
                      label={{ value: `Upper Threshold (${primaryMeta.warningHigh})`, fill: primaryMeta.color, fontSize: 10, position: 'top' }}
                    />
                    <ReferenceLine
                      y={primaryMeta.warningLow}
                      stroke={primaryMeta.color}
                      strokeDasharray="4 4"
                      label={{ value: `Lower Threshold (${primaryMeta.warningLow})`, fill: primaryMeta.color, fontSize: 10, position: 'bottom' }}
                    />
                  </>
                );
              })()}

              {/* Render lines for selected tags */}
              {selectedTags.map(tagId => {
                const meta = tags.find(t => t.tagId === tagId);
                return (
                  <Line
                    key={tagId}
                    type="monotone"
                    dataKey={`values.${tagId}`}
                    name={tagId}
                    stroke={meta?.color || '#005298'}
                    strokeWidth={1.8}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Engineering Limits & Tag Mapping Table */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1rem', color: 'var(--navy-dark)', margin: 0 }}>
              SCADA Historian Tag Dictionary &amp; Threshold Ranges
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Generic instrument ranges — Permit limits &amp; physical sensor calibrations require mill input.
            </p>
          </div>
          <ClientInputBadge parameterName="Permit Limits & Tag Names" />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--off-white-bg)', borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Tag ID</th>
                <th style={{ padding: '8px 12px' }}>Description</th>
                <th style={{ padding: '8px 12px' }}>Subsystem</th>
                <th style={{ padding: '8px 12px' }}>Nominal Range</th>
                <th style={{ padding: '8px 12px' }}>Warning Limits</th>
                <th style={{ padding: '8px 12px' }}>Critical Limits</th>
                <th style={{ padding: '8px 12px' }}>Lessebo Plant Mapping</th>
              </tr>
            </thead>
            <tbody>
              {tags.map(tag => (
                <tr key={tag.tagId} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: tag.color }}>{tag.tagId}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--navy-dark)' }}>{tag.tagName}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{tag.subsystem}</td>
                  <td style={{ padding: '10px 12px' }}>{tag.nominalMin} – {tag.nominalMax} {tag.unit}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--warning-amber)' }}>{tag.warningLow} / {tag.warningHigh}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--danger-crimson)' }}>{tag.criticalLow} / {tag.criticalHigh}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    <ClientInputBadge parameterName={tag.tagId} />
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
