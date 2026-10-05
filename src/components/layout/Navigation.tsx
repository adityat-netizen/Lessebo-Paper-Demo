import React from 'react';
import { usePlanning, type TabId } from '../../context/PlanningContext';
import { LayoutDashboard, TrendingUp, CalendarDays, Sparkles, SlidersHorizontal } from 'lucide-react';

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab } = usePlanning();

  const tabs: { id: TabId; label: string; icon: React.ReactNode; isHero?: boolean }[] = [
    {
      id: 'executive',
      label: '1. Executive Overview',
      icon: <LayoutDashboard size={16} />,
    },
    {
      id: 'forecast',
      label: '2. Sales Forecast',
      icon: <TrendingUp size={16} />,
    },
    {
      id: 'planning',
      label: '3. Production Planning',
      icon: <CalendarDays size={16} />,
    },
    {
      id: 'sequencing',
      label: '4. Sequence Optimization',
      icon: <Sparkles size={16} />,
      isHero: true,
    },
    {
      id: 'scenarios',
      label: '5. Scenario / What-If Sandbox',
      icon: <SlidersHorizontal size={16} />,
    },
  ];

  return (
    <nav
      style={{
        background: '#FFFFFF',
        borderBottom: '1px solid var(--border-light)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      }}
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          display: 'flex',
          gap: '4px',
          padding: '0 24px',
          overflowX: 'auto',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 18px',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive
                  ? 'var(--brand-blue)'
                  : tab.isHero
                  ? 'var(--navy-dark)'
                  : 'var(--text-secondary)',
                borderBottom: isActive
                  ? '3px solid var(--brand-blue)'
                  : '3px solid transparent',
                background: isActive ? 'var(--brand-blue-light)' : 'transparent',
                borderRadius: '6px 6px 0 0',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  color: isActive
                    ? 'var(--brand-blue)'
                    : tab.isHero
                    ? 'var(--cyan-accent)'
                    : 'inherit',
                }}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.isHero && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #0DBBDF 0%, #005298 100%)',
                    color: '#FFFFFF',
                    marginLeft: '4px',
                  }}
                >
                  Hero Screen
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
