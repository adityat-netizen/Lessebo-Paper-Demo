import type {
  TagId,
  TelemetryPoint,
  GroundTruthAnomaly,
  ScadaTagMetadata,
  DetectedAnomaly,
  DetectionMetrics,
} from '../../types/water';

export function runAnomalyDetection(
  telemetry: TelemetryPoint[],
  tags: ScadaTagMetadata[],
  _groundTruth: GroundTruthAnomaly[],
  thresholdZ = 3.0
): {
  detectedAnomalies: DetectedAnomaly[];
  metrics: DetectionMetrics;
  flaggedEpochSet: Set<number>;
} {
  const detectedAnomalies: DetectedAnomaly[] = [];
  const flaggedEpochSet = new Set<number>();

  // Rolling window: 144 samples = 12 hours (at 5-min intervals)
  const windowSize = 144;
  const ewmaAlpha = 0.25;

  // Track running EWMA per tag
  const ewmaValues: Record<TagId, number> = {} as any;
  tags.forEach(t => {
    ewmaValues[t.tagId] = telemetry[0]?.values[t.tagId] || 0;
  });

  for (let i = 0; i < telemetry.length; i++) {
    const pt = telemetry[i];
    let pointFlagged = false;

    // Evaluate each tag
    for (const tag of tags) {
      const tagId = tag.tagId;
      const val = pt.values[tagId];

      // Update EWMA
      const prevEwma = ewmaValues[tagId];
      const newEwma = ewmaAlpha * val + (1 - ewmaAlpha) * prevEwma;
      ewmaValues[tagId] = newEwma;

      // Method 1: Engineering Limit Violations
      if (val < tag.warningLow || val > tag.warningHigh) {
        const isCritical = val < tag.criticalLow || val > tag.criticalHigh;
        const diff = val > tag.warningHigh ? val - tag.warningHigh : tag.warningLow - val;
        const excessPct = Math.round((diff / (tag.nominalMax - tag.nominalMin || 1)) * 100);

        detectedAnomalies.push({
          id: `DET_${pt.timestampEpoch}_${tagId}_ENG`,
          timestamp: pt.timestamp,
          timestampEpoch: pt.timestampEpoch,
          primaryTag: tagId,
          tagValue: val,
          methodFired: 'engineering_threshold',
          severity: isCritical ? 'critical' : 'high',
          deviationScore: excessPct,
          explanation: `Exceeded engineering ${val > tag.warningHigh ? 'High' : 'Low'} threshold (${val} vs limit ${val > tag.warningHigh ? tag.warningHigh : tag.warningLow} ${tag.unit}, +${excessPct}% band excess).`
        });
        pointFlagged = true;
        continue;
      }

      // Need enough window history for statistical baseline
      if (i >= windowSize) {
        // Compute moving mean and stddev over past windowSize points
        let sum = 0;
        for (let j = i - windowSize; j < i; j++) {
          sum += telemetry[j].values[tagId];
        }
        const mean = sum / windowSize;

        let varSum = 0;
        for (let j = i - windowSize; j < i; j++) {
          const diff = telemetry[j].values[tagId] - mean;
          varSum += diff * diff;
        }
        const std = Math.sqrt(varSum / windowSize) || 0.001;
        const zScore = Math.abs(val - mean) / std;

        // Method 2: Rolling Baseline Z-score
        if (zScore >= thresholdZ) {
          detectedAnomalies.push({
            id: `DET_${pt.timestampEpoch}_${tagId}_Z`,
            timestamp: pt.timestamp,
            timestampEpoch: pt.timestampEpoch,
            primaryTag: tagId,
            tagValue: val,
            methodFired: 'rolling_zscore',
            severity: zScore >= 4.0 ? 'critical' : zScore >= 3.2 ? 'high' : 'medium',
            deviationScore: Math.round(zScore * 10) / 10,
            explanation: `Statistical excursion: Z-score is ${zScore.toFixed(1)}σ above 12h moving baseline (mean: ${mean.toFixed(1)}, current: ${val} ${tag.unit}).`
          });
          pointFlagged = true;
          continue;
        }

        // Method 3: EWMA Rate of Change Spike
        const ewmaDiff = Math.abs(val - prevEwma);
        const ewmaZ = ewmaDiff / std;
        if (ewmaZ >= thresholdZ * 1.15) {
          detectedAnomalies.push({
            id: `DET_${pt.timestampEpoch}_${tagId}_EWMA`,
            timestamp: pt.timestamp,
            timestampEpoch: pt.timestampEpoch,
            primaryTag: tagId,
            tagValue: val,
            methodFired: 'ewma_rate_of_change',
            severity: 'medium',
            deviationScore: Math.round(ewmaZ * 10) / 10,
            explanation: `Rapid velocity spike: EWMA delta is ${ewmaZ.toFixed(1)}σ faster than expected process inertia.`
          });
          pointFlagged = true;
          continue;
        }
      }
    }

    // Method 4: Multivariate Divergence Rule
    // Example: High inlet flow (> 210 m3/h) with low dosing rate (< 15 L/h)
    const inlet = pt.values['FIT_101'];
    const dosing = pt.values['FIT_401'];
    if (inlet > 210 && dosing < 15) {
      detectedAnomalies.push({
        id: `DET_${pt.timestampEpoch}_MULTI_1`,
        timestamp: pt.timestamp,
        timestampEpoch: pt.timestampEpoch,
        primaryTag: 'FIT_401',
        tagValue: dosing,
        methodFired: 'multivariate_divergence',
        severity: 'high',
        deviationScore: 3.5,
        explanation: 'Cross-tag contradiction: Influent surge (> 210 m³/h) accompanied by depressed chemical dosing rate (< 15 L/h).'
      });
      pointFlagged = true;
    }

    if (pointFlagged) {
      flaggedEpochSet.add(pt.timestampEpoch);
    }
  }

  // --- Compute Live Detection Metrics Against Ground Truth ---
  // Ground truth spans
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (const pt of telemetry) {
    const isGroundTruth = Boolean(pt.groundTruthAnomalyId);
    const isFlagged = flaggedEpochSet.has(pt.timestampEpoch);

    if (isFlagged && isGroundTruth) {
      truePositives++;
    } else if (isFlagged && !isGroundTruth) {
      falsePositives++;
    } else if (!isFlagged && isGroundTruth) {
      falseNegatives++;
    }
  }

  const precision = truePositives + falsePositives > 0
    ? truePositives / (truePositives + falsePositives)
    : 1;

  const recall = truePositives + falseNegatives > 0
    ? truePositives / (truePositives + falseNegatives)
    : 1;

  const f1Score = precision + recall > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  const metrics: DetectionMetrics = {
    totalPointsEvaluated: telemetry.length,
    totalFlaggedPoints: flaggedEpochSet.size,
    truePositives,
    falsePositives,
    falseNegatives,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    f1Score: Math.round(f1Score * 1000) / 10,
    thresholdZ
  };

  return {
    detectedAnomalies,
    metrics,
    flaggedEpochSet
  };
}
