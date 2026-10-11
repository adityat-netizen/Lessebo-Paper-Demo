export type TagId =
  | 'FIT_101'
  | 'FIT_201'
  | 'AIT_102'
  | 'AIT_103'
  | 'AIT_104'
  | 'AIT_105'
  | 'AIT_202'
  | 'LIT_101'
  | 'IIT_301'
  | 'FIT_401';

export interface ScadaTagMetadata {
  tagId: TagId;
  tagName: string;
  subsystem: string;
  unit: string;
  nominalMin: number;
  nominalMax: number;
  warningLow: number;
  warningHigh: number;
  criticalLow: number;
  criticalHigh: number;
  color: string;
  clientInputRequired: boolean;
  millTagMappingPlaceholder: string;
}

export interface TelemetryPoint {
  timestamp: string; // ISO format or YYYY-MM-DD HH:mm
  timestampEpoch: number;
  values: Record<TagId, number>;
  groundTruthAnomalyId?: string; // injected ground truth
}

export type AnomalyType =
  | 'slow_sensor_drift'
  | 'hydraulic_shock_surge'
  | 'pump_impeller_cavitation'
  | 'dosing_line_vapor_lock'
  | 'aeration_oxygen_deficit';

export interface GroundTruthAnomaly {
  id: string;
  type: AnomalyType;
  title: string;
  startEpoch: number;
  endEpoch: number;
  primaryTag: TagId;
  correlatedTags: TagId[];
  description: string;
  expectedSignatures: string[];
}

export type DetectionMethod =
  | 'rolling_zscore'
  | 'ewma_rate_of_change'
  | 'engineering_threshold'
  | 'multivariate_divergence';

export interface DetectedAnomaly {
  id: string;
  timestamp: string;
  timestampEpoch: number;
  primaryTag: TagId;
  tagValue: number;
  methodFired: DetectionMethod;
  severity: 'low' | 'medium' | 'high' | 'critical';
  deviationScore: number; // e.g. Z-score standard deviations or percentage threshold excess
  explanation: string;
  matchedGroundTruthId?: string;
}

export interface DetectionMetrics {
  totalPointsEvaluated: number;
  totalFlaggedPoints: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  thresholdZ: number;
}

export interface RankedRootCause {
  signatureId: string;
  candidateName: string;
  probabilityScore: number; // 0 - 100% computed from data
  initiatorTag: TagId;
  leadTimeMinutes: number;
  pearsonCorrelation: number;
  supportingEvidence: string[];
  recommendedSopAction: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  status: 'Under Investigation' | 'Acknowledged' | 'Mitigation Dispatched' | 'Resolved';
  note: string;
}

export interface WaterIncident {
  id: string;
  groundTruthId: string;
  incidentTitle: string;
  detectionTimestamp: string;
  primaryTag: TagId;
  severity: 'medium' | 'high' | 'critical';
  eventWindowStart: string;
  eventWindowEnd: string;
  status: 'Under Investigation' | 'Acknowledged' | 'Mitigation Dispatched' | 'Resolved';
  rankedRootCauses: RankedRootCause[];
  auditLog: AuditLogEntry[];
}
