import type {
  TagId,
  ScadaTagMetadata,
  TelemetryPoint,
  GroundTruthAnomaly,
} from '../../types/water';
import rawConfig from '../../data/water/waterConfig.json';

// Mulberry32 32-bit deterministic PRNG
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticWaterData(seed = 1693) {
  const prng = createPrng(seed);
  const tags = rawConfig as ScadaTagMetadata[];

  // 14 days, 5-minute sampling: 14 * 24 * 12 = 4,032 points
  const pointsCount = 4032;
  const startEpoch = new Date('2026-03-01T00:00:00Z').getTime();
  const stepMs = 5 * 60 * 1000;

  // Ground truth anomalies
  const groundTruth: GroundTruthAnomaly[] = [
    {
      id: 'GT_INC_01',
      type: 'slow_sensor_drift',
      title: 'Chemical Loop: pH Electrode Scaling & Slow Drift',
      startEpoch: startEpoch + (2 * 24 + 10) * 3600 * 1000, // Day 3, 10:00
      endEpoch: startEpoch + (2 * 24 + 16) * 3600 * 1000,   // Day 3, 16:00 (6h)
      primaryTag: 'AIT_102',
      correlatedTags: ['FIT_401'],
      description: 'Slow acidic drift on neutralization pH sensor down to 6.2 with hunting dosing pump overshoot.',
      expectedSignatures: ['SIG_SENSOR_DRIFT']
    },
    {
      id: 'GT_INC_02',
      type: 'hydraulic_shock_surge',
      title: 'Intake: Upstream Hydraulic Shock Load & Clarifier Washout',
      startEpoch: startEpoch + (5 * 24 + 13) * 3600 * 1000, // Day 6, 13:00
      endEpoch: startEpoch + (5 * 24 + 17) * 3600 * 1000,   // Day 6, 17:00 (4h)
      primaryTag: 'FIT_101',
      correlatedTags: ['LIT_101', 'AIT_103', 'AIT_105'],
      description: 'Massive influent surge exceeding equalization basin hydraulic capacity, carrying solids over clarifier weirs.',
      expectedSignatures: ['SIG_HYDRAULIC_SURGE']
    },
    {
      id: 'GT_INC_03',
      type: 'pump_impeller_cavitation',
      title: 'Pumping: Recirculation Pump Impeller Cavitation & Flow Loss',
      startEpoch: startEpoch + (8 * 24 + 8) * 3600 * 1000,  // Day 9, 08:00
      endEpoch: startEpoch + (8 * 24 + 12) * 3600 * 1000,   // Day 9, 12:00 (4h)
      primaryTag: 'IIT_301',
      correlatedTags: ['FIT_101', 'LIT_101'],
      description: 'Severe electrical current oscillations with simultaneous recirculation line flow throttling.',
      expectedSignatures: ['SIG_PUMP_CAVITATION']
    },
    {
      id: 'GT_INC_04',
      type: 'dosing_line_vapor_lock',
      title: 'Conditioning: Dosing Manifold Vapor Lock & COD Breakthrough',
      startEpoch: startEpoch + (10 * 24 + 18) * 3600 * 1000, // Day 11, 18:00
      endEpoch: startEpoch + (10 * 24 + 22) * 3600 * 1000,  // Day 11, 22:00 (4h)
      primaryTag: 'FIT_401',
      correlatedTags: ['AIT_102', 'AIT_104'],
      description: 'Metering pump vapor lock causes sudden chemical starved condition, triggering organic COD rise.',
      expectedSignatures: ['SIG_DOSING_VAPOR_LOCK']
    },
    {
      id: 'GT_INC_05',
      type: 'aeration_oxygen_deficit',
      title: 'Biological Loop: Aeration Basin Oxygen Transfer Sag',
      startEpoch: startEpoch + (12 * 24 + 10) * 3600 * 1000, // Day 13, 10:00
      endEpoch: startEpoch + (12 * 24 + 15) * 3600 * 1000,  // Day 13, 15:00 (5h)
      primaryTag: 'AIT_202',
      correlatedTags: ['AIT_104'],
      description: 'Aeration blower header pressure drop starves biological respiration, driving effluent COD up.',
      expectedSignatures: ['SIG_AERATION_DEFICIT']
    }
  ];

  const telemetry: TelemetryPoint[] = [];

  for (let i = 0; i < pointsCount; i++) {
    const epoch = startEpoch + i * stepMs;
    const dateObj = new Date(epoch);
    const timeStr = dateObj.toISOString().replace('T', ' ').slice(0, 16);

    // Diurnal cycle: 24h period (sinusoidal)
    const hourOfDay = dateObj.getUTCHours() + dateObj.getUTCMinutes() / 60;
    const dayPhase = (hourOfDay / 24) * 2 * Math.PI;
    const diurnal = Math.sin(dayPhase - Math.PI / 2); // low at night, peak midday

    // Weekly cycle: weekends have ~12% lower baseline load
    const dayOfWeek = dateObj.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weeklyFactor = isWeekend ? 0.90 : 1.0;

    // Check if within any ground truth event
    const activeGt = groundTruth.find(gt => epoch >= gt.startEpoch && epoch <= gt.endEpoch);

    // Compute base values for all 10 tags
    const values: Record<TagId, number> = {
      FIT_101: 0,
      FIT_201: 0,
      AIT_102: 0,
      AIT_103: 0,
      AIT_104: 0,
      AIT_105: 0,
      AIT_202: 0,
      LIT_101: 0,
      IIT_301: 0,
      FIT_401: 0
    };

    // 1. FIT_101: Inlet Flow (160 - 195 m³/h)
    const fit101Base = (175 + 12 * diurnal + (prng() - 0.5) * 5) * weeklyFactor;
    values.FIT_101 = fit101Base;

    // 2. FIT_201: Effluent Flow (lagged by ~30 min from inlet)
    const fit201Base = (168 + 10 * diurnal + (prng() - 0.5) * 4) * weeklyFactor;
    values.FIT_201 = fit201Base;

    // 3. AIT_102: Neutralization pH (7.0 - 7.4)
    values.AIT_102 = 7.22 + 0.12 * diurnal + (prng() - 0.5) * 0.08;

    // 4. AIT_103: Turbidity (0.6 - 1.1 NTU)
    values.AIT_103 = 0.85 + 0.18 * diurnal + (prng() - 0.5) * 0.12;

    // 5. AIT_104: COD Proxy (130 - 155 mg/L)
    values.AIT_104 = 142 + 15 * diurnal + (prng() - 0.5) * 6;

    // 6. AIT_105: TSS Proxy (30 - 42 mg/L)
    values.AIT_105 = 34 + 6 * diurnal + (prng() - 0.5) * 4;

    // 7. AIT_202: Dissolved Oxygen (2.4 - 3.0 mg/L)
    values.AIT_202 = 2.65 - 0.25 * diurnal + (prng() - 0.5) * 0.15; // lower at high organic daytime

    // 8. LIT_101: Clarifier Basin Level (60 - 68%)
    values.LIT_101 = 64 + 4 * diurnal + (prng() - 0.5) * 2;

    // 9. IIT_301: Pump Current (84 - 89 A)
    values.IIT_301 = 86.5 + 2 * diurnal + (prng() - 0.5) * 1.5;

    // 10. FIT_401: Neutralization Dosing (20 - 24 L/h)
    values.FIT_401 = 21.8 + 2.5 * diurnal + (prng() - 0.5) * 1.2;

    // --- Inject Fault Signals if Active Ground Truth ---
    if (activeGt) {
      const progress = (epoch - activeGt.startEpoch) / (activeGt.endEpoch - activeGt.startEpoch); // 0 to 1

      if (activeGt.id === 'GT_INC_01') {
        // Slow sensor drift: pH steadily declines down by up to -1.15 pH
        const drift = 1.15 * progress;
        values.AIT_102 = values.AIT_102 - drift;
        // Dosing controller hunts upwards trying to counteract apparent acidity
        values.FIT_401 = values.FIT_401 + 14 * progress + (prng() - 0.5) * 3;
      } else if (activeGt.id === 'GT_INC_02') {
        // Hydraulic surge: Inflow steps up +55 m3/h, clarifier level +24%, turbidity spikes to 3.4 NTU
        const step = Math.sin(progress * Math.PI); // hump
        values.FIT_101 += 54 * step;
        values.LIT_101 += 22 * step;
        values.AIT_103 += 2.3 * step;
        values.AIT_105 += 45 * step;
        values.FIT_201 += 28 * step;
      } else if (activeGt.id === 'GT_INC_03') {
        // Pump impeller cavitation: Current erratic (+-18A oscillation), flow throttled -45 m3/h
        const osc = (prng() - 0.5) * 28;
        values.IIT_301 += osc;
        values.FIT_101 -= (38 * Math.sin(progress * Math.PI));
        values.LIT_101 += (12 * Math.sin(progress * Math.PI));
      } else if (activeGt.id === 'GT_INC_04') {
        // Dosing line vapor lock: FIT_401 drops to near 1.0 L/h, COD jumps +85 mg/L, pH shifts
        const dropFactor = Math.sin(progress * Math.PI);
        values.FIT_401 = Math.max(1.2, values.FIT_401 - 20 * dropFactor);
        values.AIT_104 += 78 * dropFactor;
        values.AIT_102 -= 0.65 * dropFactor;
      } else if (activeGt.id === 'GT_INC_05') {
        // Aeration oxygen sag: DO drops to 0.75 mg/L, COD rises +65 mg/L
        const sag = Math.sin(progress * Math.PI);
        values.AIT_202 = Math.max(0.68, values.AIT_202 - 1.85 * sag);
        values.AIT_104 += 58 * sag;
      }
    }

    // Round values cleanly
    for (const k of Object.keys(values) as TagId[]) {
      values[k] = Math.round(values[k] * 100) / 100;
    }

    telemetry.push({
      timestamp: timeStr,
      timestampEpoch: epoch,
      values,
      groundTruthAnomalyId: activeGt ? activeGt.id : undefined
    });
  }

  return {
    telemetry,
    groundTruth,
    tags
  };
}
