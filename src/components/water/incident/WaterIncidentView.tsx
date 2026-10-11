import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useWater } from '../../../context/WaterContext';
import { WaterSyntheticLabel } from '../common/WaterSyntheticLabel';
import { ClientInputBadge } from '../../common/ClientInputBadge';
import { IncidentReportModal } from './IncidentReportModal';
import {
  FileSearch,
  Send,
  Printer,
  ListChecks,
} from 'lucide-react';
import { CsvExportButton } from '../../common/CsvExportButton';
import { buildCsvContent, downloadCsvFile } from '../../../utils/csvExport';
import type { WaterIncident } from '../../../types/water';

export const WaterIncidentView: React.FC = () => {
  const {
    tags,
    telemetry,
    incidents,
    setSelectedIncidentId,
    selectedIncident,
    updateIncidentStatus,
  } = useWater();

  const [showReportModal, setShowReportModal] = useState(false);
  const [operatorNote, setOperatorNote] = useState('');
  const [operatorName, setOperatorName] = useState('Process Engineer (Shift A)');
  const [targetStatus, setTargetStatus] = useState<WaterIncident['status']>('Acknowledged');

  // Interactive SOP checklist checkboxes state
  const [checkedSop, setCheckedSop] = useState<Record<string, boolean>>({});

  const activeIncident = selectedIncident || incidents[0];

  // High-res event window slice for the chart
  const incidentChartData = useMemo(() => {
    if (!activeIncident) return [];
    const startEpoch = new Date(activeIncident.eventWindowStart).getTime() - 2 * 3600 * 1000;
    const endEpoch = new Date(activeIncident.eventWindowEnd).getTime() + 2 * 3600 * 1000;

    return telemetry.filter(
      pt => pt.timestampEpoch >= startEpoch && pt.timestampEpoch <= endEpoch
    );
  }, [activeIncident, telemetry]);

  // Tags relevant to this incident
  const incidentTags = useMemo(() => {
    if (!activeIncident) return [];
    const tagsSet = new Set<string>();
    tagsSet.add(activeIncident.primaryTag);
    activeIncident.rankedRootCauses.forEach(r => {
      tagsSet.add(r.initiatorTag);
    });
    return Array.from(tagsSet);
  }, [activeIncident]);

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorNote.trim()) return;
    updateIncidentStatus(
      activeIncident.id,
      targetStatus,
      operatorNote.trim(),
      operatorName
    );
    setOperatorNote('');
  };

  const toggleSopCheck = (key: string) => {
    setCheckedSop(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!activeIncident) return null;

  const exportIncidentOptions = [
    {
      label: 'All Water Incidents Registry',
      description: 'Comprehensive table of all identified water incidents, severities, and top diagnoses',
      onExport: () => {
        const rows = incidents.map((inc) => ({
          incident_id: inc.id,
          title: inc.incidentTitle,
          severity: inc.severity.toUpperCase(),
          status: inc.status,
          detection_timestamp: inc.detectionTimestamp,
          primary_tag: inc.primaryTag,
          top_root_cause: inc.rankedRootCauses[0]?.candidateName || 'N/A',
          confidence_pct: inc.rankedRootCauses[0]?.probabilityScore || 0,
          lead_time_min: inc.rankedRootCauses[0]?.leadTimeMinutes || 0,
          recommended_sop: inc.rankedRootCauses[0]?.recommendedSopAction || 'N/A',
        }));

        const csv = buildCsvContent(
          {
            datasetName: 'Lessebo Water Incidents Registry',
            scenarioName: 'Operational Process Incident Registry',
            assumptions: {
              TotalIncidents: incidents.length,
              ActiveIncident: activeIncident.id,
            },
          },
          [
            { key: 'incident_id', label: 'Incident ID' },
            { key: 'title', label: 'Incident Title' },
            { key: 'severity', label: 'Severity' },
            { key: 'status', label: 'Resolution Status' },
            { key: 'detection_timestamp', label: 'Detection Timestamp (UTC)' },
            { key: 'primary_tag', label: 'Primary Trigger Tag' },
            { key: 'top_root_cause', label: 'Top Ranked Root Cause' },
            { key: 'confidence_pct', label: 'Diagnosis Confidence', unit: '%' },
            { key: 'lead_time_min', label: 'Lead Time Pre-Detection', unit: 'minutes' },
            { key: 'recommended_sop', label: 'Recommended Engineering SOP Action' },
          ],
          rows
        );

        downloadCsvFile('water_incidents_registry', 'incidents', csv);
      },
    },
    {
      label: `Incident Audit Trail (${activeIncident.id})`,
      description: `Chronological engineer shift audit trail and actions taken on ${activeIncident.id}`,
      onExport: () => {
        const rows = activeIncident.auditLog.map((entry) => ({
          entry_id: entry.id,
          timestamp: entry.timestamp,
          actor: entry.actor,
          action: entry.action,
          status: entry.status,
          operator_note: entry.note,
        }));

        const csv = buildCsvContent(
          {
            datasetName: `Water Incident Audit Trail (${activeIncident.id})`,
            scenarioName: activeIncident.incidentTitle,
            assumptions: {
              IncidentID: activeIncident.id,
              CurrentStatus: activeIncident.status,
              PrimaryTag: activeIncident.primaryTag,
            },
          },
          [
            { key: 'entry_id', label: 'Log ID' },
            { key: 'timestamp', label: 'Timestamp (UTC)' },
            { key: 'actor', label: 'Engineer / Operator' },
            { key: 'action', label: 'Action Taken' },
            { key: 'status', label: 'Updated Status' },
            { key: 'operator_note', label: 'Shift Handover Log Note' },
          ],
          rows
        );

        downloadCsvFile(`water_incident_${activeIncident.id.toLowerCase()}_audit`, 'audit', csv);
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
              background: 'var(--cyan-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-accent)',
            }}
          >
            <FileSearch size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', margin: 0 }}>
                Incident Investigation &amp; Explainable Root Cause
              </h2>
              <WaterSyntheticLabel />
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Lead-lag cross-correlation and signature matching for process water events. Designed as decision support for plant engineers.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CsvExportButton label="Export CSV" options={exportIncidentOptions} />
          <button
            onClick={() => setShowReportModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '4px',
              background: 'var(--brand-blue)',
              color: '#FFFFFF',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <Printer size={14} /> Preview Compliance Report
          </button>
        </div>
      </div>

      {/* Incident Selector Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '12px',
        }}
      >
        {incidents.map((inc, idx) => {
          const isSelected = inc.id === activeIncident.id;

          return (
            <div
              key={inc.id}
              onClick={() => setSelectedIncidentId(inc.id)}
              style={{
                background: isSelected ? 'var(--brand-blue-light)' : '#FFFFFF',
                border: `1px solid ${isSelected ? 'var(--brand-blue)' : 'var(--border-light)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: inc.severity === 'critical' ? '#DC2626' : '#D97706',
                    textTransform: 'uppercase',
                  }}
                >
                  Event #{idx + 1} · {inc.severity}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {inc.detectionTimestamp.slice(5, 16)}
                </span>
              </div>

              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy-dark)', marginBottom: '4px' }}>
                {inc.incidentTitle}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span>Primary Tag: <strong>{inc.primaryTag}</strong></span>
                <span style={{ color: 'var(--brand-blue)', fontWeight: 600 }}>{inc.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Incident Details Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '20px',
        }}
      >
        {/* Left Column: Event Replay Chart & Lead-Lag Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  High-Resolution Telemetry Replay (±2 Hours Event Window)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Overlay of correlated instrument signatures during the excursion window.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: activeIncident.severity === 'critical' ? '#FEE2E2' : '#FEF3C7',
                  color: activeIncident.severity === 'critical' ? '#DC2626' : '#D97706',
                }}
              >
                STATUS: {activeIncident.status.toUpperCase()}
              </span>
            </div>

            <div style={{ width: '100%', height: '320px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={incidentChartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    tickFormatter={(val: string) => val ? val.slice(11, 16) : ''}
                    minTickGap={30}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={['auto', 'auto']} />
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
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--cyan-accent)' }}>
                              Time: {label}
                            </div>
                            {payload.map((p: any) => (
                              <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                                <span style={{ color: p.color, fontWeight: 600 }}>{p.name}:</span>
                                <span>{p.value}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '8px' }} />

                  {incidentTags.map(tagId => {
                    const meta = tags.find(t => t.tagId === tagId);
                    const isPrimary = tagId === activeIncident.primaryTag;
                    return (
                      <Line
                        key={tagId}
                        type="monotone"
                        dataKey={`values.${tagId}`}
                        name={`${tagId} (${meta?.unit})`}
                        stroke={meta?.color || '#005298'}
                        strokeWidth={isPrimary ? 2.5 : 1.5}
                        strokeDasharray={isPrimary ? undefined : '4 4'}
                        dot={false}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Ranked Root Causes List */}
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
                  Ranked Probable Root Causes (Data-Driven Correlation)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Mathematical confidence scores derived from lead-lag cross-correlation and signature matching.
                </p>
              </div>
              <ClientInputBadge parameterName="Equipment Fault Signatures" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeIncident.rankedRootCauses.map((cause, rankIdx) => {
                const isTop = rankIdx === 0;
                return (
                  <div
                    key={cause.signatureId}
                    style={{
                      background: isTop ? 'linear-gradient(135deg, #FFFFFF 0%, #F0FAFD 100%)' : 'var(--off-white-bg)',
                      border: `1px solid ${isTop ? 'var(--cyan-accent)' : 'var(--border-light)'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: isTop ? 'var(--brand-blue)' : '#94A3B8',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                          }}
                        >
                          {rankIdx + 1}
                        </span>
                        <strong style={{ fontSize: '0.88rem', color: 'var(--navy-dark)' }}>
                          {cause.candidateName}
                        </strong>
                      </div>

                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: isTop ? 'var(--success-green)' : 'var(--text-secondary)',
                        }}
                      >
                        {cause.probabilityScore}% Match
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '6px 0 8px 30px' }}>
                      <span>Initiator: <strong>{cause.initiatorTag}</strong></span>
                      <span>Lead Time: <strong>{cause.leadTimeMinutes} min</strong></span>
                      <span>Pearson: <strong>r = {cause.pearsonCorrelation}</strong></span>
                    </div>

                    <div style={{ margin: '6px 0 0 30px', fontSize: '0.75rem', color: 'var(--text-primary)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Supporting Telemetry Evidence:</span>
                      <ul style={{ margin: '4px 0 0 16px', lineHeight: 1.5 }}>
                        {cause.supportingEvidence.map((ev, i) => (
                          <li key={i}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Recommended SOP Actions & Operator Audit Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* SOP Checklist */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <ListChecks size={18} color="var(--brand-blue)" />
              <h3 style={{ fontSize: '1rem', color: 'var(--navy-dark)', margin: 0 }}>
                Recommended Operator Actions (SOP)
              </h3>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
              {activeIncident.rankedRootCauses[0]?.recommendedSopAction}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
              {[
                'Verify instrument calibration & sample tap readings manually',
                'Inspect physical valves, pumps or chemical day-tank levels',
                'Check DCS / SCADA redundant instrumentation loop',
                'Notify shift environmental supervisor if excursion persists > 2h'
              ].map((step, idx) => {
                const key = `${activeIncident.id}_${idx}`;
                const checked = Boolean(checkedSop[key]);
                return (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: checked ? '#F0FDF4' : 'var(--off-white-bg)',
                      border: `1px solid ${checked ? '#BBF7D0' : 'var(--border-subtle)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSopCheck(key)}
                      style={{ marginTop: '2px', accentColor: 'var(--brand-blue)' }}
                    />
                    <span style={{ textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--text-muted)' : 'var(--navy-dark)' }}>
                      {step}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Audit Log & Shift Turnover Tracker */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <h3 style={{ fontSize: '1rem', color: 'var(--navy-dark)', margin: '0 0 10px 0' }}>
              Investigation Audit Log &amp; Decision Record
            </h3>

            {/* Shift Note Submission Form */}
            <form onSubmit={handleStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Operator / Engineer Name"
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <select
                  value={targetStatus}
                  onChange={e => setTargetStatus(e.target.value as any)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-subtle)',
                    background: '#FFFFFF',
                  }}
                >
                  <option value="Under Investigation">Under Investigation</option>
                  <option value="Acknowledged">Acknowledged</option>
                  <option value="Mitigation Dispatched">Mitigation Dispatched</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>

              <textarea
                rows={2}
                placeholder="Log physical inspection notes, calibration results, or corrective action..."
                value={operatorNote}
                onChange={e => setOperatorNote(e.target.value)}
                style={{
                  fontSize: '0.78rem',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-subtle)',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />

              <button
                type="submit"
                disabled={!operatorNote.trim()}
                style={{
                  alignSelf: 'flex-end',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '4px',
                  background: operatorNote.trim() ? 'var(--brand-blue)' : '#CBD5E1',
                  color: '#FFFFFF',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: operatorNote.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Send size={12} /> Record Shift Entry
              </button>
            </form>

            {/* Audit Log Entries List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {activeIncident.auditLog.map(entry => (
                <div
                  key={entry.id}
                  style={{
                    background: 'var(--off-white-bg)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                    <strong>{entry.actor}</strong>
                    <span>{entry.timestamp}</span>
                  </div>
                  <div style={{ color: 'var(--brand-blue)', fontWeight: 600, marginBottom: '2px' }}>
                    {entry.action}
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    {entry.note}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Report Modal */}
      {showReportModal && (
        <IncidentReportModal
          incident={activeIncident}
          tags={tags}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
};
