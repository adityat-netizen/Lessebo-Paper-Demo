/**
 * Shared RFC 4180 compliant CSV Export Utility for Lessebo Paper AB Planning Demo.
 * 
 * Guarantees:
 * - UTF-8 BOM (\uFEFF) for immediate character set rendering in Excel / LibreOffice
 *   (proper support for Swedish characters å/ä/ö and currency symbols €)
 * - Strict RFC 4180 escaping (quotes, commas, newlines escaped correctly)
 * - Standardized "#" metadata comment block with mandated Synthetic Notice
 * - Clean headers with units (_tonnes, _hours, _eur, _pct)
 * - Matching on-screen calculation values without duplication or hardcoding
 */

export interface CsvColumn<T = any> {
  key: string;
  label: string;
  unit?: string;
  formatter?: (row: T) => string | number | null | undefined;
}

export interface CsvMetadata {
  datasetName: string;
  scenarioName?: string;
  forecastHorizon?: string | number;
  assumptions?: Record<string, string | number>;
  filtersApplied?: Record<string, string>;
  additionalNotes?: string[];
  solverStatus?: string;
  provenLowerBound?: number | string;
  optimalityGap?: number | string;
  timeoutSeconds?: number | string;
  seed?: number | string;
  fallbackNote?: string;
  selectedAlgorithm?: string;
  comparedAlgorithm?: string;
}

/**
 * Escapes a single CSV field value according to RFC 4180 rules.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val);
  // If the field contains comma, quote, newline, or carriage return, enclose in quotes and double internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Formats current local/UTC timestamp into YYYYMMDD-HHmm format for filenames.
 */
export function formatFilenameTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}${m}${d}-${h}${min}`;
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM and metadata header.
 */
export function buildCsvContent<T extends Record<string, any>>(
  metadata: CsvMetadata,
  columns: CsvColumn<T>[],
  data: T[]
): string {
  const nowStr = new Date().toISOString();
  const metaLines: string[] = [];

  // Mandated metadata comments
  metaLines.push(`# Dataset: ${metadata.datasetName}`);
  metaLines.push(`# Generated: ${nowStr}`);
  metaLines.push(`# Scenario: ${metadata.scenarioName || 'Baseline Mill Plan'}`);
  if (metadata.forecastHorizon) {
    metaLines.push(`# Forecast Horizon: ${metadata.forecastHorizon}`);
  }
  metaLines.push(`# Notice: Illustrative / Synthetic - Not actual Lessebo results`);
  metaLines.push(`# Source System: Tatras Data Industrial Intelligence Engine`);

  if (metadata.selectedAlgorithm) {
    metaLines.push(`# Selected Algorithm: ${metadata.selectedAlgorithm}`);
  }
  if (metadata.comparedAlgorithm) {
    metaLines.push(`# Compared Baseline: ${metadata.comparedAlgorithm}`);
  }
  if (metadata.solverStatus) {
    metaLines.push(`# Solver Status: ${metadata.solverStatus}`);
  }
  if (metadata.provenLowerBound !== undefined) {
    metaLines.push(`# Proven Lower Bound: ${metadata.provenLowerBound}`);
  }
  if (metadata.optimalityGap !== undefined) {
    const gapStr = typeof metadata.optimalityGap === 'number'
      ? `${(metadata.optimalityGap * 100).toFixed(1)}%`
      : String(metadata.optimalityGap);
    metaLines.push(`# Optimality Gap: ${gapStr}`);
  }
  if (metadata.timeoutSeconds !== undefined) {
    metaLines.push(`# Timeout Limit: ${metadata.timeoutSeconds}s`);
  }
  if (metadata.seed !== undefined) {
    metaLines.push(`# Solver Seed: ${metadata.seed}`);
  }
  if (metadata.fallbackNote) {
    metaLines.push(`# Fallback Note: ${metadata.fallbackNote}`);
  }

  if (metadata.assumptions && Object.keys(metadata.assumptions).length > 0) {
    const asmpStr = Object.entries(metadata.assumptions)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    metaLines.push(`# Key Assumptions: ${asmpStr}`);
  }

  if (metadata.filtersApplied && Object.keys(metadata.filtersApplied).length > 0) {
    const filterStr = Object.entries(metadata.filtersApplied)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    metaLines.push(`# Active Filters: ${filterStr}`);
  }

  metaLines.push(
    `# Client Input Note: Machine hourly rates, changeover penalty matrix, broke rates, and capacity limits are generic placeholders requiring Lessebo mill calibration.`
  );

  if (metadata.additionalNotes) {
    metadata.additionalNotes.forEach((n) => metaLines.push(`# Note: ${n}`));
  }

  // Header row
  const headerRow = columns
    .map((col) => {
      const headerName = col.unit ? `${col.label} (${col.unit})` : col.label;
      return escapeCsvField(headerName);
    })
    .join(',');

  // Data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        let val: any;
        if (col.formatter) {
          val = col.formatter(row);
        } else {
          val = row[col.key];
        }
        return escapeCsvField(val);
      })
      .join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF)
  const fullContent =
    '\uFEFF' +
    metaLines.join('\r\n') +
    '\r\n\r\n' +
    headerRow +
    '\r\n' +
    dataRows.join('\r\n') +
    '\r\n';

  return fullContent;
}

/**
 * Triggers a browser download of the generated CSV content with standardized filename.
 */
export function downloadCsvFile(
  datasetSlug: string,
  scenarioSlug: string = 'baseline',
  csvContent: string,
  algorithmSlug?: string
): void {
  const cleanDataset = datasetSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const cleanScenario = scenarioSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const timestamp = formatFilenameTimestamp();
  const filename = algorithmSlug
    ? `lessebo_${cleanDataset}_${algorithmSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_${cleanScenario}_synthetic_${timestamp}.csv`
    : `lessebo_${cleanDataset}_${cleanScenario}_synthetic_${timestamp}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
