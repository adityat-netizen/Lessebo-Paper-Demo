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
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { CsvExportButton, type CsvExportOption } from '../common/CsvExportButton';
import { buildCsvContent, downloadCsvFile } from '../../utils/csvExport';
import { WasteWaterfallChart } from './WasteWaterfallChart';

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

  const {
    netRequirements,
    machineLoading,
    totalProductionTonnageRequired,
    totalGrossTonnageRequired,
    totalLossTonnes,
    totalMachineHoursRequired,
    wasteSummary = [],
  } = planningResult;

  const pm1 = machineLoading.PM1;
  const pm2 = machineLoading.PM2;

  const yieldEfficiencyPct =
    totalGrossTonnageRequired > 0
      ? Math.round((totalProductionTonnageRequired / totalGrossTonnageRequired) * 1000) / 10
      : 100;

  const filteredRequirements = netRequirements.filter((req) => {
    return filterMachine === 'ALL' || req.assigned_machine === filterMachine;
  });

  const exportPlanningOptions: CsvExportOption[] = [
    {
      label: `Gross & Net Production Requirements (${filterMachine})`,
      description: 'Gross requirement, net demand, yield loss allowance, inventory cover, and machine hours',
      onExport: () => {
        const reqData = filteredRequirements.map((req) => ({
          sku_id: req.sku_id,
          brand_line: req.brand_line,
          shade_name: req.shade_name,
          shade_group: req.shade_group,
          grammage_gsm: req.grammage_gsm,
          format_type: req.format_type,
          assigned_machine: req.assigned_machine,
          forecast_demand_tonnes: req.forecastDemandTonnes,
          on_hand_stock_tonnes: req.onHandStockTonnes,
          allocated_stock_tonnes: req.allocatedStockTonnes,
          available_stock_tonnes: req.availableStockTonnes,
          safety_stock_target_tonnes: req.safetyStockTargetTonnes,
          net_production_requirement_tonnes: req.netProductionRequirementTonnes,
          total_loss_tonnes: req.totalLossTonnes ?? 0,
          gross_production_requirement_tonnes: req.grossProductionRequirementTonnes ?? req.netProductionRequirementTonnes,
          required_machine_hours: req.requiredMachineHours,
          web_break_loss_tonnes: req.lossBreakdown?.webBreakTonnes ?? 0,
          trim_loss_tonnes: req.lossBreakdown?.trimLossTonnes ?? 0,
          quality_reject_tonnes: req.lossBreakdown?.qualityRejectTonnes ?? 0,
          converting_loss_tonnes: req.lossBreakdown?.convertingLossTonnes ?? 0,
          lot_rounding_tonnes: req.lossBreakdown?.lotRoundingSurplusTonnes ?? 0,
          inventory_cover_weeks: req.inventoryCoverWeeks ?? 0,
          is_slow_mover: req.isSlowMover ? 'YES (High Cover Alert)' : 'NO',
          status: req.status,
        }));

        const csv = buildCsvContent(
          {
            datasetName: `Gross & Net Production Requirements (${forecastHorizon}M Horizon)`,
            forecastHorizon: `${forecastHorizon} Months`,
            assumptions: {
              SafetyBufferDays: `${safetyBufferDays} days`,
              PM1UnplannedDowntime: `${pm1DowntimeHours} hours`,
              YieldLossAllowance: `+${totalLossTonnes} tonnes`,
              MillFirstPassYield: `${yieldEfficiencyPct}%`,
            },
            filtersApplied: { MachineFilter: filterMachine },
          },
          [
            { key: 'sku_id', label: 'SKU ID' },
            { key: 'brand_line', label: 'Brand Line' },
            { key: 'shade_name', label: 'Shade Name' },
            { key: 'shade_group', label: 'Shade Family' },
            { key: 'grammage_gsm', label: 'Grammage', unit: 'gsm' },
            { key: 'format_type', label: 'Format' },
            { key: 'assigned_machine', label: 'Machine' },
            { key: 'forecast_demand_tonnes', label: 'Gross Forecast Demand', unit: 'tonnes' },
            { key: 'on_hand_stock_tonnes', label: 'On-Hand Stock', unit: 'tonnes' },
            { key: 'allocated_stock_tonnes', label: 'Allocated Stock', unit: 'tonnes' },
            { key: 'available_stock_tonnes', label: 'Available Stock', unit: 'tonnes' },
            { key: 'safety_stock_target_tonnes', label: 'Safety Target', unit: 'tonnes' },
            { key: 'net_production_requirement_tonnes', label: 'Net Demand Need', unit: 'tonnes' },
            { key: 'total_loss_tonnes', label: 'Expected Yield Loss', unit: 'tonnes' },
            { key: 'gross_production_requirement_tonnes', label: 'GROSS Production Req.', unit: 'tonnes' },
            { key: 'required_machine_hours', label: 'Gross Machine Run Time', unit: 'hours' },
            { key: 'web_break_loss_tonnes', label: 'Web-Break Broke', unit: 'tonnes' },
            { key: 'trim_loss_tonnes', label: 'Slitter Trim Loss', unit: 'tonnes' },
            { key: 'quality_reject_tonnes', label: 'Quality Rejects', unit: 'tonnes' },
            { key: 'converting_loss_tonnes', label: 'Converting Loss', unit: 'tonnes' },
            { key: 'lot_rounding_tonnes', label: 'Lot Rounding Surplus', unit: 'tonnes' },
            { key: 'inventory_cover_weeks', label: 'Inventory Cover', unit: 'weeks' },
            { key: 'is_slow_mover', label: 'Slow Mover Flag' },
            { key: 'status', label: 'Planning Status' },
          ],
          reqData
        );

        downloadCsvFile('gross_and_net_production_requirements', `machine_${filterMachine.toLowerCase()}`, csv);
      },
    },
    {
      label: 'Waste & Yield Loss Summary by Component',
      description: 'Itemized component waste tonnes, machine hours lost, and cost valuation',
      onExport: () => {
        const compData = wasteSummary.map((c) => ({
          component_id: c.componentId,
          component_name: c.componentName,
          category: c.category,
          is_sequence_dependent: c.isSequenceDependent ? 'Sequence-Dependent' : 'Non-Sequence',
          is_enabled: c.isEnabled ? 'YES' : 'NO',
          loss_tonnes: c.lossTonnes,
          waste_pct_of_gross: c.wastePercentageOfGross,
          machine_hours_lost: c.machineHoursLost,
          estimated_cost_eur: c.estimatedCostEur,
          client_input_tag: c.clientInputTag,
        }));

        const csv = buildCsvContent(
          {
            datasetName: 'Waste & Yield Loss Summary by Component',
            forecastHorizon: `${forecastHorizon} Months`,
            assumptions: {
              TotalGrossTonnes: `${totalGrossTonnageRequired} tonnes`,
              TotalLossTonnes: `${totalLossTonnes} tonnes`,
            },
          },
          [
            { key: 'component_id', label: 'Component ID' },
            { key: 'component_name', label: 'Loss Component Name' },
            { key: 'category', label: 'Category' },
            { key: 'is_sequence_dependent', label: 'Sequence Nature' },
            { key: 'is_enabled', label: 'Enabled in Model' },
            { key: 'loss_tonnes', label: 'Yield Loss / Broke', unit: 'tonnes' },
            { key: 'waste_pct_of_gross', label: 'Share of Gross', unit: '%' },
            { key: 'machine_hours_lost', label: 'Machine Hours Lost', unit: 'hours' },
            { key: 'estimated_cost_eur', label: 'Estimated Cost Impact', unit: 'EUR' },
            { key: 'client_input_tag', label: 'Client Parameter Tag' },
          ],
          compData
        );

        downloadCsvFile('waste_loss_component_summary', 'all_components', csv);
      },
    },
    {
      label: 'Machine Capacity & Loading Breakdown',
      description: 'Gross hours, planned maintenance, net available capacity, utilization % & bottlenecks',
      onExport: () => {
        const loadingData = (['PM1', 'PM2'] as const).map((mId) => {
          const load = machineLoading[mId];
          return {
            machine_id: load.machineId,
            machine_name: load.machineName,
            nominal_deckle_cm: load.nominalDeckleCm,
            gross_hours: load.grossHours,
            planned_maintenance_hours: load.plannedMaintenanceHours,
            scenario_downtime_hours: load.scenarioDowntimeHours,
            net_available_hours: load.netAvailableHours,
            required_run_hours: load.totalRunHoursRequired,
            required_tonnes: load.totalTonnageRequired,
            utilization_pct: load.utilizationPct,
            headroom_hours: load.headroomHours,
            is_bottleneck: load.isBottleneck ? 'YES (Over capacity)' : 'NO (Feasible)',
            sku_count: load.skusCount,
          };
        });

        const csv = buildCsvContent(
          {
            datasetName: 'Machine Capacity Loading Breakdown',
            forecastHorizon: `${forecastHorizon} Months`,
            assumptions: {
              SafetyBufferDays: `${safetyBufferDays} days`,
              PM1UnplannedDowntime: `${pm1DowntimeHours} hours`,
            },
          },
          [
            { key: 'machine_id', label: 'Machine ID' },
            { key: 'machine_name', label: 'Machine Name' },
            { key: 'nominal_deckle_cm', label: 'Nominal Deckle', unit: 'cm' },
            { key: 'gross_hours', label: 'Gross Operating Window', unit: 'hours' },
            { key: 'planned_maintenance_hours', label: 'Planned Maintenance', unit: 'hours' },
            { key: 'scenario_downtime_hours', label: 'Unplanned Stop Downtime', unit: 'hours' },
            { key: 'net_available_hours', label: 'Net Available Hours', unit: 'hours' },
            { key: 'required_run_hours', label: 'Gross Production Run Time', unit: 'hours' },
            { key: 'required_tonnes', label: 'Gross Production Tonnage', unit: 'tonnes' },
            { key: 'utilization_pct', label: 'Capacity Utilization', unit: '%' },
            { key: 'headroom_hours', label: 'Capacity Headroom (+) / Deficit (-)', unit: 'hours' },
            { key: 'is_bottleneck', label: 'Bottleneck Status' },
            { key: 'sku_count', label: 'Assigned SKUs Count' },
          ],
          loadingData
        );

        downloadCsvFile('machine_capacity_loading', `${forecastHorizon}m`, csv);
      },
    },
  ];

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

          <CsvExportButton label="Export CSV" options={exportPlanningOptions} />
        </div>
      </div>

      {/* KPI Cards Row (6 Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Gross Production Required"
          value={`${totalGrossTonnageRequired.toLocaleString()} t`}
          unit="Loaded Mill Tonnage"
          sublabel={`Includes +${totalLossTonnes.toLocaleString()} t yield & broke allowances`}
          icon={<Factory size={20} />}
          variant="highlight"
        />

        <MetricCard
          label="Net Order Demand"
          value={`${totalProductionTonnageRequired.toLocaleString()} t`}
          unit="Finished Saleable Product"
          sublabel={`Across ${forecastHorizon} months after deducting inventory`}
          icon={<Sliders size={20} />}
        />

        <MetricCard
          label="Mill First-Pass Yield"
          value={`${yieldEfficiencyPct}%`}
          unit={`-${totalLossTonnes.toLocaleString()} t lost`}
          sublabel="Net demand as percentage of gross production requirement"
          variant={yieldEfficiencyPct >= 95 ? 'success' : 'warning'}
          icon={<TrendingUp size={20} />}
        />

        <MetricCard
          label="Gross Machine Hours Required"
          value={`${totalMachineHoursRequired.toLocaleString()} h`}
          unit="Total Mill Run Time"
          sublabel="Recalculated on gross tonnage loaded onto machines"
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

      {/* Yield Loss & Waste Waterfall Section */}
      <WasteWaterfallChart />

      {/* Detailed Gross & Net Requirements MRP Calculation Table */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--navy-dark)', fontWeight: 700, margin: 0 }}>
                Detailed SKU Production Requirements Matrix (Net vs. Gross)
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: 'var(--off-white-bg)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                }}
              >
                Gross loaded on machines
              </span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Shows net demand need alongside required yield loss broke allowances and machine run hours
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
          <table style={{ fontSize: '0.76rem', textAlign: 'left', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--off-white-bg)', borderBottom: '2px solid var(--border-light)' }}>
                <th style={{ padding: '8px 8px' }}>SKU</th>
                <th style={{ padding: '8px 8px' }}>Product Line</th>
                <th style={{ padding: '8px 8px' }}>Shade</th>
                <th style={{ padding: '8px 8px' }}>Grammage</th>
                <th style={{ padding: '8px 8px' }}>Format</th>
                <th style={{ padding: '8px 8px' }}>Machine</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Gross Demand</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Avail. Stock</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Safety Target</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--brand-blue)' }}>Net Need</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: '#D97706' }}>Loss (+t)</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 800, color: 'var(--navy-dark)', background: 'rgba(0, 102, 153, 0.05)' }}>
                  GROSS Req.
                </th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Machine Time</th>
                <th style={{ padding: '8px 8px', textAlign: 'right' }}>Yield %</th>
                <th style={{ padding: '8px 8px', textAlign: 'center' }}>Plan Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequirements.map((req) => {
                const skuYieldPct =
                  (req.grossProductionRequirementTonnes ?? req.netProductionRequirementTonnes) > 0
                    ? Math.round(
                        (req.netProductionRequirementTonnes /
                          (req.grossProductionRequirementTonnes ?? req.netProductionRequirementTonnes)) *
                          1000
                      ) / 10
                    : 100;

                return (
                  <tr
                    key={req.sku_id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontWeight: 600 }}>{req.sku_id}</td>
                    <td style={{ padding: '8px 8px' }}>{req.brand_line}</td>
                    <td style={{ padding: '8px 8px' }}>
                      <ShadeSwatch hex={req.shade_hex} name={req.shade_name} showLabel />
                    </td>
                    <td style={{ padding: '8px 8px' }}>{req.grammage_gsm}g</td>
                    <td style={{ padding: '8px 8px' }}>{req.format_type}</td>
                    <td style={{ padding: '8px 8px' }}>
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
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{req.forecastDemandTonnes} t</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right' }}>{req.availableStockTonnes} t</td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {req.safetyStockTargetTonnes} t
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: 'var(--brand-blue)' }}>
                      {req.netProductionRequirementTonnes} t
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#D97706' }}>
                      +{req.totalLossTonnes ?? 0} t
                    </td>
                    <td
                      style={{
                        padding: '8px 8px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: 'var(--navy-dark)',
                        background: 'rgba(0, 102, 153, 0.05)',
                      }}
                    >
                      {(req.grossProductionRequirementTonnes ?? req.netProductionRequirementTonnes).toLocaleString()} t
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600 }}>
                      {req.requiredMachineHours} h
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {skuYieldPct}%
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.66rem',
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
                        {req.isSlowMover && (
                          <span
                            style={{
                              padding: '1px 4px',
                              borderRadius: '3px',
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              background: 'rgba(217, 119, 6, 0.15)',
                              color: 'var(--warning-amber)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                            title={`Cover is ${req.inventoryCoverWeeks} weeks (threshold exceeded)`}
                          >
                            <AlertTriangle size={10} />
                            Slow: {req.inventoryCoverWeeks}w
                          </span>
                        )}
                      </div>
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
