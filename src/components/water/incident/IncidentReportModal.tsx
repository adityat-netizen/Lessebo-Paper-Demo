import { X, Printer, Download, FileText } from 'lucide-react';
import type { WaterIncident, ScadaTagMetadata } from '../../../types/water';
import { WaterSyntheticLabel } from '../common/WaterSyntheticLabel';
import { ClientInputBadge } from '../../common/ClientInputBadge';

interface Props {
  incident: WaterIncident;
  tags: ScadaTagMetadata[];
  onClose: () => void;
}

export const IncidentReportModal: React.FC<Props> = ({ incident, tags, onClose }) => {
  const topCause = incident.rankedRootCauses[0];
  const primaryMeta = tags.find(t => t.tagId === incident.primaryTag);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const reportText = `
LESSEBO PAPER AB — INDUSTRIAL WATER PROCESS INCIDENT REPORT
============================================================
NOTICE: Illustrative / Synthetic Demonstration — Not actual Lessebo data.
Framework: Tatras Data Industrial Intelligence Decision Support System

INCIDENT IDENTIFIER: ${incident.id}
INCIDENT TITLE:      ${incident.incidentTitle}
DETECTION TIMESTAMP: ${incident.detectionTimestamp} UTC
SEVERITY LEVEL:      ${incident.severity.toUpperCase()}
PRIMARY INSTRUMENT:  ${incident.primaryTag} (${primaryMeta?.tagName})
EVENT WINDOW:        ${incident.eventWindowStart} to ${incident.eventWindowEnd}
CURRENT STATUS:      ${incident.status.toUpperCase()}

1. PRIMARY ROOT CAUSE DIAGNOSIS (LEAD-LAG CORRELATION):
--------------------------------------------------------
Candidate:           ${topCause?.candidateName || 'N/A'}
Confidence Score:    ${topCause?.probabilityScore}% (Computed via cross-correlation)
Initiating Sensor:   ${topCause?.initiatorTag} (Lead time: ${topCause?.leadTimeMinutes} minutes)
Pearson Correlation: r = ${topCause?.pearsonCorrelation}

Supporting Evidence:
${topCause?.supportingEvidence.map(e => ` - ${e}`).join('\n') || 'None'}

2. RECOMMENDED CORRECTIVE SOP ACTION:
--------------------------------------
${topCause?.recommendedSopAction || 'Standard mill inspection procedure.'}

3. COMPLIANCE & DECISION SUPPORT AUDIT LOG:
--------------------------------------------
${incident.auditLog.map(log => `[${log.timestamp}] ${log.actor}: ${log.action} | Status: ${log.status} | Note: ${log.note}`).join('\n')}

============================================================
DISCLAIMER: Decision support advisory for mill engineers. Not automated plant control.
Client Input Required: Mill permit discharge numbers & sensor IDs require site calibration.
`.trim();

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident_report_${incident.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(26, 26, 46, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--navy-dark)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="var(--cyan-accent)" />
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#FFFFFF' }}>
                Compliance-Ready Incident Investigation Report
              </h3>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                Document Ref: {incident.id} · Decision Support Summary
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.1)',
                color: '#FFFFFF',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'var(--brand-blue)',
                color: '#FFFFFF',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <Download size={14} /> Export Text
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px',
                color: '#94A3B8',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top Notice */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--off-white-bg)', padding: '10px 14px', borderRadius: '6px' }}>
            <WaterSyntheticLabel text="Illustrative / Synthetic Data — Not actual Lessebo regulatory filing" />
            <ClientInputBadge parameterName="Permit Thresholds & Official Mill Sign-off" />
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              border: '1px solid var(--border-light)',
              padding: '16px',
              borderRadius: '6px',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem' }}>INCIDENT TITLE</span>
              <strong>{incident.incidentTitle}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem' }}>DETECTION TIME</span>
              <strong>{incident.detectionTimestamp} UTC</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem' }}>EVENT WINDOW</span>
              <strong>{incident.eventWindowStart} – {incident.eventWindowEnd}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem' }}>PRIMARY SENSOR</span>
              <strong>{incident.primaryTag} ({primaryMeta?.tagName})</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem' }}>SEVERITY LEVEL</span>
              <strong style={{ color: incident.severity === 'critical' ? '#DC2626' : '#D97706' }}>
                {incident.severity.toUpperCase()}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem' }}>CURRENT STATUS</span>
              <strong style={{ color: 'var(--brand-blue)' }}>{incident.status}</strong>
            </div>
          </div>

          {/* Diagnosis & Root Cause */}
          <div style={{ border: '1px solid var(--border-light)', padding: '16px', borderRadius: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--navy-dark)', margin: 0 }}>
                1. Statistically Ranked Primary Root Cause
              </h4>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--success-green)' }}>
                {topCause?.probabilityScore}% Confidence Match
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--navy-dark)', fontWeight: 700, margin: '4px 0 8px 0' }}>
              {topCause?.candidateName}
            </p>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              <span>Initiating Tag: <strong>{topCause?.initiatorTag}</strong></span> ·{' '}
              <span>Preceded downstream shift by <strong>{topCause?.leadTimeMinutes} minutes</strong></span> ·{' '}
              <span>Cross-Correlation: <strong>r = {topCause?.pearsonCorrelation}</strong></span>
            </div>

            <div style={{ background: 'var(--off-white-bg)', padding: '10px 12px', borderRadius: '4px', fontSize: '0.78rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Supporting Telemetry Evidence:</span>
              <ul style={{ margin: '6px 0 0 16px', lineHeight: 1.6 }}>
                {topCause?.supportingEvidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Corrective Action */}
          <div style={{ border: '1px solid var(--border-light)', padding: '16px', borderRadius: '6px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--navy-dark)', margin: '0 0 6px 0' }}>
              2. Recommended Standard Operating Procedure (SOP) Action
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
              {topCause?.recommendedSopAction}
            </p>
          </div>

          {/* Audit Log */}
          <div style={{ border: '1px solid var(--border-light)', padding: '16px', borderRadius: '6px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--navy-dark)', margin: '0 0 10px 0' }}>
              3. Shift Turnover &amp; Investigation Audit Trail
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {incident.auditLog.map(entry => (
                <div key={entry.id} style={{ fontSize: '0.78rem', background: 'var(--off-white-bg)', padding: '8px 12px', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                    <strong>{entry.actor}</strong>
                    <span>{entry.timestamp}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 600 }}>{entry.action}: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{entry.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-light)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Tatras Data · Industrial Decision-Support Architecture</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '4px',
              background: 'var(--navy-dark)',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
