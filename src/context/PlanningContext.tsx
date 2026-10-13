import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
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
import type {
  ScenarioDefinition,
  ScenarioParameters,
  ScenarioEvaluation,
} from '../types/scenarioWorkbench';
import {
  BASELINE_PARAMETERS,
  INITIAL_SCENARIOS,
} from '../types/scenarioWorkbench';
import { evaluateScenario } from '../engine/scenarioEvaluator';

import productsRaw from '../data/products.json';
import salesRaw from '../data/sales_orders_monthly.json';
import inventoryRaw from '../data/current_inventory.json';
import machineCapacityRaw from '../data/machine_capacity.json';
import upcomingOrdersRaw from '../data/upcoming_order_book.json';
import conflictOrdersRaw from '../data/conflict_order_book.json';

import { computeForecast, type ForecastCalculationResult } from '../engine/forecastEngine';
import { computeNetRequirements, type PlanningCalculationResult } from '../engine/planningEngine';
import { optimizeSequence } from '../engine/sequenceOptimizer';
import type { LossModelConfig } from '../types/lossModel';
import { DEFAULT_LOSS_MODEL_CONFIG } from '../types/lossModel';

export type TabId =
  | 'executive'
  | 'forecast'
  | 'planning'
  | 'sequencing'
  | 'scenarios'
  | 'water-telemetry'
  | 'water-anomalies'
  | 'water-incidents';

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

  // Scenarios Workbench Management
  scenarios: ScenarioDefinition[];
  activeScenarioId: string;
  setActiveScenarioId: (id: string) => void;
  activeScenario: ScenarioDefinition;
  activeScenarioParams: ScenarioParameters;
  createScenario: (name: string, description?: string, baseParams?: ScenarioParameters) => string;
  duplicateScenario: (scenarioId: string) => string;
  updateScenario: (scenarioId: string, updates: Partial<ScenarioDefinition>) => void;
  updateScenarioParameters: (scenarioId: string, updates: Partial<ScenarioParameters>) => void;
  deleteScenario: (scenarioId: string) => void;
  resetScenarioToBaseline: (scenarioId: string) => void;
  activeScenarioEvaluation: ScenarioEvaluation;
  allScenarioEvaluations: Record<string, ScenarioEvaluation>;
  baselineEvaluation: ScenarioEvaluation;

  // Legacy bindings for seamless screen backwards compatibility
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

  // Waste & Yield Loss Model Config
  lossModelConfig: LossModelConfig;
  setLossModelConfig: (config: LossModelConfig) => void;
  updateLossModelConfig: (updates: Partial<LossModelConfig>) => void;
  resetLossModelConfig: () => void;

  // Computed results
  forecastResult: ForecastCalculationResult;
  planningResult: PlanningCalculationResult;
  optimizationResult: OptimizationComparison;

  // Sequence Scenario & Grammage Conflict State
  sequenceScenarioPreset: 'standard' | 'conflict';
  setSequenceScenarioPreset: (preset: 'standard' | 'conflict') => void;
  grammageDownPenaltyHours: number;
  setGrammageDownPenaltyHours: (hrs: number) => void;
}

const PlanningContext = createContext<PlanningContextValue | null>(null);

export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const products = productsRaw as Product[];
  const salesData = salesRaw as unknown as SalesHistoryData;
  const inventory = inventoryRaw as InventoryItem[];
  const machineCapacity = machineCapacityRaw as MachineCapacity[];
  const upcomingOrders = upcomingOrdersRaw as CampaignOrder[];
  const conflictOrders = conflictOrdersRaw as CampaignOrder[];

  // Sequence Scenario & Grammage Conflict state
  const [sequenceScenarioPreset, setSequenceScenarioPresetState] = useState<'standard' | 'conflict'>('standard');
  const [grammageDownPenaltyHours, setGrammageDownPenaltyHours] = useState<number>(0.0);

  const setSequenceScenarioPreset = (preset: 'standard' | 'conflict') => {
    setSequenceScenarioPresetState(preset);
    if (preset === 'conflict') {
      setGrammageDownPenaltyHours(0.6);
    } else {
      setGrammageDownPenaltyHours(0.0);
    }
  };

  // UI Navigation
  const [activeTab, setActiveTab] = useState<TabId>('executive');
  const [selectedMachine, setSelectedMachine] = useState<MachineId>('PM1');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Forecast state
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6 | 12>(3);

  // Scenarios Workbench State
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(() => {
    try {
      const stored = localStorage.getItem('lessebo_scenarios_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length >= 1) {
          const hasBaseline = parsed.some((s) => s.id === 'baseline');
          if (hasBaseline) return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_SCENARIOS;
  });

  const [activeScenarioId, setActiveScenarioId] = useState<string>('baseline');

  // Persist scenarios to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('lessebo_scenarios_v1', JSON.stringify(scenarios));
    } catch {
      // ignore
    }
  }, [scenarios]);

  // Waste & Yield Loss Model State
  const [lossModelConfig, setLossModelConfig] = useState<LossModelConfig>(() => {
    try {
      const stored = localStorage.getItem('lessebo_loss_model_config_v1');
      if (stored) {
        return { ...DEFAULT_LOSS_MODEL_CONFIG, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_LOSS_MODEL_CONFIG;
  });

  useEffect(() => {
    try {
      localStorage.setItem('lessebo_loss_model_config_v1', JSON.stringify(lossModelConfig));
    } catch {
      // ignore
    }
  }, [lossModelConfig]);

  const updateLossModelConfig = (updates: Partial<LossModelConfig>) => {
    setLossModelConfig((prev) => ({ ...prev, ...updates }));
  };

  const resetLossModelConfig = () => {
    setLossModelConfig(DEFAULT_LOSS_MODEL_CONFIG);
  };

  // Current active scenario object
  const activeScenario = useMemo(() => {
    return scenarios.find((s) => s.id === activeScenarioId) || scenarios[0];
  }, [scenarios, activeScenarioId]);

  const activeScenarioParams = activeScenario.parameters;

  // CRUD Operations
  const createScenario = (
    name: string,
    description: string = 'User customized planning scenario',
    baseParams: ScenarioParameters = BASELINE_PARAMETERS
  ): string => {
    const newId = `scenario_${Date.now()}`;
    const newScenario: ScenarioDefinition = {
      id: newId,
      name: name.trim() || `Custom Scenario ${scenarios.length}`,
      description,
      isLockedBaseline: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parameters: { ...baseParams },
    };
    setScenarios((prev) => [...prev, newScenario]);
    setActiveScenarioId(newId);
    return newId;
  };

  const duplicateScenario = (targetId: string): string => {
    const target = scenarios.find((s) => s.id === targetId) || activeScenario;
    const newId = `scenario_${Date.now()}`;
    const newScenario: ScenarioDefinition = {
      id: newId,
      name: `${target.name} (Copy)`,
      description: `Duplicated from ${target.name}. Fully adjustable parameters.`,
      isLockedBaseline: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parameters: { ...target.parameters },
    };
    setScenarios((prev) => [...prev, newScenario]);
    setActiveScenarioId(newId);
    return newId;
  };

  const updateScenario = (targetId: string, updates: Partial<ScenarioDefinition>) => {
    setScenarios((prev) =>
      prev.map((s) => {
        if (s.id !== targetId) return s;
        if (s.isLockedBaseline && updates.name) return s; // Baseline name locked
        return {
          ...s,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const updateScenarioParameters = (
    targetId: string,
    updates: Partial<ScenarioParameters>
  ) => {
    setScenarios((prev) =>
      prev.map((s) => {
        if (s.id !== targetId) return s;
        if (s.isLockedBaseline) return s; // Locked baseline read-only
        return {
          ...s,
          updatedAt: new Date().toISOString(),
          parameters: {
            ...s.parameters,
            ...updates,
          },
        };
      })
    );
  };

  const deleteScenario = (targetId: string) => {
    const target = scenarios.find((s) => s.id === targetId);
    if (!target || target.isLockedBaseline) return; // Cannot delete locked baseline

    setScenarios((prev) => prev.filter((s) => s.id !== targetId));
    if (activeScenarioId === targetId) {
      setActiveScenarioId('baseline');
    }
  };

  const resetScenarioToBaseline = (targetId: string) => {
    updateScenarioParameters(targetId, { ...BASELINE_PARAMETERS });
  };

  // Memoized Evaluations across all scenarios for side-by-side comparison
  const allScenarioEvaluations = useMemo(() => {
    const evals: Record<string, ScenarioEvaluation> = {};
    scenarios.forEach((s) => {
      evals[s.id] = evaluateScenario(
        s.parameters,
        products,
        inventory,
        machineCapacity,
        upcomingOrders,
        forecastHorizon
      );
    });
    return evals;
  }, [scenarios, products, inventory, machineCapacity, upcomingOrders, forecastHorizon]);

  const activeScenarioEvaluation =
    allScenarioEvaluations[activeScenarioId] || allScenarioEvaluations['baseline'];
  const baselineEvaluation = allScenarioEvaluations['baseline'];

  // Legacy Preset compatibility
  const activePreset: PresetScenarioId =
    activeScenarioId === 'baseline'
      ? 'baseline'
      : activeScenarioId === 'peak_demand'
      ? 'peak_demand'
      : activeScenarioId === 'pm1_maintenance'
      ? 'pm1_breakdown'
      : activeScenarioId === 'vip_luxury_rush'
      ? 'vip_rush'
      : 'baseline';

  const applyPreset = (preset: PresetScenarioId) => {
    const matching = scenarios.find((s) => {
      if (preset === 'baseline') return s.id === 'baseline';
      if (preset === 'peak_demand') return s.id === 'peak_demand';
      if (preset === 'pm1_breakdown') return s.id === 'pm1_maintenance';
      if (preset === 'vip_rush') return s.id === 'vip_luxury_rush';
      return false;
    });
    if (matching) {
      setActiveScenarioId(matching.id);
    }
  };

  const resetAssumptions = () => {
    setActiveScenarioId('baseline');
  };

  // Sync helpers with active scenario
  const demandDeltaPct = activeScenarioParams.demandDeltaPct;
  const pm1DowntimeHours = activeScenarioParams.pm1DowntimeHours;
  const safetyBufferDays = activeScenarioParams.safetyBufferDays;
  const washoutMultiplier = activeScenarioParams.washoutMultiplier;

  const setDemandDeltaPct = (pct: number) => {
    updateScenarioParameters(activeScenarioId, { demandDeltaPct: pct });
  };
  const setPm1DowntimeHours = (hrs: number) => {
    updateScenarioParameters(activeScenarioId, { pm1DowntimeHours: hrs });
  };
  const setSafetyBufferDays = (days: number) => {
    updateScenarioParameters(activeScenarioId, { safetyBufferDays: days });
  };
  const setWashoutMultiplier = (m: number) => {
    updateScenarioParameters(activeScenarioId, { washoutMultiplier: m });
  };

  // Live Memoized Forecast synced with active scenario parameters
  const forecastResult = useMemo(() => {
    const shadeMultiplierWeight =
      activeScenarioParams.whiteDemandMult * 0.5 +
      activeScenarioParams.ivoryDemandMult * 0.25 +
      activeScenarioParams.colorDemandMult * 0.25;

    const effectiveDemandDelta = Math.round(
      ((1 + activeScenarioParams.demandDeltaPct / 100) * shadeMultiplierWeight - 1) * 1000
    ) / 10;

    return computeForecast(
      salesData.monthly_records,
      products,
      forecastHorizon,
      effectiveDemandDelta
    );
  }, [salesData, products, forecastHorizon, activeScenarioParams]);

  // Live Memoized Planning synced with active scenario parameters
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
      activeScenarioParams.safetyBufferDays,
      activeScenarioParams.pm1DowntimeHours,
      activeScenarioParams.pm2DowntimeHours,
      lossModelConfig,
      forecastHorizon
    );
  }, [products, inventory, machineCapacity, forecastResult, activeScenarioParams, lossModelConfig, forecastHorizon]);

  // Live Memoized Sequence Optimization synced with active scenario parameters
  const optimizationResult = useMemo(() => {
    const ordersToSchedule = sequenceScenarioPreset === 'conflict' ? conflictOrders : upcomingOrders;
    const effectiveLossConfig: LossModelConfig = {
      ...lossModelConfig,
      enableGrammageDirectionPenalty: grammageDownPenaltyHours > 0,
      grammageStepDownPenaltyHours: grammageDownPenaltyHours,
      grammageLargeJumpThresholdGsm: 40,
      grammageLargeJumpPenaltyHours: grammageDownPenaltyHours > 0 ? 0.4 : 0.0,
    };

    return optimizeSequence(
      ordersToSchedule,
      selectedMachine,
      activeScenarioParams.washoutMultiplier,
      activeScenarioParams.brokeRateTph,
      effectiveLossConfig
    );
  }, [upcomingOrders, conflictOrders, selectedMachine, activeScenarioParams, lossModelConfig, sequenceScenarioPreset, grammageDownPenaltyHours]);

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

        // Scenarios Workbench
        scenarios,
        activeScenarioId,
        setActiveScenarioId,
        activeScenario,
        activeScenarioParams,
        createScenario,
        duplicateScenario,
        updateScenario,
        updateScenarioParameters,
        deleteScenario,
        resetScenarioToBaseline,
        activeScenarioEvaluation,
        allScenarioEvaluations,
        baselineEvaluation,

        // Backwards compatible bindings
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

        // Waste & Yield Loss Model Config
        lossModelConfig,
        setLossModelConfig,
        updateLossModelConfig,
        resetLossModelConfig,

        // Sequence Scenario & Grammage Conflict State
        sequenceScenarioPreset,
        setSequenceScenarioPreset,
        grammageDownPenaltyHours,
        setGrammageDownPenaltyHours,

        // Synchronized Results
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
