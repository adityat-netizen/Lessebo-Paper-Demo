import fs from 'node:fs';
import path from 'node:path';

// Deterministic synthetic conflict dataset generator (48 runs)
// High-grammage runs (150g-300g) are predominantly light shades (Tier 1 & 2)
// Low-grammage runs (80g-120g) are medium & dark shades (Tier 3 & 4)

interface ConflictTemplate {
  customer: string;
  priority: 'High - Strict SLA' | 'High' | 'Medium' | 'Standard SLA';
  dueDays: number;
  shade: string;
  group: 'Ultra-Light' | 'Light' | 'Medium' | 'Dark';
  hex: string;
  tier: number;
  washoutGroup: number;
  gsm: number;
  format: 'Sheets' | 'Reels';
  dims: string | null;
  machine: 'PM1' | 'PM2';
  tonnes: number;
  speed: number;
  pricePerTonne: number;
}

const templates: ConflictTemplate[] = [
  // Block 1: High grammage Ultra-Light & Light shades (PM1)
  { customer: 'Nordic Art Editions', priority: 'High - Strict SLA', dueDays: 12, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 240, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 28.0, speed: 5.2, pricePerTonne: 1850 },
  { customer: 'Munken Publishing Group', priority: 'High', dueDays: 15, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 200, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 22.0, speed: 5.6, pricePerTonne: 1780 },
  { customer: 'Galleri Stockholm Prints', priority: 'Medium', dueDays: 18, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 170, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 19.5, speed: 6.0, pricePerTonne: 1720 },
  { customer: 'Arktis Design Studio', priority: 'Standard SLA', dueDays: 24, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 150, format: 'Reels', dims: null, machine: 'PM1', tonnes: 32.0, speed: 6.4, pricePerTonne: 1650 },

  { customer: 'Royal Swedish Stationery', priority: 'High - Strict SLA', dueDays: 13, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 240, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 26.0, speed: 5.2, pricePerTonne: 1890 },
  { customer: 'Kruger Luxury Books', priority: 'Medium', dueDays: 17, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 200, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 21.0, speed: 5.6, pricePerTonne: 1820 },
  { customer: 'Copenhagen Print House', priority: 'Standard SLA', dueDays: 22, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 170, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 18.0, speed: 6.0, pricePerTonne: 1750 },
  { customer: 'Bergen Creative Agency', priority: 'Standard SLA', dueDays: 26, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 150, format: 'Reels', dims: null, machine: 'PM1', tonnes: 30.0, speed: 6.4, pricePerTonne: 1680 },

  { customer: 'Helsinki Fine Bindery', priority: 'High', dueDays: 14, shade: 'Natural White', group: 'Light', hex: '#F6F4ED', tier: 2, washoutGroup: 1, gsm: 240, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 25.0, speed: 5.2, pricePerTonne: 1860 },
  { customer: 'Vasa Graphic Arts', priority: 'Medium', dueDays: 19, shade: 'Natural White', group: 'Light', hex: '#F6F4ED', tier: 2, washoutGroup: 1, gsm: 200, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 20.0, speed: 5.6, pricePerTonne: 1790 },
  { customer: 'Gothenburg Maritime Museum', priority: 'Standard SLA', dueDays: 23, shade: 'Natural White', group: 'Light', hex: '#F6F4ED', tier: 2, washoutGroup: 1, gsm: 170, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 17.5, speed: 6.0, pricePerTonne: 1730 },
  { customer: 'Skane Packaging Corp', priority: 'Standard SLA', dueDays: 27, shade: 'Natural White', group: 'Light', hex: '#F6F4ED', tier: 2, washoutGroup: 1, gsm: 150, format: 'Reels', dims: null, machine: 'PM1', tonnes: 28.5, speed: 6.4, pricePerTonne: 1660 },

  { customer: 'Malmo Artisan Press', priority: 'Medium', dueDays: 16, shade: 'Chamois / Vanilla', group: 'Light', hex: '#F3E5AB', tier: 2, washoutGroup: 1, gsm: 240, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 22.0, speed: 5.2, pricePerTonne: 1870 },
  { customer: 'Uppsala Academic Publishing', priority: 'Standard SLA', dueDays: 21, shade: 'Chamois / Vanilla', group: 'Light', hex: '#F3E5AB', tier: 2, washoutGroup: 1, gsm: 200, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 19.0, speed: 5.6, pricePerTonne: 1800 },
  { customer: 'Orebro Print Studio', priority: 'Standard SLA', dueDays: 25, shade: 'Chamois / Vanilla', group: 'Light', hex: '#F3E5AB', tier: 2, washoutGroup: 1, gsm: 170, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 16.0, speed: 6.0, pricePerTonne: 1740 },
  { customer: 'Dalarna Craft Goods', priority: 'Standard SLA', dueDays: 28, shade: 'Chamois / Vanilla', group: 'Light', hex: '#F3E5AB', tier: 2, washoutGroup: 1, gsm: 150, format: 'Reels', dims: null, machine: 'PM1', tonnes: 27.0, speed: 6.4, pricePerTonne: 1670 },

  // Block 2: Low grammage Medium & Dark shades (PM1) - creates severe conflict when colour sorted!
  { customer: 'Stockholm Fine Packaging', priority: 'High - Strict SLA', dueDays: 13, shade: 'Canary Yellow', group: 'Medium', hex: '#FFD700', tier: 3, washoutGroup: 2, gsm: 80, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 24.0, speed: 6.8, pricePerTonne: 1980 },
  { customer: 'Viking Confectionery Wrap', priority: 'Medium', dueDays: 18, shade: 'Canary Yellow', group: 'Medium', hex: '#FFD700', tier: 3, washoutGroup: 2, gsm: 90, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 18.0, speed: 6.5, pricePerTonne: 1920 },
  { customer: 'Lund University Press', priority: 'Standard SLA', dueDays: 22, shade: 'Canary Yellow', group: 'Medium', hex: '#FFD700', tier: 3, washoutGroup: 2, gsm: 100, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 15.0, speed: 6.2, pricePerTonne: 1880 },
  { customer: 'Aalborg Retail Label Co', priority: 'Standard SLA', dueDays: 26, shade: 'Canary Yellow', group: 'Medium', hex: '#FFD700', tier: 3, washoutGroup: 2, gsm: 120, format: 'Reels', dims: null, machine: 'PM1', tonnes: 26.0, speed: 5.8, pricePerTonne: 1820 },

  { customer: 'Baltic Premium Cards', priority: 'High', dueDays: 15, shade: 'Sky Blue', group: 'Medium', hex: '#87CEEB', tier: 3, washoutGroup: 2, gsm: 80, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 22.0, speed: 6.8, pricePerTonne: 1990 },
  { customer: 'Nordic Pharma Foil Liners', priority: 'Medium', dueDays: 19, shade: 'Sky Blue', group: 'Medium', hex: '#87CEEB', tier: 3, washoutGroup: 2, gsm: 90, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 17.5, speed: 6.5, pricePerTonne: 1930 },
  { customer: 'Oslo Brand Identity', priority: 'Standard SLA', dueDays: 24, shade: 'Sky Blue', group: 'Medium', hex: '#87CEEB', tier: 3, washoutGroup: 2, gsm: 100, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 14.5, speed: 6.2, pricePerTonne: 1890 },
  { customer: 'Tromso Specialty Foods', priority: 'Standard SLA', dueDays: 27, shade: 'Sky Blue', group: 'Medium', hex: '#87CEEB', tier: 3, washoutGroup: 2, gsm: 120, format: 'Reels', dims: null, machine: 'PM1', tonnes: 25.0, speed: 5.8, pricePerTonne: 1830 },

  { customer: 'Småland Botanical Botanical', priority: 'High - Strict SLA', dueDays: 12, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 80, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 26.0, speed: 6.8, pricePerTonne: 2150 },
  { customer: 'Gotland Organic Foods', priority: 'Medium', dueDays: 17, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 90, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 19.0, speed: 6.5, pricePerTonne: 2080 },
  { customer: 'Aarhus Luxury Spirits', priority: 'Standard SLA', dueDays: 23, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 100, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 16.0, speed: 6.2, pricePerTonne: 2020 },
  { customer: 'Nordic Forest Extracts', priority: 'Standard SLA', dueDays: 28, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 120, format: 'Reels', dims: null, machine: 'PM1', tonnes: 28.0, speed: 5.8, pricePerTonne: 1960 },

  { customer: 'Stockholm Haute Couture', priority: 'High', dueDays: 14, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 80, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 25.0, speed: 6.8, pricePerTonne: 2200 },
  { customer: 'Reykjavik Contemporary', priority: 'Medium', dueDays: 20, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 90, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 18.5, speed: 6.5, pricePerTonne: 2120 },
  { customer: 'Copenhagen Watch Co', priority: 'Standard SLA', dueDays: 25, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 100, format: 'Sheets', dims: '640x900 mm', machine: 'PM1', tonnes: 15.5, speed: 6.2, pricePerTonne: 2060 },
  { customer: 'Kiruna Premium Minerals', priority: 'Standard SLA', dueDays: 29, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 120, format: 'Reels', dims: null, machine: 'PM1', tonnes: 27.5, speed: 5.8, pricePerTonne: 1990 },

  // Block 3: Mixed High Grammage Whites & Medium Grammage Darks (PM1 & PM2)
  { customer: 'Scandinavian Fashion House', priority: 'Medium', dueDays: 18, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 300, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 20.0, speed: 4.8, pricePerTonne: 1950 },
  { customer: 'Vasteras Industrial Design', priority: 'Standard SLA', dueDays: 24, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 270, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 18.0, speed: 5.0, pricePerTonne: 1920 },
  { customer: 'Boras Textile Archives', priority: 'Standard SLA', dueDays: 26, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 100, format: 'Sheets', dims: '700x1000 mm', machine: 'PM1', tonnes: 16.0, speed: 6.2, pricePerTonne: 2040 },
  { customer: 'Halmstad Specialty Packaging', priority: 'Standard SLA', dueDays: 30, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 90, format: 'Reels', dims: null, machine: 'PM1', tonnes: 22.0, speed: 6.5, pricePerTonne: 2100 },

  // PM2 Heavy Cover orders (12 orders)
  { customer: 'Nordic Art Editions', priority: 'High - Strict SLA', dueDays: 14, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 300, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 32.0, speed: 4.5, pricePerTonne: 2100 },
  { customer: 'Munken Publishing Group', priority: 'Medium', dueDays: 19, shade: 'Natural White', group: 'Light', hex: '#F6F4ED', tier: 2, washoutGroup: 1, gsm: 270, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 28.0, speed: 4.8, pricePerTonne: 2050 },
  { customer: 'Royal Swedish Stationery', priority: 'Medium', dueDays: 21, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 240, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 25.0, speed: 5.0, pricePerTonne: 1980 },
  { customer: 'Copenhagen Print House', priority: 'Standard SLA', dueDays: 25, shade: 'Chamois / Vanilla', group: 'Light', hex: '#F3E5AB', tier: 2, washoutGroup: 1, gsm: 240, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 22.0, speed: 5.0, pricePerTonne: 1980 },

  { customer: 'Stockholm Fine Packaging', priority: 'High', dueDays: 16, shade: 'Canary Yellow', group: 'Medium', hex: '#FFD700', tier: 3, washoutGroup: 2, gsm: 150, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 24.0, speed: 5.5, pricePerTonne: 2020 },
  { customer: 'Baltic Premium Cards', priority: 'Medium', dueDays: 20, shade: 'Sky Blue', group: 'Medium', hex: '#87CEEB', tier: 3, washoutGroup: 2, gsm: 170, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 21.0, speed: 5.3, pricePerTonne: 2040 },
  { customer: 'Småland Botanical', priority: 'High - Strict SLA', dueDays: 15, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 150, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 26.0, speed: 5.5, pricePerTonne: 2180 },
  { customer: 'Stockholm Haute Couture', priority: 'Medium', dueDays: 22, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 170, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 23.0, speed: 5.3, pricePerTonne: 2220 },

  { customer: 'Helsinki Fine Bindery', priority: 'Standard SLA', dueDays: 27, shade: 'Bright White', group: 'Ultra-Light', hex: '#FFFFFF', tier: 1, washoutGroup: 1, gsm: 350, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 30.0, speed: 4.2, pricePerTonne: 2250 },
  { customer: 'Bergen Creative Agency', priority: 'Standard SLA', dueDays: 28, shade: 'Warm Ivory', group: 'Light', hex: '#EFE7D3', tier: 2, washoutGroup: 1, gsm: 300, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 27.0, speed: 4.5, pricePerTonne: 2120 },
  { customer: 'Gotland Organic Foods', priority: 'Standard SLA', dueDays: 29, shade: 'Forest Green', group: 'Dark', hex: '#1E4D2B', tier: 4, washoutGroup: 3, gsm: 200, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 22.0, speed: 5.1, pricePerTonne: 2240 },
  { customer: 'Reykjavik Contemporary', priority: 'Standard SLA', dueDays: 30, shade: 'Deep Charcoal', group: 'Dark', hex: '#232528', tier: 4, washoutGroup: 4, gsm: 200, format: 'Sheets', dims: '700x1000 mm', machine: 'PM2', tonnes: 24.0, speed: 5.1, pricePerTonne: 2280 },
];

const conflictOrders = templates.map((t, idx) => {
  const numStr = String(idx + 1).padStart(3, '0');
  const code = t.shade.substring(0, 3).toUpperCase();
  const fmtCode = t.format === 'Sheets' ? 'SHE' : 'REE';
  const prodHours = Math.round((t.tonnes / t.speed) * 100) / 100;
  const orderVal = Math.round(t.tonnes * t.pricePerTonne * 100) / 100;

  return {
    order_id: `CAM-CONF-${numStr}`,
    customer_name: t.customer,
    customer_priority: t.priority,
    sku_id: `LSB-${code}-${t.gsm}-${fmtCode}-${numStr}`,
    brand_line: t.tier >= 3 ? 'Lessebo Colours' : 'Lessebo Smooth',
    shade_name: t.shade,
    shade_group: t.group,
    shade_hex: t.hex,
    shade_tier: t.tier,
    washout_group: t.washoutGroup,
    grammage_gsm: t.gsm,
    format_type: t.format,
    sheet_dimensions: t.dims,
    assigned_machine: t.machine,
    quantity_tonnes: t.tonnes,
    nominal_speed_tph: t.speed,
    production_hours: prodHours,
    due_in_days: t.dueDays,
    order_value_eur: orderVal,
  };
});

const outputPath = path.resolve(process.cwd(), 'src/data/conflict_order_book.json');
fs.writeFileSync(outputPath, JSON.stringify(conflictOrders, null, 2), 'utf-8');
console.log(`Generated ${conflictOrders.length} conflict orders at ${outputPath}`);
