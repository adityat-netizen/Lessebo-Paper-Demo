import React, { createContext, useContext, useState, useMemo } from 'react';
import type {
  TagId,
  TelemetryPoint,
  ScadaTagMetadata,
  GroundTruthAnomaly,
  DetectedAnomaly,
  DetectionMetrics,
  WaterIncident,
} from '../types/water';
import { generateSyntheticWaterData } from '../engine/water/syntheticWaterGenerator';
import { runAnomalyDetection } from '../engine/water/waterAnomalyDetector';
import { analyzeIncidentRootCause } from '../engine/water/waterRootCauseEngine';

interface WaterContextValue {
  tags: ScadaTagMetadata[];
  telemetry: TelemetryPoint[];
  groundTruth: GroundTruthAnomaly[];
  
  // Detection state
  thresholdZ: number;
  setThresholdZ: (z: number) => void;
  detectedAnomalies: DetectedAnomaly[];
  metrics: DetectionMetrics;
  flaggedEpochSet: Set<number>;
  
  // Incidents & Root Cause state
  incidents: WaterIncident[];
  selectedIncidentId: string;
  setSelectedIncidentId: (id: string) => void;
  selectedIncident: WaterIncident | undefined;
  updateIncidentStatus: (incidentId: string, status: WaterIncident['status'], note: string, actor?: string) => void;
  
  // Chart & View filters
  selectedTags: TagId[];
  toggleTag: (tag: TagId) => void;
  setSelectedTags: (tags: TagId[]) => void;
  timeRange: '24h' | '3d' | '7d' | '14d';
  setTimeRange: (r: '24h' | '3d' | '7d' | '14d') => void;
  filteredTelemetry: TelemetryPoint[];
}

const WaterContext = createContext<WaterContextValue | null>(null);

export const WaterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Generate base synthetic dataset once
  const { telemetry, groundTruth, tags } = useMemo(() => {
    return generateSyntheticWaterData(1693);
  }, []);

  // Sensitivity threshold for detector (2.0 to 4.5 sigma)
  const [thresholdZ, setThresholdZ] = useState<number>(3.0);

  // Time-range filter
  const [timeRange, setTimeRange] = useState<'24h' | '3d' | '7d' | '14d'>('7d');

  // Selected tags for telemetry visualization
  const [selectedTags, setSelectedTags] = useState<TagId[]>([
    'FIT_101',
    'AIT_102',
    'AIT_103',
    'AIT_104'
  ]);

  const toggleTag = (tag: TagId) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        if (prev.length === 1) return prev; // keep at least 1
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  // Filtered telemetry by time range
  const filteredTelemetry = useMemo(() => {
    const totalPoints = telemetry.length;
    let slicePoints = totalPoints;
    if (timeRange === '24h') slicePoints = 288; // 24 * 12
    else if (timeRange === '3d') slicePoints = 864; // 3 * 288
    else if (timeRange === '7d') slicePoints = 2016; // 7 * 288
    else slicePoints = totalPoints;

    return telemetry.slice(totalPoints - slicePoints);
  }, [telemetry, timeRange]);

  // Run anomaly detection live when thresholdZ changes
  const { detectedAnomalies, metrics, flaggedEpochSet } = useMemo(() => {
    return runAnomalyDetection(telemetry, tags, groundTruth, thresholdZ);
  }, [telemetry, tags, groundTruth, thresholdZ]);

  // Initial incidents analyzed via root cause engine
  const initialIncidents = useMemo(() => {
    return groundTruth.map(gt => analyzeIncidentRootCause(gt, telemetry));
  }, [groundTruth, telemetry]);

  const [incidents, setIncidents] = useState<WaterIncident[]>(initialIncidents);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(
    initialIncidents[0]?.id || ''
  );

  const selectedIncident = useMemo(() => {
    return incidents.find(i => i.id === selectedIncidentId);
  }, [incidents, selectedIncidentId]);

  const updateIncidentStatus = (
    incidentId: string,
    status: WaterIncident['status'],
    note: string,
    actor = 'Process Engineer'
  ) => {
    const timestampStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    setIncidents(prev =>
      prev.map(inc => {
        if (inc.id !== incidentId) return inc;
        const newLogEntry = {
          id: `LOG_${Date.now()}`,
          timestamp: timestampStr,
          actor,
          action: `Status changed to "${status}"`,
          status,
          note
        };
        return {
          ...inc,
          status,
          auditLog: [newLogEntry, ...inc.auditLog]
        };
      })
    );
  };

  return (
    <WaterContext.Provider
      value={{
        tags,
        telemetry,
        groundTruth,
        thresholdZ,
        setThresholdZ,
        detectedAnomalies,
        metrics,
        flaggedEpochSet,
        incidents,
        selectedIncidentId,
        setSelectedIncidentId,
        selectedIncident,
        updateIncidentStatus,
        selectedTags,
        toggleTag,
        setSelectedTags,
        timeRange,
        setTimeRange,
        filteredTelemetry
      }}
    >
      {children}
    </WaterContext.Provider>
  );
};

export const useWater = () => {
  const context = useContext(WaterContext);
  if (!context) {
    throw new Error('useWater must be used within a WaterProvider');
  }
  return context;
};
