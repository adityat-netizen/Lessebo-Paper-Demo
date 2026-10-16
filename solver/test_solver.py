"""
Unit and validation tests for the CP-SAT model.
Tests small permutations against brute-force optimal and verifies hint reproduction.
"""

import sys
import itertools
from model import CpsatSequenceOptimizer, RoutingSequenceOptimizer, MipSequenceOptimizer

def test_brute_force_small_instance():
    print("Test 1: Brute-force validation on small 5-run instance...")
    runs = [
        {"order_id": f"ORD-{i}", "production_hours": 4.0, "due_in_days": 10, "customer_priority": "Normal"}
        for i in range(5)
    ]
    # Synthetic asymmetric cost matrix
    cost_matrix = [
        [0.0, 120.0, 450.0, 300.0, 200.0],
        [350.0, 0.0, 180.0, 500.0, 100.0],
        [200.0, 400.0, 0.0, 150.0, 350.0],
        [150.0, 250.0, 320.0, 0.0, 180.0],
        [400.0, 120.0, 220.0, 310.0, 0.0],
    ]
    setup_hours = [[c / 100.0 for c in row] for row in cost_matrix]
    initial_costs = [50.0, 100.0, 80.0, 60.0, 120.0]
    initial_hours = [0.5, 0.5, 0.5, 0.5, 0.5]

    # Brute-force permutation search
    best_bf_cost = float("inf")
    best_bf_perm = None
    for perm in itertools.permutations(range(5)):
        cost = initial_costs[perm[0]]
        for idx in range(len(perm) - 1):
            cost += cost_matrix[perm[idx]][perm[idx + 1]]
        if cost < best_bf_cost:
            best_bf_cost = cost
            best_bf_perm = perm

    print(f"  Brute-force optimum: cost={best_bf_cost:.2f}, permutation={best_bf_perm}")

    # 1. CP-SAT
    opt_cp = CpsatSequenceOptimizer(
        runs=runs,
        cost_matrix=cost_matrix,
        setup_hours_matrix=setup_hours,
        initial_setup_costs=initial_costs,
        initial_setup_hours=initial_hours,
        time_limit_seconds=5.0,
        gap_limit=0.0,
        random_seed=42,
        num_workers=1
    )
    res_cp = opt_cp.solve()
    print(f"  CP-SAT result: status={res_cp['status']}, cost={res_cp['objective_value_eur']:.2f}")
    assert res_cp["status"] == "OPTIMAL"
    assert abs(res_cp["objective_value_eur"] - best_bf_cost) < 0.01

    # 2. Routing
    opt_rt = RoutingSequenceOptimizer(
        runs=runs,
        cost_matrix=cost_matrix,
        setup_hours_matrix=setup_hours,
        initial_setup_costs=initial_costs,
        initial_setup_hours=initial_hours,
        time_limit_seconds=4.0,
        random_seed=42
    )
    res_rt = opt_rt.solve()
    print(f"  Routing result: status={res_rt['status']}, cost={res_rt['objective_value_eur']:.2f}")
    assert abs(res_rt["objective_value_eur"] - best_bf_cost) < 0.01

    # 3. MIP (SCIP)
    opt_mip = MipSequenceOptimizer(
        runs=runs,
        cost_matrix=cost_matrix,
        setup_hours_matrix=setup_hours,
        initial_setup_costs=initial_costs,
        initial_setup_hours=initial_hours,
        time_limit_seconds=4.0,
        gap_limit=0.0,
        random_seed=42
    )
    res_mip = opt_mip.solve()
    print(f"  MIP result: status={res_mip['status']}, cost={res_mip['objective_value_eur']:.2f}, bound={res_mip['best_lower_bound_eur']}")
    assert res_mip["status"] == "OPTIMAL"
    assert abs(res_mip["objective_value_eur"] - best_bf_cost) < 0.01

    print("  PASS: All 3 solvers match brute-force mathematical optimum!")

def test_warm_start_never_worse():
    print("\nTest 2: Warm start guarantee (all solvers never worse than hint)...")
    runs = [
        {"order_id": f"ORD-{i}", "production_hours": 3.0, "due_in_days": 14, "customer_priority": "Normal"}
        for i in range(8)
    ]
    import random
    rng = random.Random(123)
    cost_matrix = [[0.0 if i == j else rng.uniform(50.0, 500.0) for j in range(8)] for i in range(8)]
    setup_hours = [[c / 100.0 for c in row] for row in cost_matrix]
    initial_costs = [rng.uniform(30.0, 100.0) for _ in range(8)]
    initial_hours = [0.5 for _ in range(8)]

    # Arbitrary heuristic hint sequence
    hint = [2, 0, 4, 1, 7, 3, 5, 6]
    hint_cost = initial_costs[hint[0]] + sum(cost_matrix[hint[k]][hint[k+1]] for k in range(7))
    print(f"  Hint sequence cost: {hint_cost:.2f}")

    for name, SolverCls in [("CP-SAT", CpsatSequenceOptimizer), ("Routing", RoutingSequenceOptimizer), ("MIP", MipSequenceOptimizer)]:
        opt = SolverCls(
            runs=runs,
            cost_matrix=cost_matrix,
            setup_hours_matrix=setup_hours,
            initial_setup_costs=initial_costs,
            initial_setup_hours=initial_hours,
            hint_sequence=hint,
            time_limit_seconds=4.0,
            gap_limit=0.005,
            random_seed=42,
            num_workers=1
        )
        res = opt.solve()
        print(f"  {name} result: cost={res['objective_value_eur']:.2f}, status={res['status']}")
        assert res["objective_value_eur"] <= hint_cost + 0.01, (
            f"{name} cost ({res['objective_value_eur']}) was worse than hint ({hint_cost})!"
        )

    print("  PASS: Warm start hint preserved or improved across all 3 solvers!")

if __name__ == "__main__":
    test_brute_force_small_instance()
    test_warm_start_never_worse()
    print("\nAll solver unit tests passed successfully!")
