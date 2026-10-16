/**
 * Deterministic Synthetic Campaign Generator for Benchmark Suite.
 * Generates reproducible, seeded campaign instances across multiple sizes and structural archetypes.
 * Illustrative / Synthetic - Not actual Lessebo results.
 * Client input required for real order books and changeover penalties.
 */

import type { CampaignOrder, MachineId } from '../types';
import type { BenchmarkInstance, BenchmarkStructure } from '../types/benchmark';
import productsData from '../data/products.json' with { type: 'json' };

interface ProductItem {
  sku_id: string;
  brand_line: string;
  shade_name: string;
  shade_group: string;
  shade_hex: string;
  shade_tier: number;
  washout_group: number;
  grammage_gsm: number;
  format_type: string;
  sheet_dimensions: string | null;
  assigned_machine: string;
  nominal_speed_tph: number;
  price_per_tonne_eur: number;
}

const products = productsData as unknown as ProductItem[];

// Realistic Nordic customer names for synthetic campaigns
const NORDIC_CUSTOMERS = [
  'Nordic Art Editions',
  'Stockholm Fine Packaging',
  'Copenhagen Publishing House',
  'Gothenburg Luxury Board',
  'Oslo Design & Print',
  'Helsinki Graphic Arts',
  'Malmö Press & Paper',
  'Aarhus Specialty Books',
  'Uppsala Academic Press',
  'Lund Cartonnage AB',
  'Bergen Heritage Print',
  'Reykjavik Bookbinders',
  'Växjö Kartong & Grafiska',
  'Kalmar Förpackningsdesign',
  'Jönköping Paperworks',
  'Linköping Fine Print',
];

/**
 * Fast, high-quality 32-bit PRNG (Mulberry32) for reproducible pseudorandom generation.
 */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function nextFloat(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Filter product catalog by campaign structure archetype.
 */
function getArchetypeProductPool(structure: BenchmarkStructure, machine: MachineId): ProductItem[] {
  const machineProducts = products.filter((p) => p.assigned_machine === machine);
  const pool = machineProducts.length > 0 ? machineProducts : products;

  switch (structure) {
    case 'heavy_grammage':
      // Heavily skewed towards high caliper: >= 150 gsm (up to 300 gsm)
      return pool.filter((p) => p.grammage_gsm >= 140);

    case 'high_shade_diversity':
      // Rich chromatic distribution with tiers 2, 3, 4, 5
      return pool.filter((p) => p.shade_tier >= 2 || p.shade_name.includes('White'));

    case 'conflict':
      // Broad mix to maximize scheduling friction
      return pool;

    case 'standard':
    default:
      return pool;
  }
}

/**
 * Generate a single deterministic synthetic campaign instance.
 */
export function generateCampaignInstance(
  runCount: number,
  structure: BenchmarkStructure,
  seed: number,
  targetMachine: MachineId = 'PM1'
): BenchmarkInstance {
  const rand = createPrng(seed);
  const pool = getArchetypeProductPool(structure, targetMachine);
  const orders: CampaignOrder[] = [];

  const structureLabels: Record<BenchmarkStructure, string> = {
    standard: 'Standard Mix',
    conflict: 'Conflict & Tight SLAs',
    heavy_grammage: 'Heavy Grammage Concentration',
    high_shade_diversity: 'High Shade Diversity',
  };

  const descriptions: Record<BenchmarkStructure, string> = {
    standard: 'Balanced distribution across standard book weights (80-240 gsm) and normal SLA horizons (10-24 days).',
    conflict: '40% strict delivery deadlines with competing light/dark and heavy/light orders forcing setup trade-offs.',
    heavy_grammage: 'Predominantly heavy cover weights (140-300 gsm), amplifying grammage reversal and mechanical calibration penalties.',
    high_shade_diversity: 'Deep and vibrant shades across all tiers requiring extensive dye purge and washout cycles.',
  };

  const instanceId = `BENCH-${runCount}-${structure.toUpperCase().slice(0, 5)}-S${seed % 1000}`;

  for (let i = 0; i < runCount; i++) {
    const prodIdx = Math.floor(rand() * pool.length);
    const prod = pool[prodIdx];

    const customer = NORDIC_CUSTOMERS[Math.floor(rand() * NORDIC_CUSTOMERS.length)];

    // Quantity tonnes: 10 - 35 tonnes
    const quantityTonnes = Math.round((10 + rand() * 24) * 10) / 10;
    const nominalSpeed = prod.nominal_speed_tph || 6.0;
    const productionHours = Math.round((quantityTonnes / nominalSpeed) * 100) / 100;

    // Due dates & priorities dependent on structure
    let customerPriority: 'Standard' | 'Medium' | 'High - Strict SLA' = 'Medium';
    let dueInDays = 14;

    if (structure === 'conflict') {
      const pRoll = rand();
      if (pRoll < 0.42) {
        customerPriority = 'High - Strict SLA';
        dueInDays = 4 + Math.floor(rand() * 8); // 4 - 11 days (very tight)
      } else if (pRoll < 0.75) {
        customerPriority = 'Medium';
        dueInDays = 8 + Math.floor(rand() * 10);
      } else {
        customerPriority = 'Standard';
        dueInDays = 14 + Math.floor(rand() * 12);
      }
    } else if (structure === 'heavy_grammage') {
      const pRoll = rand();
      customerPriority = pRoll < 0.25 ? 'High - Strict SLA' : pRoll < 0.65 ? 'Medium' : 'Standard';
      dueInDays = 8 + Math.floor(rand() * 16);
    } else if (structure === 'high_shade_diversity') {
      const pRoll = rand();
      customerPriority = pRoll < 0.3 ? 'High - Strict SLA' : pRoll < 0.7 ? 'Medium' : 'Standard';
      dueInDays = 9 + Math.floor(rand() * 15);
    } else {
      // standard
      const pRoll = rand();
      customerPriority = pRoll < 0.2 ? 'High - Strict SLA' : pRoll < 0.6 ? 'Medium' : 'Standard';
      dueInDays = 10 + Math.floor(rand() * 16);
    }

    const orderValueEur = Math.round(quantityTonnes * (prod.price_per_tonne_eur || 1800));

    orders.push({
      order_id: `ORD-${instanceId}-${(i + 1).toString().padStart(3, '0')}`,
      customer_name: customer,
      customer_priority: customerPriority,
      sku_id: prod.sku_id,
      brand_line: prod.brand_line,
      shade_name: prod.shade_name,
      shade_group: (prod.shade_group as any) || 'Medium',
      shade_hex: prod.shade_hex || '#FFFFFF',
      shade_tier: prod.shade_tier || 1,
      washout_group: prod.washout_group || 1,
      grammage_gsm: prod.grammage_gsm || 100,
      format_type: prod.format_type === 'Reels' ? 'Reels' : 'Sheets',
      sheet_dimensions: prod.sheet_dimensions,
      assigned_machine: targetMachine,
      quantity_tonnes: quantityTonnes,
      nominal_speed_tph: nominalSpeed,
      production_hours: productionHours,
      due_in_days: dueInDays,
      order_value_eur: orderValueEur,
    });
  }

  return {
    instanceId,
    name: `${structureLabels[structure]} (${runCount} runs)`,
    runCount,
    structure,
    structureLabel: structureLabels[structure],
    description: descriptions[structure],
    seed,
    orders,
  };
}

/**
 * The standard benchmark test matrix:
 * 7 size tiers (10, 20, 30, 40, 60, 80, 100) x 4 structural archetypes = 28 reproducible instances.
 */
export const BENCHMARK_SIZES = [10, 20, 30, 40, 60, 80, 100] as const;
export const BENCHMARK_STRUCTURES: BenchmarkStructure[] = [
  'standard',
  'conflict',
  'heavy_grammage',
  'high_shade_diversity',
];

export function generateAllBenchmarkInstances(baseSeed: number = 42, targetMachine: MachineId = 'PM1'): BenchmarkInstance[] {
  const instances: BenchmarkInstance[] = [];
  let currentSeed = baseSeed;

  for (const size of BENCHMARK_SIZES) {
    for (const structure of BENCHMARK_STRUCTURES) {
      instances.push(generateCampaignInstance(size, structure, currentSeed, targetMachine));
      currentSeed += 17; // deterministic offset
    }
  }

  return instances;
}
