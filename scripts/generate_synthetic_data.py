"""
Synthetic Data Generation Script for Lessebo Paper AB Demo
Generates:
- products.json (32 SKUs)
- sales_orders_monthly.json (38 months aggregated + order summaries)
- current_inventory.json (Warehouse starting stock)
- machine_capacity.json (PM1 & PM2 parameters)
- changeover_matrix.json (Pairwise transition penalties)
- upcoming_order_book.json (Active campaign runs for sequence optimization)

Scale targets:
- History: 38 months (Jan 2023 - Feb 2026)
- Orders: ~5,000 records
- SKUs: 32 boutique combinations
- Annual Revenue: €80M - €90M range (~46k - 49k tonnes/year)
Seed: 20260917
"""

import json
import math
import os
import random
from datetime import datetime, timedelta

# Fix seed for strict reproducibility
SEED = 20260917
random.seed(SEED)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Product Catalog (32 SKUs)
SHADES = [
    {"name": "Bright White", "group": "Ultra-Light", "hex": "#FFFFFF", "tier": 1, "washout_group": 1},
    {"name": "Natural White", "group": "Ultra-Light", "hex": "#F6F4ED", "tier": 1, "washout_group": 1},
    {"name": "Warm Ivory", "group": "Light", "hex": "#EFE7D3", "tier": 2, "washout_group": 2},
    {"name": "Chamois / Vanilla", "group": "Light", "hex": "#E5D8B8", "tier": 2, "washout_group": 2},
    {"name": "Canary Yellow", "group": "Medium", "hex": "#F2D879", "tier": 3, "washout_group": 3},
    {"name": "Sky Blue", "group": "Medium", "hex": "#82B2D8", "tier": 3, "washout_group": 3},
    {"name": "Forest Green", "group": "Dark", "hex": "#2E5339", "tier": 4, "washout_group": 4},
    {"name": "Deep Charcoal", "group": "Dark", "hex": "#232528", "tier": 4, "washout_group": 4},
]

GRAMMAGES = [
    {"gsm": 80, "machine": "PM1", "speed_tph": 6.8, "base_price": 1650},
    {"gsm": 100, "machine": "PM1", "speed_tph": 6.2, "base_price": 1720},
    {"gsm": 120, "machine": "PM1", "speed_tph": 5.8, "base_price": 1790},
    {"gsm": 150, "machine": "PM1", "speed_tph": 5.2, "base_price": 1850},
    {"gsm": 240, "machine": "PM2", "speed_tph": 4.8, "base_price": 2080},
    {"gsm": 300, "machine": "PM2", "speed_tph": 4.2, "base_price": 2250},
]

FORMATS = [
    {"type": "Sheets", "dimension": "700x1000 mm", "premium": 70},
    {"type": "Sheets", "dimension": "640x900 mm", "premium": 50},
    {"type": "Reels", "dimension": None, "premium": 0},
]

# We curate 32 representative SKUs to match Lessebo's boutique range
PRODUCTS = []
sku_counter = 1

# Select 32 realistic combinations
sku_definitions = [
    # PM1 - Graphic & Book Papers (80 - 150 gsm)
    ("Lessebo Smooth", 0, 0, 0),  # Bright White, 80g, Sheets 700x1000
    ("Lessebo Smooth", 0, 1, 0),  # Bright White, 100g, Sheets 700x1000
    ("Lessebo Smooth", 0, 2, 0),  # Bright White, 120g, Sheets 700x1000
    ("Lessebo Smooth", 0, 2, 1),  # Bright White, 120g, Sheets 640x900
    ("Lessebo Smooth", 0, 3, 2),  # Bright White, 150g, Reels
    ("Lessebo 1.3 Rough", 1, 0, 0), # Natural White, 80g, Sheets 700x1000
    ("Lessebo 1.3 Rough", 1, 1, 0), # Natural White, 100g, Sheets 700x1000
    ("Lessebo 1.3 Rough", 1, 2, 0), # Natural White, 120g, Sheets 700x1000
    ("Lessebo 1.3 Rough", 1, 3, 2), # Natural White, 150g, Reels
    ("Lessebo 1.3 Rough", 2, 1, 0), # Warm Ivory, 100g, Sheets 700x1000
    ("Lessebo 1.3 Rough", 2, 2, 0), # Warm Ivory, 120g, Sheets 700x1000
    ("Lessebo 1.3 Rough", 2, 3, 1), # Warm Ivory, 150g, Sheets 640x900
    ("Lessebo Smooth", 3, 1, 0),    # Chamois / Vanilla, 100g, Sheets 700x1000
    ("Lessebo Smooth", 3, 2, 0),    # Chamois / Vanilla, 120g, Sheets 700x1000
    ("Lessebo Colours", 4, 1, 0),   # Canary Yellow, 100g, Sheets 700x1000
    ("Lessebo Colours", 4, 2, 0),   # Canary Yellow, 120g, Sheets 700x1000
    ("Lessebo Colours", 4, 3, 2),   # Canary Yellow, 150g, Reels
    ("Lessebo Colours", 5, 1, 0),   # Sky Blue, 100g, Sheets 700x1000
    ("Lessebo Colours", 5, 2, 0),   # Sky Blue, 120g, Sheets 700x1000
    ("Lessebo Colours", 5, 3, 2),   # Sky Blue, 150g, Reels
    ("Lessebo Colours", 6, 2, 0),   # Forest Green, 120g, Sheets 700x1000
    ("Lessebo Colours", 6, 3, 1),   # Forest Green, 150g, Sheets 640x900
    ("Lessebo Colours", 6, 3, 2),   # Forest Green, 150g, Reels
    ("Lessebo Colours", 7, 2, 0),   # Deep Charcoal, 120g, Sheets 700x1000
    ("Lessebo Colours", 7, 3, 2),   # Deep Charcoal, 150g, Reels
    
    # PM2 - Cover & Luxury Packaging Papers (240 - 300 gsm)
    ("Lessebo Smooth Cover", 0, 4, 0), # Bright White, 240g, Sheets 700x1000
    ("Lessebo Smooth Cover", 0, 5, 0), # Bright White, 300g, Sheets 700x1000
    ("Lessebo 1.3 Rough Cover", 1, 4, 0), # Natural White, 240g, Sheets 700x1000
    ("Lessebo 1.3 Rough Cover", 1, 5, 0), # Natural White, 300g, Sheets 700x1000
    ("Lessebo Colours Cover", 5, 4, 0),   # Sky Blue, 240g, Sheets 700x1000
    ("Lessebo Colours Cover", 6, 5, 0),   # Forest Green, 300g, Sheets 700x1000
    ("Lessebo Colours Cover", 7, 5, 0),   # Deep Charcoal, 300g, Sheets 700x1000
]

for brand, s_idx, g_idx, f_idx in sku_definitions:
    shade = SHADES[s_idx]
    grammage = GRAMMAGES[g_idx]
    fmt = FORMATS[f_idx]
    
    sku_id = f"LSB-{shade['group'][:3].upper()}-{grammage['gsm']}-{fmt['type'][:3].upper()}-{sku_counter:02d}"
    price = grammage['base_price'] + fmt['premium'] + (120 if shade['tier'] >= 3 else 0)
    
    # Relative demand weight in boutique mill
    # Bright/Natural white represent ~55% of volume, ivories ~20%, colours ~25%
    if shade['tier'] == 1:
        weight = 2.4
    elif shade['tier'] == 2:
        weight = 1.2
    elif shade['tier'] == 3:
        weight = 0.7
    else:
        weight = 0.5
    if grammage['gsm'] in (100, 120):
        weight *= 1.3
    
    PRODUCTS.append({
        "sku_id": sku_id,
        "brand_line": brand,
        "shade_name": shade["name"],
        "shade_group": shade["group"],
        "shade_hex": shade["hex"],
        "shade_tier": shade["tier"],
        "washout_group": shade["washout_group"],
        "grammage_gsm": grammage["gsm"],
        "format_type": fmt["type"],
        "sheet_dimensions": fmt["dimension"],
        "assigned_machine": grammage["machine"],
        "nominal_speed_tph": grammage["speed_tph"],
        "price_per_tonne_eur": price,
        "demand_weight": round(weight, 2)
    })
    sku_counter += 1

total_demand_weight = sum(p["demand_weight"] for p in PRODUCTS)
for p in PRODUCTS:
    p["demand_share"] = round(p["demand_weight"] / total_demand_weight, 4)

# 2. Seasonality and 38-Month Timeline (2023-01 to 2026-02)
# Multipliers reflecting European fine paper publishing and holiday packaging cycles
MONTHLY_SEASONAL_INDICES = {
    1: 0.91,   # Jan: Post-holiday inventory review
    2: 0.94,   # Feb: Steady publishing orders
    3: 1.15,   # Mar: Spring corporate catalog & annual report surge
    4: 1.12,   # Apr: High-end publishing print runs
    5: 1.10,   # May: Sustained spring volume
    6: 1.01,   # Jun: Pre-summer ramp-down
    7: 0.72,   # Jul: Nordic mill annual maintenance shut & European summer
    8: 0.95,   # Aug: Post-holiday restarting
    9: 1.14,   # Sep: Autumn publishing season opens
    10: 1.22,  # Oct: Peak pre-Christmas luxury packaging & book printing
    11: 1.16,  # Nov: High volume gift wrap, stationery, luxury boxes
    12: 0.88,  # Dec: Holiday wind-down
}

START_DATE = datetime(2023, 1, 1)
MONTHS_COUNT = 38

# Baseline mill production calibrated to hit ~44,500 tonnes/year and ~€84.5M rolling revenue
BASE_MONTHLY_TONNAGE = 3380.0
ANNUAL_GROWTH_RATE = 0.024
MONTHLY_GROWTH = ANNUAL_GROWTH_RATE / 12.0

monthly_records = []
all_orders = []
order_id_counter = 1000

CUSTOMERS = [
    {"name": "Nordic Art Editions", "tier": "Tier 1 - Luxury Publisher", "country": "Sweden", "share": 0.16},
    {"name": "Stockholm Fine Packaging", "tier": "Tier 2 - Specialty Converter", "country": "Sweden", "share": 0.14},
    {"name": "Munich Fine Books AG", "tier": "Tier 1 - Luxury Publisher", "country": "Germany", "share": 0.15},
    {"name": "Copenhagen Design Print", "tier": "Tier 2 - Specialty Converter", "country": "Denmark", "share": 0.12},
    {"name": "Swiss Luxury Packaging Ltd", "tier": "Tier 1 - Luxury Publisher", "country": "Switzerland", "share": 0.13},
    {"name": "Parisian Edition de Luxe", "tier": "Tier 1 - Luxury Publisher", "country": "France", "share": 0.11},
    {"name": "London Book & Printworks", "tier": "Tier 2 - Specialty Converter", "country": "UK", "share": 0.10},
    {"name": "Benelux Paper Merchants", "tier": "Tier 3 - Merchant", "country": "Netherlands", "share": 0.09},
]

current_date = START_DATE
for month_idx in range(MONTHS_COUNT):
    year = current_date.year
    month = current_date.month
    month_str = current_date.strftime("%Y-%m")
    
    seasonal_factor = MONTHLY_SEASONAL_INDICES[month]
    trend_factor = 1.0 + (month_idx * MONTHLY_GROWTH)
    
    # Random realistic monthly fluctuation (+/- 2.5%)
    random_factor = random.uniform(0.975, 1.025)
    
    total_month_tonnes = BASE_MONTHLY_TONNAGE * trend_factor * seasonal_factor * random_factor
    month_revenue = 0.0
    
    sku_monthly_volumes = {}
    for p in PRODUCTS:
        sku_tonnes = total_month_tonnes * p["demand_share"] * random.uniform(0.95, 1.05)
        sku_tonnes = round(sku_tonnes, 1)
        sku_rev = sku_tonnes * p["price_per_tonne_eur"]
        month_revenue += sku_rev
        sku_monthly_volumes[p["sku_id"]] = sku_tonnes
        
        # Target ~130 orders/month total across 32 SKUs = ~5,000 orders across 38 months
        # Average boutique order size ~10-20 tonnes
        remaining_sku_tonnes = sku_tonnes
        while remaining_sku_tonnes > 3.0:
            order_tonnes = round(min(remaining_sku_tonnes, random.lognormvariate(3.1, 0.40)), 1)
            order_tonnes = max(4.0, min(48.0, order_tonnes))
            remaining_sku_tonnes -= order_tonnes
            
            cust = random.choices(CUSTOMERS, weights=[c["share"] for c in CUSTOMERS])[0]
            day_in_month = random.randint(1, 28)
            o_date = datetime(year, month, day_in_month)
            d_date = o_date + timedelta(days=random.randint(10, 24))
            
            all_orders.append({
                "order_id": f"ORD-{order_id_counter}",
                "order_date": o_date.strftime("%Y-%m-%d"),
                "delivery_date": d_date.strftime("%Y-%m-%d"),
                "customer_name": cust["name"],
                "customer_tier": cust["tier"],
                "customer_country": cust["country"],
                "sku_id": p["sku_id"],
                "shade_name": p["shade_name"],
                "grammage_gsm": p["grammage_gsm"],
                "format_type": p["format_type"],
                "quantity_tonnes": order_tonnes,
                "revenue_eur": round(order_tonnes * p["price_per_tonne_eur"], 2)
            })
            order_id_counter += 1

    monthly_records.append({
        "month_index": month_idx + 1,
        "month_str": month_str,
        "year": year,
        "month": month,
        "total_tonnes": round(total_month_tonnes, 1),
        "total_revenue_eur": round(month_revenue, 2),
        "seasonal_index": seasonal_factor,
        "trend_baseline_tonnes": round(BASE_MONTHLY_TONNAGE * trend_factor, 1),
        "sku_tonnes": sku_monthly_volumes
    })
    
    # Increment by 1 month
    if month == 12:
        current_date = datetime(year + 1, 1, 1)
    else:
        current_date = datetime(year, month + 1, 1)

# 3. Warehouse Starting Inventory
INVENTORY = []
for p in PRODUCTS:
    avg_monthly = sum(m["sku_tonnes"][p["sku_id"]] for m in monthly_records[-12:]) / 12.0
    # Safety stock target = ~10-14 days of average demand
    target_safety = round(avg_monthly * 0.4, 1)
    on_hand = round(target_safety * random.uniform(0.75, 1.35), 1)
    allocated = round(on_hand * random.uniform(0.2, 0.45), 1)
    available = round(on_hand - allocated, 1)
    
    INVENTORY.append({
        "sku_id": p["sku_id"],
        "brand_line": p["brand_line"],
        "shade_name": p["shade_name"],
        "grammage_gsm": p["grammage_gsm"],
        "format_type": p["format_type"],
        "on_hand_tonnes": on_hand,
        "allocated_tonnes": allocated,
        "available_tonnes": available,
        "safety_stock_target_tonnes": target_safety,
        "stock_status": "Sufficient" if available >= target_safety * 0.7 else "Low"
    })

# 4. Machine Capacity
MACHINE_CAPACITY = [
    {
        "machine_id": "PM1",
        "machine_name": "Paper Machine 1 (Graphic & Book Specialty)",
        "assigned_grammages": "80 - 150 gsm",
        "nominal_deckle_cm": 260,
        "gross_hours_per_month": 720,
        "planned_maintenance_hours": 48,
        "net_operating_hours": 672,
        "hourly_operating_cost_eur": 480.0,  # Client input required
        "broke_cost_per_tonne_eur": 280.0,   # Client input required
        "changeover_broke_tph": 2.4,        # Client input required
        "virgin_fiber_cost_per_tonne_eur": 780.0
    },
    {
        "machine_id": "PM2",
        "machine_name": "Paper Machine 2 (Cover & Heavy Packaging)",
        "assigned_grammages": "240 - 300 gsm",
        "nominal_deckle_cm": 285,
        "gross_hours_per_month": 720,
        "planned_maintenance_hours": 48,
        "net_operating_hours": 672,
        "hourly_operating_cost_eur": 520.0,  # Client input required
        "broke_cost_per_tonne_eur": 280.0,   # Client input required
        "changeover_broke_tph": 2.8,        # Client input required
        "virgin_fiber_cost_per_tonne_eur": 780.0
    }
]

# 5. Changeover Transition Rules
CHANGEOVER_RULES = {
    "base_setup_hours": 0.50,
    "washout_hours": {
        "ultra_light_to_light": 0.0,
        "light_to_medium": 0.0,
        "medium_to_dark": 0.0,
        "same_shade": 0.0,
        "light_to_ultra_light": 1.5,
        "medium_to_light": 2.0,
        "dark_to_light": 3.5,
        "dark_to_ultra_light": 3.5,
        "cross_dark_to_dark": 1.2
    },
    "grammage_step_hours": {
        "same": 0.0,
        "small_step_under_40gsm": 0.50,
        "large_step_over_40gsm": 1.20
    },
    "format_change_hours": {
        "same": 0.0,
        "sheet_dimension_change": 0.75,
        "reel_to_sheet_switch": 1.00
    },
    "broke_rate_tph": 2.4
}

# 6. Active Upcoming Order Book (~40 campaign orders for Sequence Optimization Hero Screen)
# Handcrafted with intentional mix of shades and due dates to test Naive vs. Optimized
UPCOMING_ORDERS = []
campaign_orders_seed = [
    # Customer, SKU index in PRODUCTS, Tonnes, Due In Days, Priority
    ("Nordic Art Editions", 0, 24.0, 14, "High - Strict SLA"),
    ("Stockholm Fine Packaging", 23, 18.5, 20, "Medium"), # Deep Charcoal
    ("Munich Fine Books AG", 1, 32.0, 12, "High - Strict SLA"), # Bright White 100g
    ("Copenhagen Design Print", 5, 22.0, 16, "Standard"), # Natural White 80g
    ("Swiss Luxury Packaging Ltd", 20, 16.0, 18, "High - Strict SLA"), # Forest Green
    ("Parisian Edition de Luxe", 2, 28.0, 15, "High - Strict SLA"), # Bright White 120g
    ("London Book & Printworks", 14, 15.0, 22, "Standard"), # Canary Yellow
    ("Benelux Paper Merchants", 9, 20.0, 24, "Standard"), # Warm Ivory
    ("Stockholm Fine Packaging", 17, 19.5, 19, "Medium"), # Sky Blue
    ("Nordic Art Editions", 3, 26.0, 13, "High - Strict SLA"), # Bright White 640x900
    ("Munich Fine Books AG", 10, 25.0, 25, "Standard"), # Warm Ivory 120g
    ("Parisian Edition de Luxe", 21, 14.0, 21, "Medium"), # Forest Green 640x900
    ("Swiss Luxury Packaging Ltd", 15, 17.0, 23, "Standard"), # Canary Yellow 120g
    ("Copenhagen Design Print", 6, 30.0, 17, "Medium"), # Natural White 100g
    ("Nordic Art Editions", 4, 35.0, 26, "Standard"), # Bright White Reels
    ("London Book & Printworks", 18, 18.0, 28, "Standard"), # Sky Blue 120g
    ("Stockholm Fine Packaging", 24, 21.0, 29, "Standard"), # Deep Charcoal Reels
    ("Munich Fine Books AG", 7, 27.0, 15, "High - Strict SLA"), # Natural White 120g
    ("Benelux Paper Merchants", 12, 19.0, 27, "Standard"), # Chamois 100g
    ("Parisian Edition de Luxe", 13, 22.0, 30, "Standard"), # Chamois 120g
    
    # PM2 Cover orders
    ("Swiss Luxury Packaging Ltd", 25, 20.0, 14, "High - Strict SLA"), # Bright White Cover 240g
    ("Munich Fine Books AG", 31, 16.0, 22, "Medium"), # Charcoal Cover 300g
    ("Nordic Art Editions", 27, 24.0, 16, "High - Strict SLA"), # Natural White Cover 240g
    ("Stockholm Fine Packaging", 30, 18.0, 25, "Standard"), # Green Cover 300g
    ("Parisian Edition de Luxe", 26, 22.0, 19, "High - Strict SLA"), # Bright White Cover 300g
    ("London Book & Printworks", 29, 15.0, 24, "Standard"), # Sky Blue Cover 240g
    ("Copenhagen Design Print", 28, 20.0, 28, "Standard"), # Natural White Cover 300g
]

for idx, (cust_name, p_idx, qty, due_days, priority) in enumerate(campaign_orders_seed, 1):
    p = PRODUCTS[p_idx]
    run_hours = round(qty / p["nominal_speed_tph"], 2)
    UPCOMING_ORDERS.append({
        "order_id": f"CAM-2026-{idx:03d}",
        "customer_name": cust_name,
        "customer_priority": priority,
        "sku_id": p["sku_id"],
        "brand_line": p["brand_line"],
        "shade_name": p["shade_name"],
        "shade_group": p["shade_group"],
        "shade_hex": p["shade_hex"],
        "shade_tier": p["shade_tier"],
        "washout_group": p["washout_group"],
        "grammage_gsm": p["grammage_gsm"],
        "format_type": p["format_type"],
        "sheet_dimensions": p["sheet_dimensions"],
        "assigned_machine": p["assigned_machine"],
        "quantity_tonnes": qty,
        "nominal_speed_tph": p["nominal_speed_tph"],
        "production_hours": run_hours,
        "due_in_days": due_days,
        "order_value_eur": round(qty * p["price_per_tonne_eur"], 2)
    })

# Write JSON output files
with open(os.path.join(OUTPUT_DIR, "products.json"), "w", encoding="utf-8") as f:
    json.dump(PRODUCTS, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "sales_orders_monthly.json"), "w", encoding="utf-8") as f:
    json.dump({
        "metadata": {
            "title": "Lessebo Paper AB - Synthetic Sales History (38 Months)",
            "start_date": "2023-01-01",
            "end_date": "2026-02-28",
            "months_count": MONTHS_COUNT,
            "total_orders_sample_count": len(all_orders),
            "label": "Illustrative / Synthetic — Not actual Lessebo results"
        },
        "monthly_records": monthly_records,
        "sample_orders": all_orders[:350] # Representative sample for UI inspection table
    }, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "current_inventory.json"), "w", encoding="utf-8") as f:
    json.dump(INVENTORY, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "machine_capacity.json"), "w", encoding="utf-8") as f:
    json.dump(MACHINE_CAPACITY, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "changeover_matrix.json"), "w", encoding="utf-8") as f:
    json.dump(CHANGEOVER_RULES, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "upcoming_order_book.json"), "w", encoding="utf-8") as f:
    json.dump(UPCOMING_ORDERS, f, indent=2)

print(f"Generated {len(PRODUCTS)} SKUs")
print(f"Generated {len(monthly_records)} months of sales history")
print(f"Generated {len(all_orders)} synthetic orders total")
last_12_tonnes = sum(m["total_tonnes"] for m in monthly_records[-12:])
last_12_rev = sum(m["total_revenue_eur"] for m in monthly_records[-12:])
print(f"Rolling 12-Month Production: {last_12_tonnes:,.1f} tonnes")
print(f"Rolling 12-Month Revenue: €{last_12_rev:,.2f} (Target €80M - €90M)")
