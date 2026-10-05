import type { MonthlyRecord, ForecastPoint, Product } from '../types';

export interface ForecastCalculationResult {
  trendSlopeBeta: number;
  trendInterceptAlpha: number;
  seasonalIndices: Record<number, number>;
  historicalPoints: ForecastPoint[];
  forecastPoints: ForecastPoint[];
  combinedSeries: ForecastPoint[];
  skuDemandShare: Record<string, number>;
}

export function computeForecast(
  history: MonthlyRecord[],
  products: Product[],
  horizonMonths: 3 | 6 | 12,
  demandDeltaPct: number = 0
): ForecastCalculationResult {
  const n = history.length;
  if (n === 0) {
    throw new Error('History cannot be empty');
  }

  // 1. Linear regression on monthly historical tonnes
  // x = month_index (1..n), y = total_tonnes
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = history[i].month_index;
    const y = history[i].total_tonnes;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const trendSlopeBeta = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const trendInterceptAlpha = (sumY - trendSlopeBeta * sumX) / n;

  // 2. Compute calendar-month seasonal indices
  const monthSums: Record<number, number[]> = {};
  for (let m = 1; m <= 12; m++) {
    monthSums[m] = [];
  }

  history.forEach((rec) => {
    const trendAtT = trendInterceptAlpha + trendSlopeBeta * rec.month_index;
    const ratio = rec.total_tonnes / trendAtT;
    monthSums[rec.month].push(ratio);
  });

  const rawSeasonalIndices: Record<number, number> = {};
  let totalRawIndices = 0;
  for (let m = 1; m <= 12; m++) {
    const values = monthSums[m];
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 1.0;
    rawSeasonalIndices[m] = avg;
    totalRawIndices += avg;
  }

  // Normalize so the 12 months average exactly 1.000 (sum = 12)
  const normFactor = 12.0 / totalRawIndices;
  const seasonalIndices: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    seasonalIndices[m] = Number((rawSeasonalIndices[m] * normFactor).toFixed(3));
  }

  // 3. Historical points formatted for charts
  const historicalPoints: ForecastPoint[] = history.map((rec) => {
    const trendVal = trendInterceptAlpha + trendSlopeBeta * rec.month_index;
    return {
      monthIndex: rec.month_index,
      monthStr: rec.month_str,
      year: rec.year,
      month: rec.month,
      isForecast: false,
      historicalTonnes: rec.total_tonnes,
      forecastTonnes: rec.total_tonnes,
      trendBaselineTonnes: Math.round(trendVal),
      seasonalMultiplier: seasonalIndices[rec.month],
      lowerBoundTonnes: Math.round(rec.total_tonnes * 0.96),
      upperBoundTonnes: Math.round(rec.total_tonnes * 1.04),
    };
  });

  // 4. Generate forward horizon forecast points
  const lastRecord = history[history.length - 1];
  let curYear = lastRecord.year;
  let curMonth = lastRecord.month;
  const forecastPoints: ForecastPoint[] = [];

  const deltaMultiplier = 1.0 + demandDeltaPct / 100.0;

  for (let h = 1; h <= horizonMonths; h++) {
    curMonth += 1;
    if (curMonth > 12) {
      curMonth = 1;
      curYear += 1;
    }

    const t = n + h;
    const trendVal = trendInterceptAlpha + trendSlopeBeta * t;
    const seasonFactor = seasonalIndices[curMonth] ?? 1.0;
    const projectedTonnes = Math.round(trendVal * seasonFactor * deltaMultiplier);
    const monthStr = `${curYear}-${String(curMonth).padStart(2, '0')}`;

    forecastPoints.push({
      monthIndex: t,
      monthStr,
      year: curYear,
      month: curMonth,
      isForecast: true,
      forecastTonnes: projectedTonnes,
      trendBaselineTonnes: Math.round(trendVal),
      seasonalMultiplier: seasonFactor,
      lowerBoundTonnes: Math.round(projectedTonnes * 0.95),
      upperBoundTonnes: Math.round(projectedTonnes * 1.05),
    });
  }

  // Sku demand share lookup
  const skuDemandShare: Record<string, number> = {};
  products.forEach((p) => {
    skuDemandShare[p.sku_id] = p.demand_share;
  });

  return {
    trendSlopeBeta: Number(trendSlopeBeta.toFixed(2)),
    trendInterceptAlpha: Number(trendInterceptAlpha.toFixed(1)),
    seasonalIndices,
    historicalPoints,
    forecastPoints,
    combinedSeries: [...historicalPoints, ...forecastPoints],
    skuDemandShare,
  };
}
