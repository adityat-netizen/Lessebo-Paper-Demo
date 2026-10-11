import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { ClientInputBadge } from '../common/ClientInputBadge';
import {
  Lock,
  Copy,
  Trash2,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
} from 'lucide-react';

export const ScenarioInputControls: React.FC = () => {
  const {
    activeScenario,
    activeScenarioParams,
    updateScenario,
    updateScenarioParameters,
    duplicateScenario,
    deleteScenario,
    resetScenarioToBaseline,
    activeScenarioEvaluation,
  } = usePlanning();

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editedName, setEditedName] = useState(activeScenario.name);
  const [editedDesc, setEditedDesc] = useState(activeScenario.description);

  // Tabbed/Accordion sections to keep layout clean and organized
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    demand: true,
    capacity: true,
    changeover: true,
    costs: true,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isLocked = !!activeScenario.isLockedBaseline;

  const handleSaveMeta = () => {
    if (editedName.trim()) {
      updateScenario(activeScenario.id, {
        name: editedName.trim(),
        description: editedDesc.trim(),
      });
    }
    setIsEditingMeta(false);
  };

  const getFeasibilityBadge = () => {
    const { feasibilityStatus, feasibilityReason } = activeScenarioEvaluation;
    if (feasibilityStatus === 'Infeasible') {
      return (
        <div
          style={{
            background: 'rgba(220, 38, 38, 0.08)',
            border: '1px solid #DC2626',
            borderRadius: '6px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <XCircle size={18} color="#DC2626" />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#DC2626' }}>
              Feasibility: Infeasible (Capacity Deficit)
            </div>
            <div style={{ fontSize: '0.74rem', color: '#7F1D1D' }}>{feasibilityReason}</div>
          </div>
        </div>
      );
    }
    if (feasibilityStatus === 'Capacity-Constrained') {
      return (
        <div
          style={{
            background: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid #D97706',
            borderRadius: '6px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertTriangle size={18} color="#D97706" />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D97706' }}>
              Feasibility: Capacity-Constrained
            </div>
            <div style={{ fontSize: '0.74rem', color: '#92400E' }}>{feasibilityReason}</div>
          </div>
        </div>
      );
    }
    return (
      <div
        style={{
          background: 'rgba(16, 124, 65, 0.08)',
          border: '1px solid #107C41',
          borderRadius: '6px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <CheckCircle2 size={18} color="#107C41" />
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#107C41' }}>
            Feasibility: Feasible
          </div>
          <div style={{ fontSize: '0.74rem', color: '#14532D' }}>{feasibilityReason}</div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header with active scenario name and actions */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-light)',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: '280px' }}>
          {isEditingMeta && !isLocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--brand-blue)',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    flex: 1,
                  }}
                />
                <button
                  onClick={handleSaveMeta}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    background: 'var(--brand-blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.8rem',
                  }}
                >
                  <Check size={14} /> Save
                </button>
              </div>
              <input
                type="text"
                value={editedDesc}
                onChange={(e) => setEditedDesc(e.target.value)}
                placeholder="Scenario description..."
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-light)',
                  fontSize: '0.78rem',
                }}
              />
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 800, margin: 0 }}>
                  {activeScenario.name}
                </h3>
                {isLocked ? (
                  <span
                    style={{
                      background: 'rgba(100, 116, 139, 0.15)',
                      color: '#475569',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Lock size={11} /> Locked Baseline
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setEditedName(activeScenario.name);
                      setEditedDesc(activeScenario.description);
                      setIsEditingMeta(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                    }}
                    title="Rename scenario"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                {activeScenario.description}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => duplicateScenario(activeScenario.id)}
            style={{
              padding: '7px 12px',
              borderRadius: '5px',
              background: '#FFFFFF',
              border: '1px solid var(--border-light)',
              color: 'var(--brand-blue)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Copy size={13} /> Duplicate
          </button>

          {!isLocked && (
            <button
              onClick={() => resetScenarioToBaseline(activeScenario.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '5px',
                background: '#FFFFFF',
                border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Reset parameters to Baseline values"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}

          {!isLocked && (
            <button
              onClick={() => deleteScenario(activeScenario.id)}
              style={{
                padding: '7px 12px',
                borderRadius: '5px',
                background: '#FFFFFF',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                color: '#DC2626',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Baseline Notice Banner */}
      {isLocked && (
        <div
          style={{
            background: '#EFF6FF',
            borderBottom: '1px solid #BFDBFE',
            padding: '10px 24px',
            fontSize: '0.78rem',
            color: '#1E40AF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lock size={14} />
            <span>
              <strong>Baseline Mill Plan is read-only</strong> to preserve the benchmark standard. Click <strong>Duplicate</strong> above to modify assumptions in a cloned sandbox scenario.
            </span>
          </div>
        </div>
      )}

      {/* Main Sliders Grid */}
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Feasibility Indicator */}
        {getFeasibilityBadge()}

        {/* Section 1: Demand & Product Mix Adjustments */}
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('demand')}
            style={{
              padding: '12px 18px',
              background: '#F8FAFC',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} color="var(--brand-blue)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                1. Demand Volume &amp; Product Mix
              </span>
            </div>
            {openSections.demand ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {openSections.demand && (
            <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {/* Global Demand Delta */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Global Demand Scaling
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.demandDeltaPct > 0 ? `+${activeScenarioParams.demandDeltaPct}%` : `${activeScenarioParams.demandDeltaPct}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-30"
                  max="50"
                  step="5"
                  disabled={isLocked}
                  value={activeScenarioParams.demandDeltaPct}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { demandDeltaPct: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Range: -30% (market drop) to +50% (surge)</span>
              </div>

              {/* White Shades Multiplier */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Bright &amp; Natural White Multiplier
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.whiteDemandMult.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  disabled={isLocked}
                  value={activeScenarioParams.whiteDemandMult}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { whiteDemandMult: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>High-volume white commodity publishing paper</span>
              </div>

              {/* Warm Ivory Multiplier */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Warm Ivory / Vanilla Multiplier
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.ivoryDemandMult.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  disabled={isLocked}
                  value={activeScenarioParams.ivoryDemandMult}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { ivoryDemandMult: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Premium book paper &amp; stationery shades</span>
              </div>

              {/* Deep Colors Multiplier */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Chromatic &amp; Charcoal Multiplier
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.colorDemandMult.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  disabled={isLocked}
                  value={activeScenarioParams.colorDemandMult}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { colorDemandMult: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Deep pigments requiring intensive pulper washes</span>
              </div>

              {/* Urgent Order Share */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Urgent / Express Orders Share
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.urgentOrderSharePct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="5"
                  disabled={isLocked}
                  value={activeScenarioParams.urgentOrderSharePct}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { urgentOrderSharePct: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Tighter delivery window constraints</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Machine Capacity & Availability */}
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('capacity')}
            style={{
              padding: '12px 18px',
              background: '#F8FAFC',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} color="var(--brand-blue)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                2. Machine Capacity &amp; Outage Scheduling
              </span>
            </div>
            {openSections.capacity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {openSections.capacity && (
            <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {/* PM1 Downtime */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    PM1 Unplanned Stop / Rebuild
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#DC2626' }}>
                    {activeScenarioParams.pm1DowntimeHours} h
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="6"
                  disabled={isLocked}
                  value={activeScenarioParams.pm1DowntimeHours}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { pm1DowntimeHours: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Downtime subtracted from PM1 monthly capacity</span>
              </div>

              {/* PM2 Downtime */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    PM2 Unplanned Stop / Rebuild
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#DC2626' }}>
                    {activeScenarioParams.pm2DowntimeHours} h
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="6"
                  disabled={isLocked}
                  value={activeScenarioParams.pm2DowntimeHours}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { pm2DowntimeHours: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Downtime subtracted from PM2 monthly capacity</span>
              </div>

              {/* Production Speed Multiplier */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Line Operating Speed Factor
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {Math.round(activeScenarioParams.productionSpeedMultiplier * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.02"
                  disabled={isLocked}
                  value={activeScenarioParams.productionSpeedMultiplier}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { productionSpeedMultiplier: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Line speed throttling or overspeed efficiency</span>
              </div>

              {/* Safety Buffer Days */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Finished Goods Safety Buffer
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.safetyBufferDays} days
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="2"
                  disabled={isLocked}
                  value={activeScenarioParams.safetyBufferDays}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { safetyBufferDays: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Days of forward inventory held in warehouse</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Changeover, Sequencing & Broke Rules */}
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('changeover')}
            style={{
              padding: '12px 18px',
              background: '#F8FAFC',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} color="var(--brand-blue)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                3. Changeover Penalties &amp; Transition Scrap
              </span>
            </div>
            {openSections.changeover ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {openSections.changeover && (
            <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {/* Washout Penalty Multiplier */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                    Pulper Washout Penalty Factor
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    {activeScenarioParams.washoutMultiplier.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  disabled={isLocked}
                  value={activeScenarioParams.washoutMultiplier}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { washoutMultiplier: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Scales dark-to-light chest flush cleaning time</span>
              </div>

              {/* Broke Generation Rate with Client Input Badge */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                      Transition Broke Scrap Rate
                    </label>
                    <ClientInputBadge parameterName="Transition Broke Rate" />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#D97706' }}>
                    {activeScenarioParams.brokeRateTph.toFixed(1)} t/h
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.2"
                  disabled={isLocked}
                  value={activeScenarioParams.brokeRateTph}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { brokeRateTph: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#D97706', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Estimated fiber lost during machine grade change</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Operational Cost Drivers */}
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <div
            onClick={() => toggleSection('costs')}
            style={{
              padding: '12px 18px',
              background: '#F8FAFC',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SlidersHorizontal size={16} color="var(--brand-blue)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy-dark)' }}>
                4. Operational Cost Assumptions (Client Input Required)
              </span>
            </div>
            {openSections.costs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {openSections.costs && (
            <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {/* Machine Hourly Operating Rate */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                      Paper Machine Operating Cost
                    </label>
                    <ClientInputBadge parameterName="Machine Hourly Rate" />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
                    €{activeScenarioParams.hourlyOperatingCostEur} / h
                  </span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="800"
                  step="20"
                  disabled={isLocked}
                  value={activeScenarioParams.hourlyOperatingCostEur}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { hourlyOperatingCostEur: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--brand-blue)', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Power, steam, labor &amp; machine consumables per running hour</span>
              </div>

              {/* Broke Fiber Valuation */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--navy-dark)' }}>
                      Broke Scrap Repulping Cost
                    </label>
                    <ClientInputBadge parameterName="Broke Valuation Rate" />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#D97706' }}>
                    €{activeScenarioParams.brokeCostPerTonneEur} / t
                  </span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="450"
                  step="10"
                  disabled={isLocked}
                  value={activeScenarioParams.brokeCostPerTonneEur}
                  onChange={(e) => updateScenarioParameters(activeScenario.id, { brokeCostPerTonneEur: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#D97706', opacity: isLocked ? 0.6 : 1 }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Pulp fiber degradation, energy &amp; chemicals to re-slush</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
