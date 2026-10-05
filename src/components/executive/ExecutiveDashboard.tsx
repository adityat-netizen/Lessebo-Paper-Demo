import React from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { MetricCard } from '../common/MetricCard';
import {
  TrendingUp,
  Clock,
  Trash2,
  Euro,
  ArrowRight,
  Factory,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';

export const ExecutiveDashboard: React.FC = () => {
  const { optimizationResult, setActiveTab, setSelectedMachine } = usePlanning();
  const { savings } = optimizationResult;

  // Annualized extrapolation (assuming ~26 campaign cycles per year)
  const annualizedHours = Math.round(savings.changeoverHoursSaved * 26);
  const annualizedBrokeTonnes = Math.round(savings.brokeTonnesSaved * 26);
  const annualizedSavingsEur = Math.round(savings.financialSavingsEur * 26);

  const pipelineSteps = [
    {
      step: '01',
      title: 'Sales History',
      desc: '38 months of order patterns & seasonality',
      tab: 'forecast' as const,
    },
    {
      step: '02',
      title: 'Demand Forecast',
      desc: 'Transparent trend + calendar seasonal decomposition',
      tab: 'forecast' as const,
    },
    {
      step: '03',
      title: 'Net Requirements',
      desc: 'Gross demand - stock + safety buffer targets',
      tab: 'planning' as const,
    },
    {
      step: '04',
      title: 'Machine Capacity',
      desc: 'PM1 (Graphic) & PM2 (Cover) operating hours',
      tab: 'planning' as const,
    },
    {
      step: '05',
      title: 'Sequence Optimization',
      desc: 'Light-to-dark ladder & grammage step sorting',
      tab: 'sequencing' as const,
      isHero: true,
    },
    {
      step: '06',
      title: 'Business Impact',
      desc: 'Changeover reduction, broke minimization & capacity',
      tab: 'scenarios' as const,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Mill Introduction & Positioning Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1A1A2E 0%, #005298 100%)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          color: '#FFFFFF',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                background: 'rgba(13, 187, 223, 0.2)',
                color: 'var(--cyan-accent)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(13, 187, 223, 0.3)',
              }}
            >
              Executive Summary
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
              Boutique Premium Paper Manufacturing (Lessebo Mill)
            </span>
          </div>
          <h2 style={{ fontSize: '1.85rem', color: '#FFFFFF', fontWeight: 800, marginBottom: '10px' }}>
            Sales Forecasting to Production Sequence Optimization
          </h2>
          <p style={{ fontSize: '0.92rem', color: '#E2E8F0', lineHeight: 1.6, margin: 0 }}>
            Demonstrating how intelligent sales demand forecasting feeds directly into mill production planning and sequence scheduling. By eliminating random dark-to-light washouts, grouping grammages, and preserving customer SLAs, Lessebo unlocks hidden capacity and sharply reduces broke fiber waste.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('sequencing')}
          style={{
            background: 'var(--cyan-accent)',
            color: 'var(--navy-dark)',
            padding: '14px 24px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(13, 187, 223, 0.35)',
          }}
        >
          <Sparkles size={18} />
          Explore Hero Screen (Sequencing)
          <ArrowRight size={16} />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        <MetricCard
          label="Annual Mill Revenue (Synthetic)"
          value="€85.1M"
          unit="EUR / Year"
          sublabel="~44,050 tonnes sold across 32 boutique SKUs"
          icon={<Euro size={20} />}
          badgeText="Illustrative Baseline"
        />

        <MetricCard
          label="Changeover Hours Saved"
          value={`-${savings.changeoverHoursSaved}`}
          unit="Hours / Campaign"
          sublabel={`Annualized: ~${annualizedHours.toLocaleString()} h freed`}
          icon={<Clock size={20} />}
          variant="highlight"
          badgeText="Per Campaign Run"
        />

        <MetricCard
          label="Broke / Scrap Reduced"
          value={`-${savings.brokeTonnesSaved}`}
          unit="Tonnes / Campaign"
          sublabel={`Annualized: ~${annualizedBrokeTonnes.toLocaleString()} t saved`}
          icon={<Trash2 size={20} />}
          variant="success"
          badgeText="Repulping & Energy Saved"
          clientInputRequired
        />

        <MetricCard
          label="Washouts Avoided"
          value={savings.washoutsAvoided}
          unit="Deep Washes"
          sublabel="Eliminated 3.5h boiling pulper cleans"
          icon={<Sparkles size={20} />}
          variant="highlight"
          badgeText="Colour Ladder Effect"
        />

        <MetricCard
          label="Financial Capacity Value"
          value={`€${savings.financialSavingsEur.toLocaleString()}`}
          unit="Per Campaign"
          sublabel={`Annualized: ~€${annualizedSavingsEur.toLocaleString()}`}
          icon={<TrendingUp size={20} />}
          variant="success"
          badgeText="Illustrative Benefit"
          clientInputRequired
        />
      </div>

      {/* End-to-End Operational Pipeline Diagram */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              End-to-End Decision Support Workflow
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Click any workflow step to drill into the operational calculations
            </p>
          </div>
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--brand-blue)',
              background: 'var(--brand-blue-light)',
              padding: '4px 10px',
              borderRadius: '4px',
              fontWeight: 600,
            }}
          >
            Closed-Loop Planning Architecture
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            position: 'relative',
          }}
        >
          {pipelineSteps.map((item) => (
            <div
              key={item.step}
              onClick={() => setActiveTab(item.tab)}
              style={{
                background: item.isHero
                  ? 'linear-gradient(135deg, #F0FAFD 0%, #FFFFFF 100%)'
                  : 'var(--off-white-bg)',
                border: item.isHero
                  ? '2px solid var(--cyan-accent)'
                  : '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: item.isHero ? 'var(--cyan-accent)' : 'var(--text-muted)',
                  }}
                >
                  STEP {item.step}
                </span>
                {item.isHero && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      background: 'var(--cyan-accent)',
                      color: 'var(--navy-dark)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Hero
                  </span>
                )}
                <ChevronRight size={14} color="var(--text-muted)" />
              </div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--navy-dark)', fontWeight: 700, marginBottom: '6px' }}>
                {item.title}
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column Section: Operational Mechanisms & Value Bridge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        {/* Core Operational Mechanisms */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Layers size={18} color="var(--brand-blue)" />
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              The 3 Drivers of Changeover & Waste Reduction
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                borderLeft: '4px solid #0DBBDF',
                paddingLeft: '14px',
                background: '#F8FCFD',
                padding: '12px 14px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--navy-dark)' }}>
                  1. Light-to-Dark Colour Ladder (58% of Savings)
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--brand-blue)', fontWeight: 700 }}>
                  ~3.5h Saved / Washout
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Moving from Ultra-Light (Bright White) to Light (Ivory) to Dark (Forest Green/Charcoal) requires only baseline mechanical calibration (0.5h). Moving dark-to-light forces an emergency 3.5h pulper chemical flush and felt wash.
              </p>
            </div>

            <div
              style={{
                borderLeft: '4px solid #005298',
                paddingLeft: '14px',
                background: '#F5F8FC',
                padding: '12px 14px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--navy-dark)' }}>
                  2. Grammage Step Smoothing (24% of Savings)
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--brand-blue)', fontWeight: 700 }}>
                  ~0.7h Saved / Run
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Sorting consecutive runs in small ascending steps (e.g. 80g ➔ 100g ➔ 120g) allows headbox slice lips and press roll vacuum to adjust progressively without breaking sheet tension or creating off-spec paper.
              </p>
            </div>

            <div
              style={{
                borderLeft: '4px solid #107C41',
                paddingLeft: '14px',
                background: '#F4FAF6',
                padding: '12px 14px',
                borderRadius: '0 6px 6px 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.85rem', color: 'var(--navy-dark)' }}>
                  3. Format & Deckle Grouping (18% of Savings)
                </strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--brand-blue)', fontWeight: 700 }}>
                  ~0.75h Saved / Deckle
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                Batching identical sheet formats (e.g., 700x1000 mm) eliminates mechanical slitter blade adjustments and preserves continuous reel turn-up speed on the paper machine dry-end.
              </p>
            </div>
          </div>
        </div>

        {/* Machine Capacity Allocation Quick Overview */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Factory size={18} color="var(--brand-blue)" />
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                Machine Fleet Allocation
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* PM1 Card */}
              <div
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  background: 'var(--off-white-bg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy-dark)' }}>
                    PM1 — Graphic & Specialty Papers
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
                    80 - 150 gsm
                  </span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                  25 SKUs • High colour variety • Deckle 260 cm • Net operating capacity 672 h/mo
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '84.2%', height: '100%', background: 'var(--brand-blue)', borderRadius: '4px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-dark)' }}>84.2%</span>
                </div>
              </div>

              {/* PM2 Card */}
              <div
                style={{
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  background: 'var(--off-white-bg)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--navy-dark)' }}>
                    PM2 — Cover & Heavy Packaging Papers
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
                    240 - 300 gsm
                  </span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                  7 SKUs • Luxury packaging & covers • Deckle 285 cm • Net operating capacity 672 h/mo
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '79.5%', height: '100%', background: 'var(--cyan-accent)', borderRadius: '4px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--navy-dark)' }}>79.5%</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={() => {
                setSelectedMachine('PM1');
                setActiveTab('planning');
              }}
              style={{
                fontSize: '0.82rem',
                color: 'var(--brand-blue)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View Detailed Machine Loading
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
