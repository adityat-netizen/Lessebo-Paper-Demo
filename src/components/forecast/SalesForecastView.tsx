import React, { useState } from 'react';
import { usePlanning } from '../../context/PlanningContext';
import { ShadeSwatch } from '../common/ShadeSwatch';
import { MetricCard } from '../common/MetricCard';
import {
  TrendingUp,
  Calendar,
  Filter,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

export const SalesForecastView: React.FC = () => {
  const {
    products,
    forecastResult,
    forecastHorizon,
    setForecastHorizon,
    demandDeltaPct,
    setDemandDeltaPct,
  } = usePlanning();

  const [selectedShadeFilter, setSelectedShadeFilter] = useState<string>('All');

  const { combinedSeries, seasonalIndices, trendSlopeBeta, trendInterceptAlpha } = forecastResult;

  // Monthly names for seasonal indices
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const seasonalChartData = Object.entries(seasonalIndices).map(([mStr, val]) => {
    const m = parseInt(mStr, 10);
    return {
      monthNum: m,
      monthName: monthNames[m - 1],
      multiplier: val,
      percentDelta: Math.round((val - 1.0) * 100),
    };
  });

  // Filtered products for demand table
  const filteredProducts = products.filter(
    (p) => selectedShadeFilter === 'All' || p.shade_group === selectedShadeFilter
  );

  const totalForecastHorizonTonnes = forecastResult.forecastPoints.reduce(
    (acc, pt) => acc + pt.forecastTonnes,
    0
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Horizon Selector */}
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
            <TrendingUp size={18} color="var(--brand-blue)" />
            <h2 style={{ fontSize: '1.25rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Sales Demand Forecasting Engine
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
              Linear Trend + Calendar-Month Seasonal Multiplier
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Transparent mathematical decomposition based on 38 months of monthly sales history (Jan 2023 – Feb 2026).
          </p>
        </div>

        {/* Horizon and growth controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Forecast Horizon:
            </span>
            <div style={{ display: 'flex', background: 'var(--off-white-bg)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
              {[3, 6, 12].map((m) => (
                <button
                  key={m}
                  onClick={() => setForecastHorizon(m as 3 | 6 | 12)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    background: forecastHorizon === m ? 'var(--brand-blue)' : 'transparent',
                    color: forecastHorizon === m ? '#FFFFFF' : 'var(--text-secondary)',
                  }}
                >
                  {m} Months
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Market Growth Assumption:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="range"
                min="-15"
                max="25"
                step="5"
                value={demandDeltaPct}
                onChange={(e) => setDemandDeltaPct(parseInt(e.target.value, 10))}
                style={{ width: '100px', cursor: 'pointer' }}
              />
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: demandDeltaPct > 0 ? 'var(--brand-blue)' : demandDeltaPct < 0 ? 'var(--danger-crimson)' : 'var(--text-primary)',
                  minWidth: '40px',
                }}
              >
                {demandDeltaPct > 0 ? `+${demandDeltaPct}%` : `${demandDeltaPct}%`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <MetricCard
          label={`Forecast Demand (${forecastHorizon}M Horizon)`}
          value={`${Math.round(totalForecastHorizonTonnes).toLocaleString()} t`}
          unit={`~${Math.round(totalForecastHorizonTonnes / forecastHorizon).toLocaleString()} t/mo`}
          sublabel="Net demand feeding into production planning"
          icon={<Calendar size={20} />}
          variant="highlight"
          badgeText={`Next ${forecastHorizon} Months`}
        />

        <MetricCard
          label="Historical Organic Trend (β)"
          value={`+${trendSlopeBeta} t`}
          unit="per month"
          sublabel="Equivalent to +2.4% annual growth in fine papers"
          icon={<TrendingUp size={20} />}
          badgeText="Closed-Form OLS"
        />

        <MetricCard
          label="Summer Minimum Seasonality"
          value="0.72x"
          unit="July Index"
          sublabel="Nordic annual maintenance & vacation pause"
          variant="warning"
          badgeText="Mill Maintenance Shut"
        />

        <MetricCard
          label="Autumn Peak Seasonality"
          value="1.22x"
          unit="October Index"
          sublabel="Pre-holiday publishing & luxury packaging rush"
          variant="highlight"
          badgeText="Annual Volume Peak"
        />
      </div>

      {/* Main Historical Sales & Forecast Recharts Chart */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              Sales History (38 Months) & Forward Demand Projection ({forecastHorizon} Months)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Historical actuals (solid dark) vs. linear trendline (dashed) and future horizon with confidence bounds (cyan).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '3px', background: 'var(--navy-dark)', display: 'inline-block' }} />
              Historical Actuals
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '2px', background: 'var(--brand-blue)', borderTop: '2px dashed var(--brand-blue)', display: 'inline-block' }} />
              Trendline (L₀={trendInterceptAlpha})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '12px', height: '3px', background: 'var(--cyan-accent)', display: 'inline-block' }} />
              Projected Forecast
            </span>
          </div>
        </div>

        <div style={{ height: '360px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={combinedSeries} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis
                dataKey="monthStr"
                tick={{ fontSize: 11, fill: '#64748B' }}
                interval={3}
                tickLine={false}
              />
              <YAxis
                domain={[2000, 5200]}
                tick={{ fontSize: 11, fill: '#64748B' }}
                unit=" t"
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontSize: '0.78rem',
                }}
                formatter={(val: any, name: any) => {
                  if (name === 'forecastTonnes') return [`${val} tonnes`, 'Demand Forecast'];
                  if (name === 'historicalTonnes') return [`${val} tonnes`, 'Historical Actual'];
                  if (name === 'trendBaselineTonnes') return [`${val} tonnes`, 'Trend Baseline'];
                  return [val, name];
                }}
              />
              {/* Confidence interval area for forward forecast */}
              <Area
                type="monotone"
                dataKey="upperBoundTonnes"
                stroke="none"
                fill="rgba(13, 187, 223, 0.15)"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="lowerBoundTonnes"
                stroke="none"
                fill="#FFFFFF"
                connectNulls
              />

              {/* Historical Actuals */}
              <Line
                type="monotone"
                dataKey="historicalTonnes"
                stroke="var(--navy-dark)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls
              />

              {/* Underlying linear trendline */}
              <Line
                type="linear"
                dataKey="trendBaselineTonnes"
                stroke="var(--brand-blue)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
              />

              {/* Forward Forecast */}
              <Line
                type="monotone"
                dataKey="forecastTonnes"
                stroke="var(--cyan-accent)"
                strokeWidth={3}
                dot={{ r: 4, fill: 'var(--cyan-accent)' }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two-Column Section: Seasonal Multipliers & Explainable Formula */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        {/* Calendar-Month Seasonal Multipliers Bar Chart */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
              12-Month Seasonal Multipliers (Sm)
            </h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              1.00 = Average Month
            </span>
          </div>

          <div style={{ height: '220px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seasonalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <YAxis domain={[0.6, 1.3]} tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val}x (${val > 1 ? '+' : ''}${Math.round((val - 1) * 100)}%)`, 'Seasonal Factor']}
                />
                <Bar dataKey="multiplier" radius={[4, 4, 0, 0]}>
                  {seasonalChartData.map((entry) => (
                    <Cell
                      key={entry.monthNum}
                      fill={
                        entry.monthNum === 7
                          ? 'var(--warning-amber)'
                          : entry.multiplier >= 1.15
                          ? 'var(--cyan-accent)'
                          : 'var(--brand-blue)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: 1.4 }}>
            Reflects real European fine paper dynamics: strong corporate catalog peak in March, planned mill maintenance in July, and autumn book publishing surge in Oct/Nov.
          </p>
        </div>

        {/* Transparent Formula Card */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Info size={18} color="var(--brand-blue)" />
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                Forecasting Transparency & Explainability
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 14px 0' }}>
              Unlike black-box machine learning models, every forecasted tonne can be audited by mill management using a transparent 3-variable formula:
            </p>

            <div
              style={{
                background: 'var(--off-white-bg)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                padding: '12px 16px',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                color: 'var(--navy-dark)',
                marginBottom: '14px',
              }}
            >
              Forecast_Demand = (L₀ + β · t) × S_month × SKU_Share × (1 + Growth_Assumption)
            </div>

            <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '18px', lineHeight: 1.6 }}>
              <li><strong>Baseline Intercept (L₀):</strong> {trendInterceptAlpha} tonnes/month</li>
              <li><strong>Linear Trend Slope (β):</strong> +{trendSlopeBeta} tonnes/month (+2.4% organic p.a.)</li>
              <li><strong>Seasonal Index (S_month):</strong> Between 0.72x (July) and 1.22x (October)</li>
              <li><strong>SKU Product Share:</strong> Calibrated across 32 SKU configurations</li>
            </ul>
          </div>

          <div
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: '#F0FAFD',
              borderRadius: '6px',
              border: '1px solid #BCEBF5',
              fontSize: '0.74rem',
              color: '#005298',
            }}
          >
            <strong>Positioning Note:</strong> Designed for mill managers and production planners who require defensible, auditable sales demand forecasts before committing expensive machine campaigns.
          </div>
        </div>
      </div>

      {/* SKU / Shade Demand Table */}
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
              Forecast Demand by Product & Shade ({forecastHorizon}-Month Horizon)
            </h3>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Breakdown across the 32 SKU catalog feeding into production planning requirements
            </p>
          </div>

          {/* Filter buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Shade:</span>
            {['All', 'Ultra-Light', 'Light', 'Medium', 'Dark'].map((grp) => (
              <button
                key={grp}
                onClick={() => setSelectedShadeFilter(grp)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.74rem',
                  borderRadius: '4px',
                  fontWeight: selectedShadeFilter === grp ? 700 : 500,
                  background: selectedShadeFilter === grp ? 'var(--brand-blue)' : 'var(--off-white-bg)',
                  color: selectedShadeFilter === grp ? '#FFFFFF' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                }}
              >
                {grp}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--off-white-bg)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '10px 12px' }}>SKU Code</th>
                <th style={{ padding: '10px 12px' }}>Product Line</th>
                <th style={{ padding: '10px 12px' }}>Shade & Colour</th>
                <th style={{ padding: '10px 12px' }}>Grammage</th>
                <th style={{ padding: '10px 12px' }}>Format</th>
                <th style={{ padding: '10px 12px' }}>Machine</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Demand Share</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Forecast ({forecastHorizon}M)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Est. Revenue</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                const skuForecastTonnes = Math.round(totalForecastHorizonTonnes * p.demand_share * 10) / 10;
                const skuRevenue = Math.round(skuForecastTonnes * p.price_per_tonne_eur);

                return (
                  <tr
                    key={p.sku_id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {p.sku_id}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.brand_line}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <ShadeSwatch hex={p.shade_hex} name={p.shade_name} showLabel />
                    </td>
                    <td style={{ padding: '10px 12px' }}>{p.grammage_gsm} gsm</td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.format_type} {p.sheet_dimensions ? `(${p.sheet_dimensions})` : ''}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: p.assigned_machine === 'PM1' ? 'var(--brand-blue-light)' : 'rgba(13, 187, 223, 0.15)',
                          color: p.assigned_machine === 'PM1' ? 'var(--brand-blue)' : '#007A94',
                        }}
                      >
                        {p.assigned_machine}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {(p.demand_share * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                      {skuForecastTonnes.toLocaleString()} t
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      €{skuRevenue.toLocaleString()}
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
