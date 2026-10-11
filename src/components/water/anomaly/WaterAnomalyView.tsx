import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';
import { useWater } from '../../../context/WaterContext';
import { WaterSyntheticLabel } from '../common/WaterSyntheticLabel';
import { ClientInputBadge } from '../../common/ClientInputBadge';
import { AlertTriangle, SlidersHorizontal } from 'lucide-react';
import { CsvExportButton } from '../../common/CsvExportButton';
import { buildCsvContent, downloadCsvFile } from '../../../utils/csvExport';
import type { TagId } from '../../../types/water';

export const WaterAnomalyView: React.FC = () => {
  const {
    tags,
    filteredTelemetry,
    thresholdZ,
    setThresholdZ,
    detectedAnomalies,
    metrics,
    flaggedEpochSet,
  } = useWater();

  const [inspectTag, setInspectTag] = useState<TagId>('AIT_102');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  const inspectTagMeta = tags.find(t => t.tagId === inspectTag)!;

  // Filter anomalies for table
  const filteredAnomalies = detectedAnomalies.filter(a => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (methodFilter !== 'ALL' && a.methodFired !== methodFilter) return false;
    return true;
  });

  // Downsample telemetry for chart
  const chartData = React.useMemo(() => {
    return filteredTelemetry.filter((_, idx) => idx % 2 === 0);
  }, [filteredTelemetry]);

  // Points on inspectTag that were flagged
  const anomalyDots = chartData.filter(pt => flaggedEpochSet.has(pt.timestampEpoch));

  const exportAnomalyOptions = [
    {
      label: 'Detected Process Anomalies Log',
      description: 'Tabular log of flagged anomalies with deviation scores and explanations',
      onExport: () => {
        const rows = filteredAnomalies.map((a) => {
          const meta = tags.find((t) => t.tagId === a.primaryTag);
          return {
            anomaly_id: a.id,
            timestamp: a.timestamp,
            primary_tag: a.primaryTag,
            tag_name: meta?.tagName || a.primaryTag,
            subsystem: meta?.subsystem || 'Unknown Subsystem',
            tag_value: a.tagValue,
            unit: meta?.unit || '',
            deviation_score: a.deviationScore,
            method_fired: a.methodFired,
            severity: a.severity.toUpperCase(),
            matched_ground_truth: a.matchedGroundTruthId || 'N/A',
            explanation: a.explanation,
          };
        });

        const csv = buildCsvContent(
          {
            datasetName: 'SCADA Water Anomaly Detections Log',
            scenarioName: `Z-Threshold ${thresholdZ}σ Evaluation`,
            assumptions: {
              ThresholdZ: `${thresholdZ} standard deviations`,
              SeverityFilter: severityFilter,
              MethodFilter: methodFilter,
              TotalDetected: detectedAnomalies.length,
            },
          },
          [
            { key: 'anomaly_id', label: 'Anomaly ID' },
            { key: 'timestamp', label: 'Timestamp (UTC)' },
            { key: 'primary_tag', label: 'Tag ID' },
            { key: 'tag_name', label: 'Tag Name' },
            { key: 'subsystem', label: 'Subsystem Loop' },
            { key: 'tag_value', label: 'Observed Value' },
            { key: 'unit', label: 'Unit' },
            { key: 'deviation_score', label: 'Deviation Score' },
            { key: 'method_fired', label: 'Detection Method' },
            { key: 'severity', label: 'Severity Tier' },
            { key: 'matched_ground_truth', label: 'Ground Truth Target' },
            { key: 'explanation', label: 'Diagnostic Explanation' },
          ],
          rows
        );

        downloadCsvFile(`water_anomalies_z${thresholdZ}`, 'detections', csv);
      },
    },
    {
      label: 'Detection Quality & Precision Scorecard',
      description: 'Statistical validation metrics evaluated against ground-truth labels',
      onExport: () => {
        const scorecardRows = [
          { metric: 'Z-Score Sensitivity Threshold', value: thresholdZ, unit: 'sigma' },
          { metric: 'Precision (True Positive Rate in Flagged)', value: metrics.precision, unit: '%' },
          { metric: 'Recall (Coverage of Injected Incidents)', value: metrics.recall, unit: '%' },
          { metric: 'F1 Balanced Harmonic Metric', value: metrics.f1Score, unit: 'score' },
          { metric: 'Total Flagged Anomaly Points', value: metrics.totalFlaggedPoints, unit: 'points' },
          { metric: 'True Positive Matches', value: metrics.truePositives, unit: 'points' },
          { metric: 'False Positive Alarms', value: metrics.falsePositives, unit: 'points' },
          { metric: 'False Negative Missed Events', value: metrics.falseNegatives, unit: 'points' },
          { metric: 'Total Time-Series Points Evaluated', value: metrics.totalPointsEvaluated, unit: 'points' },
        ];

        const csv = buildCsvContent(
          {
            datasetName: 'Water Anomaly Detection Validation Scorecard',
            scenarioName: `Validation at ${thresholdZ}σ`,
          },
          [
            { key: 'metric', label: 'Statistical KPI' },
            { key: 'value', label: 'Calculated Value' },
            { key: 'unit', label: 'Unit' },
          ],
          scorecardRows
        );

        downloadCsvFile(`water_detection_scorecard_z${thresholdZ}`, 'validation', csv);
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
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
              background: 'rgba(217, 119, 6, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--warning-amber)',
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', margin: 0 }}>
                Transparent Anomaly Detection &amp; Validation Quality
              </h2>
              <WaterSyntheticLabel />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Explainable statistical baselines, EWMA velocity checks &amp; cross-tag divergence rules evaluated live against ground-truth labels.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CsvExportButton label="Export CSV" options={exportAnomalyOptions} />
          <ClientInputBadge parameterName="Alarm Sensitivity & Permit Bands" />
        </div>
      </div>

      {/* Detection Quality Scorecards (Live Computed Against Ground Truth) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Precision Rate
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--brand-blue)', margin: '4px 0' }}>
            {metrics.precision}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            True Positives vs Total Flagged
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Recall Rate
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success-green)', margin: '4px 0' }}>
            {metrics.recall}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Ground Truth Events Captured
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            F1-Score
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--navy-dark)', margin: '4px 0' }}>
            {metrics.f1Score}%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Harmonic Mean of Quality
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            True Positives
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success-green)', margin: '4px 0' }}>
            {metrics.truePositives}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Verified Real Fault Points
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            False Alarms
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.falsePositives > 20 ? 'var(--warning-amber)' : 'var(--navy-dark)', margin: '4px 0' }}>
            {metrics.falsePositives}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Operator Distraction Points
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Missed Points
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: metrics.falseNegatives > 10 ? 'var(--danger-crimson)' : 'var(--navy-dark)', margin: '4px 0' }}>
            {metrics.falseNegatives}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            False Negatives
          </div>
        </div>
      </div>

      {/* Sensitivity Tuning Slider Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SlidersHorizontal size={18} color="var(--brand-blue)" />
            <h3 style={{ fontSize: '0.95rem', color: 'var(--navy-dark)', margin: 0 }}>
              Live Detector Sensitivity Control: <strong>{thresholdZ.toFixed(1)}σ (Standard Deviations)</strong>
            </h3>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Interactive: Drag to recompute Precision, Recall and Flagged Counts in real time
          </span>
        </div>

        <input
          type="range"
          min="2.0"
          max="4.5"
          step="0.1"
          value={thresholdZ}
          onChange={e => setThresholdZ(parseFloat(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            background: '#CBD5E1',
            outline: 'none',
            cursor: 'pointer',
            accentColor: 'var(--brand-blue)',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>2.0σ (High Sensitivity / Catches subtle drift / More false alarms)</span>
          <span>3.0σ (Balanced Industrial Setting)</span>
          <span>4.5σ (Low Sensitivity / Only catastrophic outliers)</span>
        </div>
      </div>

      {/* Visual Overlay Chart */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', color: 'var(--navy-dark)', margin: 0 }}>
              Telemetry Anomaly Overlay ({inspectTag}: {inspectTagMeta.tagName})
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Red dot markers denote points where statistical Z-score or EWMA rate thresholds were triggered.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Inspect Tag:
            </span>
            <select
              value={inspectTag}
              onChange={e => setInspectTag(e.target.value as TagId)}
              style={{
                fontSize: '0.8rem',
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border-subtle)',
                background: '#FFFFFF',
                color: 'var(--navy-dark)',
              }}
            >
              {tags.map(t => (
                <option key={t.tagId} value={t.tagId}>
                  {t.tagId} - {t.tagName} ({t.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ width: '100%', height: '360px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(val: string) => val ? val.slice(5, 16) : ''}
                minTickGap={45}
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={['auto', 'auto']} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const isFlagged = flaggedEpochSet.has(payload[0]?.payload?.timestampEpoch);
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
                        }}
                      >
                        <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--cyan-accent)' }}>
                          Time: {label}
                        </div>
                        <div>
                          {inspectTag}: <strong>{payload[0].value} {inspectTagMeta.unit}</strong>
                        </div>
                        {isFlagged && (
                          <div style={{ marginTop: '6px', color: '#EF4444', fontWeight: 700 }}>
                            ⚠️ Flagged by Detector
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />

              <Line
                type="monotone"
                dataKey={`values.${inspectTag}`}
                name={`${inspectTag} (${inspectTagMeta.unit})`}
                stroke={inspectTagMeta.color}
                strokeWidth={1.8}
                dot={false}
              />

              {/* Anomaly markers */}
              {anomalyDots.map(dot => (
                <ReferenceDot
                  key={dot.timestampEpoch}
                  x={dot.timestamp}
                  y={dot.values[inspectTag]}
                  r={4}
                  fill="#DC2626"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flagged Anomaly Event List */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem', color: 'var(--navy-dark)', margin: 0 }}>
              Flagged Anomaly Log ({filteredAnomalies.length} Events at {thresholdZ.toFixed(1)}σ)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Transparent mathematical reasoning and fired rules for each detection event.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Severity:</span>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
            >
              <option value="ALL">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>

            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Method:</span>
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}
            >
              <option value="ALL">All Methods</option>
              <option value="engineering_threshold">Engineering Limits</option>
              <option value="rolling_zscore">Rolling Z-Score</option>
              <option value="ewma_rate_of_change">EWMA Velocity</option>
              <option value="multivariate_divergence">Multi-tag Divergence</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '360px' }}>
          <table style={{ fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--off-white-bg)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px' }}>Timestamp</th>
                <th style={{ padding: '8px 12px' }}>Tag</th>
                <th style={{ padding: '8px 12px' }}>Reading</th>
                <th style={{ padding: '8px 12px' }}>Method Fired</th>
                <th style={{ padding: '8px 12px' }}>Severity</th>
                <th style={{ padding: '8px 12px' }}>Explainable Evidence &amp; Formula Deviation</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.slice(0, 100).map(a => {
                const meta = tags.find(t => t.tagId === a.primaryTag);
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.timestamp}</td>
                    <td style={{ padding: '8px 12px', color: meta?.color, fontWeight: 700 }}>{a.primaryTag}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.tagValue} {meta?.unit}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'var(--brand-blue-light)',
                          color: 'var(--brand-blue)',
                        }}
                      >
                        {a.methodFired.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background:
                            a.severity === 'critical'
                              ? '#FEE2E2'
                              : a.severity === 'high'
                              ? '#FEF3C7'
                              : '#EBF3FA',
                          color:
                            a.severity === 'critical'
                              ? '#DC2626'
                              : a.severity === 'high'
                              ? '#D97706'
                              : 'var(--brand-blue)',
                        }}
                      >
                        {a.severity.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-primary)' }}>
                      {a.explanation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
