import React, { createContext, useContext, useState, useMemo } from 'react';
import type {
  Product,
  InventoryItem,
  MachineCapacity,
  CampaignOrder,
  MachineId,
  PresetScenarioId,
  OptimizationComparison,
  SalesHistoryData,
} from '../types';

import productsRaw from '../data/products.json';
import salesRaw from '../data/sales_orders_monthly.json';
import inventoryRaw from '../data/current_inventory.json';
import machineCapacityRaw from '../data/machine_capacity.json';
import upcomingOrdersRaw from '../data/upcoming_order_book.json';

import { computeForecast, type ForecastCalculationResult } from '../engine/forecastEngine';
import { computeNetRequirements, type PlanningCalculationResult } from '../engine/planningEngine';
import { optimizeSequence } from '../engine/sequenceOptimizer';

export type TabId = 'executive' | 'forecast' | 'planning' | 'sequencing' | 'scenarios';

interface PlanningContextValue {
  // Data sets
  products: Product[];
  salesData: SalesHistoryData;
  inventory: InventoryItem[];
  machineCapacity: MachineCapacity[];
  upcomingOrders: CampaignOrder[];

  // Navigation state
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // Selected entities for inspection
  selectedMachine: MachineId;
  setSelectedMachine: (m: MachineId) => void;
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;

  // Forecast settings
  forecastHorizon: 3 | 6 | 12;
  setForecastHorizon: (h: 3 | 6 | 12) => void;

  // Scenario settings & sliders
  activePreset: PresetScenarioId;
  applyPreset: (preset: PresetScenarioId) => void;
  demandDeltaPct: number;
  setDemandDeltaPct: (pct: number) => void;
  pm1DowntimeHours: number;
  setPm1DowntimeHours: (hrs: number) => void;
  safetyBufferDays: number;
  setSafetyBufferDays: (days: number) => void;
  washoutMultiplier: number;
  setWashoutMultiplier: (m: number) => void;
  resetAssumptions: () => void;

  // Computed results
  forecastResult: ForecastCalculationResult;
  planningResult: PlanningCalculationResult;
  optimizationResult: OptimizationComparison;
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const products = productsRaw as Product[];
  const salesData = salesRaw as unknown as SalesHistoryData;
  const inventory = inventoryRaw as InventoryItem[];
  const machineCapacity = machineCapacityRaw as MachineCapacity[];
  const upcomingOrders = upcomingOrdersRaw as CampaignOrder[];

  // UI Navigation
  const [activeTab, setActiveTab] = useState<TabId>('executive');
  const [selectedMachine, setSelectedMachine] = useState<MachineId>('PM1');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Forecast state
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6 | 12>(3);

  // Scenario state
  const [activePreset, setActivePreset] = useState<PresetScenarioId>('baseline');
  const [demandDeltaPct, setDemandDeltaPct] = useState<number>(0);
  const [pm1DowntimeHours, setPm1DowntimeHours] = useState<number>(0);
  const [safetyBufferDays, setSafetyBufferDays] = useState<number>(10);
  const [washoutMultiplier, setWashoutMultiplier] = useState<number>(1.0);

  const applyPreset = (preset: PresetScenarioId) => {
    setActivePreset(preset);
    if (preset === 'baseline') {
      setDemandDeltaPct(0);
      setPm1DowntimeHours(0);
      setSafetyBufferDays(10);
      setWashoutMultiplier(1.0);
    } else if (preset === 'peak_demand') {
      setDemandDeltaPct(20);
      setPm1DowntimeHours(0);
      setSafetyBufferDays(14);
      setWashoutMultiplier(1.0);
    } else if (preset === 'pm1_breakdown') {
      setDemandDeltaPct(0);
      setPm1DowntimeHours(36);
      setSafetyBufferDays(10);
      setWashoutMultiplier(1.0);
    } else if (preset === 'vip_rush') {
      setDemandDeltaPct(10);
      setPm1DowntimeHours(12);
      setSafetyBufferDays(12);
      setWashoutMultiplier(1.25);
    }
  };

  const resetAssumptions = () => {
    applyPreset('baseline');
  };

  // Memoized Forecast
  const forecastResult = useMemo(() => {
    return computeForecast(
      salesData.monthly_records,
      products,
      forecastHorizon,
      demandDeltaPct
    );
  }, [salesData, products, forecastHorizon, demandDeltaPct]);

  // Memoized Planning (Net requirements & machine loading)
  const planningResult = useMemo(() => {
    const totalHorizonTonnes = forecastResult.forecastPoints.reduce(
      (sum, p) => sum + p.forecastTonnes,
      0
    );
    return computeNetRequirements(
      products,
      inventory,
      machineCapacity,
      totalHorizonTonnes,
      safetyBufferDays,
      pm1DowntimeHours,
      0
    );
  }, [products, inventory, machineCapacity, forecastResult, safetyBufferDays, pm1DowntimeHours]);

  // Memoized Sequence Optimization
  const optimizationResult = useMemo(() => {
    return optimizeSequence(
      upcomingOrders,
      selectedMachine,
      washoutMultiplier,
      2.4
    );
  }, [upcomingOrders, selectedMachine, washoutMultiplier]);

  return (
    <PlanningContext.Provider
      value={{
        products,
        salesData,
        inventory,
        machineCapacity,
        upcomingOrders,
        activeTab,
        setActiveTab,
        selectedMachine,
        setSelectedMachine,
        selectedRunId,
        setSelectedRunId,
        forecastHorizon,
        setForecastHorizon,
        activePreset,
        applyPreset,
        demandDeltaPct,
        setDemandDeltaPct,
        pm1DowntimeHours,
        setPm1DowntimeHours,
        safetyBufferDays,
        setSafetyBufferDays,
        washoutMultiplier,
        setWashoutMultiplier,
        resetAssumptions,
        forecastResult,
        planningResult,
        optimizationResult,
      }}
    >
      {children}
    </PlanningContext.Provider>
  );
};

export const usePlanning = () => {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error('usePlanning must be used within a PlanningProvider');
  }
  return context;
};
