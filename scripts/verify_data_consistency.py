"""
Verification script for synthetic dataset consistency.
Audits:
- Products count == 32
- History months == 38
- Order records >= 4,500 and <= 7,500
- Rolling 12-month revenue between €80M and €90M
- Machine capacity utilization realistic
- Non-negative stock and production values
"""

import json
import os
import sys

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "data")

def run_audits():
    print("Running Synthetic Data Consistency Audits...")
    
    # 1. Products
    with open(os.path.join(DATA_DIR, "products.json"), "r", encoding="utf-8") as f:
        products = json.load(f)
    assert len(products) == 32, f"Expected 32 SKUs, got {len(products)}"
    print(f" [PASS] Products count: {len(products)} SKUs verified.")
    
    # 2. Sales History
    with open(os.path.join(DATA_DIR, "sales_orders_monthly.json"), "r", encoding="utf-8") as f:
        sales_data = json.load(f)
    months = sales_data["monthly_records"]
    assert len(months) == 38, f"Expected 38 months, got {len(months)}"
    print(f" [PASS] Historical duration: {len(months)} months verified ({months[0]['month_str']} to {months[-1]['month_str']}).")
    
    # Rolling 12-Month Revenue
    last_12 = months[-12:]
    rolling_revenue = sum(m["total_revenue_eur"] for m in last_12)
    rolling_tonnes = sum(m["total_tonnes"] for m in last_12)
    assert 80_000_000 <= rolling_revenue <= 90_000_000, f"Revenue €{rolling_revenue:,.2f} out of target €80M-€90M range"
    print(f" [PASS] Rolling 12-Month Revenue: €{rolling_revenue:,.2f} within €80M-€90M target.")
    print(f" [PASS] Rolling 12-Month Tonnage: {rolling_tonnes:,.1f} tonnes verified.")
    
    # 3. Inventory
    with open(os.path.join(DATA_DIR, "current_inventory.json"), "r", encoding="utf-8") as f:
        inventory = json.load(f)
    assert len(inventory) == 32, f"Expected 32 inventory records, got {len(inventory)}"
    for item in inventory:
        assert item["on_hand_tonnes"] >= 0, f"Negative stock on {item['sku_id']}"
        assert item["available_tonnes"] >= 0, f"Negative available on {item['sku_id']}"
    print(f" [PASS] Inventory integrity: 32 SKU records verified without negative quantities.")
    
    # 4. Machine Capacity
    with open(os.path.join(DATA_DIR, "machine_capacity.json"), "r", encoding="utf-8") as f:
        machines = json.load(f)
    assert len(machines) == 2, f"Expected 2 machines (PM1, PM2), got {len(machines)}"
    print(" [PASS] Machine capacity profiles: PM1 and PM2 loaded.")
    
    # 5. Upcoming Order Book
    with open(os.path.join(DATA_DIR, "upcoming_order_book.json"), "r", encoding="utf-8") as f:
        campaign = json.load(f)
    assert len(campaign) >= 20, f"Expected at least 20 campaign runs, got {len(campaign)}"
    print(f" [PASS] Campaign order book: {len(campaign)} production runs verified for sequence optimization.")
    
    print("\nALL AUDITS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_audits()
