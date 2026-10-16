"""
Google OR-Tools CP-SAT Sequence Optimizer for Lessebo Paper AB.
Illustrative / Synthetic - Not actual Lessebo results.
Client input required for real machine parameters and changeover penalties.
"""

from typing import List, Dict, Any, Optional, Tuple
import time

try:
    import pandas as pd
except Exception:
    import sys
    import types
    p = types.ModuleType("pandas")
    p.Index = object
    p.Series = object
    p.DataFrame = object
    p.__version__ = "stub"
    sys.modules["pandas"] = p

from ortools.sat.python import cp_model
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from ortools.linear_solver import pywraplp

class CpsatSequenceOptimizer:
    def __init__(
        self,
        runs: List[Dict[str, Any]],
        cost_matrix: List[List[float]],
        setup_hours_matrix: List[List[float]],
        initial_setup_costs: List[float],
        initial_setup_hours: List[float],
        hint_sequence: Optional[List[int]] = None,
        time_limit_seconds: float = 3.0,
        gap_limit: float = 0.005,
        random_seed: int = 42,
        num_workers: int = 1,
        enforce_hard_due_dates: bool = False,
    ):
        """
        runs: list of order dicts with keys: order_id, production_hours, due_in_days, customer_priority
        cost_matrix[i][j]: transition cost (in EUR) from run i to run j (0-indexed runs 0..N-1)
        setup_hours_matrix[i][j]: changeover duration (in hours) from run i to run j
        initial_setup_costs[j]: cost (EUR) from clean start to run j
        initial_setup_hours[j]: hours from clean start to run j
        hint_sequence: 0-indexed order of runs from Rule-based Hybrid heuristic
        """
        self.runs = runs
        self.n = len(runs)
        self.cost_matrix = cost_matrix
        self.setup_hours_matrix = setup_hours_matrix
        self.initial_setup_costs = initial_setup_costs
        self.initial_setup_hours = initial_setup_hours
        self.hint_sequence = hint_sequence
        self.time_limit_seconds = max(0.01, float(time_limit_seconds))
        self.gap_limit = max(0.0, float(gap_limit))
        self.random_seed = int(random_seed)
        self.num_workers = max(1, int(num_workers))
        self.enforce_hard_due_dates = bool(enforce_hard_due_dates)

    def solve(self) -> Dict[str, Any]:
        start_wall_time = time.time()

        if self.n == 0:
            return {
                "status": "OPTIMAL",
                "ordered_indices": [],
                "ordered_order_ids": [],
                "objective_value_eur": 0.0,
                "best_lower_bound_eur": 0.0,
                "optimality_gap_pct": 0.0,
                "solve_time_ms": 0.0,
                "run_count": 0,
                "arc_count": 0,
                "due_date_violations": 0,
                "message": "Empty run list"
            }

        if self.n == 1:
            initial_cost = self.initial_setup_costs[0] if self.initial_setup_costs else 0.0
            return {
                "status": "OPTIMAL",
                "ordered_indices": [0],
                "ordered_order_ids": [self.runs[0]["order_id"]],
                "objective_value_eur": round(initial_cost, 2),
                "best_lower_bound_eur": round(initial_cost, 2),
                "optimality_gap_pct": 0.0,
                "solve_time_ms": round((time.time() - start_wall_time) * 1000, 2),
                "run_count": 1,
                "arc_count": 1,
                "due_date_violations": 0,
                "message": "Single run trivial schedule"
            }

        model = cp_model.CpModel()

        # Nodes: 0 is dummy start/end node.
        # Nodes 1..N map to runs 0..N-1.
        node_count = self.n + 1

        # Arc literals for circuit constraint
        # arc tuple: (tail, head, literal)
        circuit_arcs = []
        arc_literals: Dict[Tuple[int, int], cp_model.IntVar] = {}
        arc_costs: Dict[Tuple[int, int], int] = {}
        arc_setup_tenths: Dict[Tuple[int, int], int] = {}

        # 1. Arcs from Dummy Node 0 to Run Nodes 1..N
        for j in range(1, node_count):
            run_idx = j - 1
            lit = model.NewBoolVar(f"arc_0_{j}")
            circuit_arcs.append((0, j, lit))
            arc_literals[(0, j)] = lit
            # Cost in cents (EUR * 100)
            cost_cents = int(round(self.initial_setup_costs[run_idx] * 100))
            setup_tenths = int(round(self.initial_setup_hours[run_idx] * 10))
            arc_costs[(0, j)] = cost_cents
            arc_setup_tenths[(0, j)] = setup_tenths

        # 2. Arcs from Run Nodes 1..N back to Dummy Node 0 (closing circuit)
        for i in range(1, node_count):
            lit = model.NewBoolVar(f"arc_{i}_0")
            circuit_arcs.append((i, 0, lit))
            arc_literals[(i, 0)] = lit
            arc_costs[(i, 0)] = 0
            arc_setup_tenths[(i, 0)] = 0

        # 3. Arcs between Run Nodes i and j (i != j)
        for i in range(1, node_count):
            for j in range(1, node_count):
                if i == j:
                    continue
                u = i - 1
                v = j - 1
                lit = model.NewBoolVar(f"arc_{i}_{j}")
                circuit_arcs.append((i, j, lit))
                arc_literals[(i, j)] = lit
                cost_cents = int(round(self.cost_matrix[u][v] * 100))
                setup_tenths = int(round(self.setup_hours_matrix[u][v] * 10))
                arc_costs[(i, j)] = cost_cents
                arc_setup_tenths[(i, j)] = setup_tenths

        # Add Circuit Constraint
        model.AddCircuit(circuit_arcs)

        # 4. Scheduling & Completion Time Variables (in tenths of an hour)
        # Calculate maximum possible schedule span for domain upper bound
        max_duration_tenths = int(round(
            sum(r.get("production_hours", 0) for r in self.runs) * 10 +
            sum(max(row) if row else 10 for row in self.setup_hours_matrix) * 10 + 2000
        ))

        start_times = {}
        completion_times = {}
        lateness_vars = {}

        for j in range(1, node_count):
            u = j - 1
            prod_tenths = int(round(self.runs[u].get("production_hours", 0) * 10))
            s_var = model.NewIntVar(0, max_duration_tenths, f"start_{j}")
            c_var = model.NewIntVar(0, max_duration_tenths, f"comp_{j}")
            model.Add(c_var == s_var + prod_tenths)
            start_times[j] = s_var
            completion_times[j] = c_var

            # Due date in tenths of hours
            due_days = self.runs[u].get("due_in_days", 14)
            due_tenths = int(round(due_days * 24 * 10))
            is_strict = "Strict" in self.runs[u].get("customer_priority", "") or due_days <= 13

            if self.enforce_hard_due_dates and is_strict:
                model.Add(c_var <= due_tenths)
            else:
                late_var = model.NewIntVar(0, max_duration_tenths, f"late_{j}")
                model.Add(late_var >= c_var - due_tenths)
                lateness_vars[j] = (late_var, is_strict)

        # Precedence / Time-linking constraints across selected arcs
        for (tail, head), lit in arc_literals.items():
            setup = arc_setup_tenths[(tail, head)]
            if tail == 0:
                # From dummy start
                model.Add(start_times[head] >= setup).OnlyEnforceIf(lit)
            elif head == 0:
                # To dummy end (no next run)
                pass
            else:
                # From tail to head
                model.Add(start_times[head] >= completion_times[tail] + setup).OnlyEnforceIf(lit)

        # 5. Objective Function: Transition Cost + Soft Due-Date Penalties
        objective_terms = []

        # Arc transition costs
        for (u, v), lit in arc_literals.items():
            c = arc_costs[(u, v)]
            if c != 0:
                objective_terms.append(c * lit)

        # Soft due date penalties:
        # 1 day late = 240 tenths. Lateness penalty per tenth:
        # Standard: 20 cents/tenth (= 48 EUR/day late)
        # Strict: 200 cents/tenth (= 480 EUR/day late, higher than any transition saving)
        for j, (late_var, is_strict) in lateness_vars.items():
            penalty_per_tenth = 200 if is_strict else 20
            objective_terms.append(penalty_per_tenth * late_var)

        model.Minimize(cp_model.LinearExpr.Sum(objective_terms))

        # 6. Warm Start / Solution Hint from Rule-based Hybrid heuristic
        if self.hint_sequence and len(self.hint_sequence) == self.n:
            # Hint 0 -> first run
            first_node = self.hint_sequence[0] + 1
            if (0, first_node) in arc_literals:
                model.AddHint(arc_literals[(0, first_node)], 1)

            # Hint between runs
            for idx in range(len(self.hint_sequence) - 1):
                tail_node = self.hint_sequence[idx] + 1
                head_node = self.hint_sequence[idx + 1] + 1
                if (tail_node, head_node) in arc_literals:
                    model.AddHint(arc_literals[(tail_node, head_node)], 1)

            # Hint last run -> 0
            last_node = self.hint_sequence[-1] + 1
            if (last_node, 0) in arc_literals:
                model.AddHint(arc_literals[(last_node, 0)], 1)

        # 7. Configure Solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.time_limit_seconds
        solver.parameters.relative_gap_limit = self.gap_limit
        solver.parameters.random_seed = self.random_seed
        solver.parameters.num_workers = self.num_workers

        # Solve
        status_code = solver.Solve(model)
        solve_time_ms = round((time.time() - start_wall_time) * 1000, 2)

        status_map = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "TIMED_OUT",
        }
        status_str = status_map.get(status_code, "UNKNOWN")

        if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            # Extract sequence from circuit
            next_node = {}
            for (u, v), lit in arc_literals.items():
                if solver.Value(lit) == 1:
                    next_node[u] = v

            ordered_indices = []
            curr = next_node.get(0, None)
            visited = set()
            while curr is not None and curr != 0 and curr not in visited:
                visited.add(curr)
                ordered_indices.append(curr - 1)
                curr = next_node.get(curr, None)

            # Check if all runs visited
            if len(ordered_indices) != self.n:
                # Fallback to hint or natural if circuit extraction hiccup
                ordered_indices = self.hint_sequence if self.hint_sequence else list(range(self.n))

            ordered_order_ids = [self.runs[idx]["order_id"] for idx in ordered_indices]

            # Best lower bound in EUR
            best_bound_cents = solver.BestObjectiveBound()
            best_bound_eur = round(best_bound_cents / 100.0, 2)

            # Solver objective value in EUR (transition costs only or total with soft penalties)
            # Reconstruct transition-only cost from the selected arcs
            transition_cost_cents = sum(
                arc_costs[(u, v)] for (u, v), lit in arc_literals.items() if solver.Value(lit) == 1
            )
            transition_cost_eur = round(transition_cost_cents / 100.0, 2)

            # Optimality gap
            obj_val = solver.ObjectiveValue()
            if status_code == cp_model.OPTIMAL:
                gap_pct = 0.0
            elif obj_val > 0 and best_bound_cents >= 0:
                gap_pct = round(max(0.0, (obj_val - best_bound_cents) / obj_val) * 100.0, 2)
            else:
                gap_pct = 0.0

            # Count due date violations
            due_violations = 0
            for j in range(1, node_count):
                u = j - 1
                c_val = solver.Value(completion_times[j])
                due_val = int(round(self.runs[u].get("due_in_days", 14) * 24 * 10))
                if c_val > due_val:
                    due_violations += 1

            return {
                "status": status_str,
                "ordered_indices": ordered_indices,
                "ordered_order_ids": ordered_order_ids,
                "objective_value_eur": transition_cost_eur,
                "total_solver_objective": round(obj_val / 100.0, 2),
                "best_lower_bound_eur": best_bound_eur,
                "optimality_gap_pct": gap_pct,
                "solve_time_ms": solve_time_ms,
                "run_count": self.n,
                "arc_count": len(circuit_arcs),
                "due_date_violations": due_violations,
                "message": f"Solved successfully ({status_str})"
            }
        else:
            # Fall back to hint sequence
            fallback_indices = self.hint_sequence if self.hint_sequence else list(range(self.n))
            fallback_ids = [self.runs[idx]["order_id"] for idx in fallback_indices]
            return {
                "status": status_str,
                "ordered_indices": fallback_indices,
                "ordered_order_ids": fallback_ids,
                "objective_value_eur": None,
                "best_lower_bound_eur": None,
                "optimality_gap_pct": None,
                "solve_time_ms": solve_time_ms,
                "run_count": self.n,
                "arc_count": len(circuit_arcs),
                "due_date_violations": None,
                "message": f"Solver returned {status_str}; fallback to rule-based sequence applied"
            }


class RoutingSequenceOptimizer:
    """
    Google OR-Tools Routing Solver for paper machine sequencing.
    Formulates open-path ATSP with depot node 0, transit callbacks,
    time dimension with soft due-date upper bounds, and warm-started with Hybrid sequence.
    Dual lower bound is not available (metaheuristic local search).
    """
    def __init__(
        self,
        runs: List[Dict[str, Any]],
        cost_matrix: List[List[float]],
        setup_hours_matrix: List[List[float]],
        initial_setup_costs: List[float],
        initial_setup_hours: List[float],
        hint_sequence: Optional[List[int]] = None,
        time_limit_seconds: float = 4.0,
        gap_limit: float = 0.005,
        random_seed: int = 42,
        num_workers: int = 1,
        enforce_hard_due_dates: bool = False,
    ):
        self.runs = runs
        self.n = len(runs)
        self.cost_matrix = cost_matrix
        self.setup_hours_matrix = setup_hours_matrix
        self.initial_setup_costs = initial_setup_costs
        self.initial_setup_hours = initial_setup_hours
        self.hint_sequence = hint_sequence
        self.time_limit_seconds = max(0.01, float(time_limit_seconds))
        self.gap_limit = max(0.0, float(gap_limit))
        self.random_seed = int(random_seed)
        self.num_workers = max(1, int(num_workers))
        self.enforce_hard_due_dates = bool(enforce_hard_due_dates)

    def solve(self) -> Dict[str, Any]:
        start_wall_time = time.time()

        if self.n == 0:
            return {
                "status": "OPTIMAL",
                "ordered_indices": [],
                "ordered_order_ids": [],
                "objective_value_eur": 0.0,
                "best_lower_bound_eur": None,
                "optimality_gap_pct": None,
                "solve_time_ms": 0.0,
                "run_count": 0,
                "arc_count": 0,
                "due_date_violations": 0,
                "message": "Empty run list"
            }

        if self.n == 1:
            initial_cost = self.initial_setup_costs[0] if self.initial_setup_costs else 0.0
            return {
                "status": "OPTIMAL",
                "ordered_indices": [0],
                "ordered_order_ids": [self.runs[0]["order_id"]],
                "objective_value_eur": round(initial_cost, 2),
                "best_lower_bound_eur": None,
                "optimality_gap_pct": None,
                "solve_time_ms": round((time.time() - start_wall_time) * 1000, 2),
                "run_count": 1,
                "arc_count": 1,
                "due_date_violations": 0,
                "message": "Single run trivial schedule"
            }

        node_count = self.n + 1
        manager = pywrapcp.RoutingIndexManager(node_count, 1, 0)
        routing = pywrapcp.RoutingModel(manager)

        # Transit callback: cost in integer cents (EUR * 100)
        def distance_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            if from_node == 0:
                if to_node == 0:
                    return 0
                return int(round(self.initial_setup_costs[to_node - 1] * 100))
            elif to_node == 0:
                return 0
            else:
                return int(round(self.cost_matrix[from_node - 1][to_node - 1] * 100))

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Time dimension for completion times & soft due dates (in tenths of an hour)
        def time_callback(from_index: int, to_index: int) -> int:
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            if from_node == 0:
                if to_node == 0:
                    return 0
                u = to_node - 1
                setup_tenths = int(round(self.initial_setup_hours[u] * 10))
                prod_tenths = int(round(self.runs[u].get("production_hours", 0) * 10))
                return setup_tenths + prod_tenths
            elif to_node == 0:
                return 0
            else:
                u = from_node - 1
                v = to_node - 1
                setup_tenths = int(round(self.setup_hours_matrix[u][v] * 10))
                prod_tenths = int(round(self.runs[v].get("production_hours", 0) * 10))
                return setup_tenths + prod_tenths

        time_callback_index = routing.RegisterTransitCallback(time_callback)
        max_horizon_tenths = int(round(
            sum(r.get("production_hours", 0) for r in self.runs) * 10 +
            sum(max(row) if row else 10 for row in self.setup_hours_matrix) * 10 + 2000
        ))
        routing.AddDimension(
            time_callback_index,
            0,
            max_horizon_tenths,
            True,
            "Time"
        )
        time_dimension = routing.GetDimensionOrDie("Time")

        for j in range(1, node_count):
            node_idx = manager.NodeToIndex(j)
            u = j - 1
            due_days = self.runs[u].get("due_in_days", 14)
            due_tenths = int(round(due_days * 24 * 10))
            is_strict = "Strict" in self.runs[u].get("customer_priority", "") or due_days <= 13
            penalty_coeff = 200 if is_strict else 20
            time_dimension.SetCumulVarSoftUpperBound(node_idx, due_tenths, penalty_coeff)

        initial_assignment = None
        if self.hint_sequence and len(self.hint_sequence) == self.n:
            route = [r + 1 for r in self.hint_sequence]
            try:
                initial_assignment = routing.ReadAssignmentFromRoutes([route], True)
            except Exception:
                initial_assignment = None

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.time_limit.seconds = max(1, int(self.time_limit_seconds))
        search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC

        if initial_assignment:
            solution = routing.SolveFromAssignmentWithParameters(initial_assignment, search_parameters)
        else:
            solution = routing.SolveWithParameters(search_parameters)

        solve_time_ms = round((time.time() - start_wall_time) * 1000, 2)

        if solution:
            ordered_indices = []
            curr = routing.Start(0)
            while not routing.IsEnd(curr):
                node = manager.IndexToNode(curr)
                if node != 0:
                    ordered_indices.append(node - 1)
                curr = solution.Value(routing.NextVar(curr))

            if len(ordered_indices) != self.n:
                ordered_indices = self.hint_sequence if self.hint_sequence else list(range(self.n))

            trans_cost_cents = 0
            if ordered_indices:
                trans_cost_cents += int(round(self.initial_setup_costs[ordered_indices[0]] * 100))
                for k in range(len(ordered_indices) - 1):
                    u = ordered_indices[k]
                    v = ordered_indices[k + 1]
                    trans_cost_cents += int(round(self.cost_matrix[u][v] * 100))
            transition_cost_eur = round(trans_cost_cents / 100.0, 2)

            due_violations = 0
            for idx in ordered_indices:
                node_idx = manager.NodeToIndex(idx + 1)
                c_val = solution.Value(time_dimension.CumulVar(node_idx))
                due_val = int(round(self.runs[idx].get("due_in_days", 14) * 24 * 10))
                if c_val > due_val:
                    due_violations += 1

            return {
                "status": "OPTIMAL" if routing.status() == 1 else "FEASIBLE",
                "ordered_indices": ordered_indices,
                "ordered_order_ids": [self.runs[idx]["order_id"] for idx in ordered_indices],
                "objective_value_eur": transition_cost_eur,
                "total_solver_objective": round(solution.ObjectiveValue() / 100.0, 2),
                "best_lower_bound_eur": None,
                "optimality_gap_pct": None,
                "solve_time_ms": solve_time_ms,
                "run_count": self.n,
                "arc_count": self.n * (self.n + 1),
                "due_date_violations": due_violations,
                "message": "Solved successfully (OR-Tools Routing Solver)"
            }
        else:
            fallback_indices = self.hint_sequence if self.hint_sequence else list(range(self.n))
            fallback_ids = [self.runs[idx]["order_id"] for idx in fallback_indices]
            return {
                "status": "TIMED_OUT",
                "ordered_indices": fallback_indices,
                "ordered_order_ids": fallback_ids,
                "objective_value_eur": None,
                "best_lower_bound_eur": None,
                "optimality_gap_pct": None,
                "solve_time_ms": solve_time_ms,
                "run_count": self.n,
                "arc_count": self.n * (self.n + 1),
                "due_date_violations": None,
                "message": "Routing solver timed out; fallback to rule-based sequence applied"
            }


class MipSequenceOptimizer:
    """
    Mixed-Integer Programming (MIP) Sequence Optimizer using SCIP backend.
    Formulates open-path ATSP with Miller-Tucker-Zemlin (MTZ) subtour elimination & time linking,
    soft due dates with slack variables, and warm start from Hybrid sequence via SetHint.
    Discloses mathematical dual lower bound from SCIP branch-and-cut tree.
    """
    def __init__(
        self,
        runs: List[Dict[str, Any]],
        cost_matrix: List[List[float]],
        setup_hours_matrix: List[List[float]],
        initial_setup_costs: List[float],
        initial_setup_hours: List[float],
        hint_sequence: Optional[List[int]] = None,
        time_limit_seconds: float = 4.0,
        gap_limit: float = 0.005,
        random_seed: int = 42,
        num_workers: int = 1,
        enforce_hard_due_dates: bool = False,
    ):
        self.runs = runs
        self.n = len(runs)
        self.cost_matrix = cost_matrix
        self.setup_hours_matrix = setup_hours_matrix
        self.initial_setup_costs = initial_setup_costs
        self.initial_setup_hours = initial_setup_hours
        self.hint_sequence = hint_sequence
        self.time_limit_seconds = max(0.01, float(time_limit_seconds))
        self.gap_limit = max(0.0, float(gap_limit))
        self.random_seed = int(random_seed)
        self.num_workers = max(1, int(num_workers))
        self.enforce_hard_due_dates = bool(enforce_hard_due_dates)

    def solve(self) -> Dict[str, Any]:
        start_wall_time = time.time()

        if self.n == 0:
            return {
                "status": "OPTIMAL",
                "ordered_indices": [],
                "ordered_order_ids": [],
                "objective_value_eur": 0.0,
                "best_lower_bound_eur": 0.0,
                "optimality_gap_pct": 0.0,
                "solve_time_ms": 0.0,
                "run_count": 0,
                "arc_count": 0,
                "due_date_violations": 0,
                "message": "Empty run list"
            }

        if self.n == 1:
            initial_cost = self.initial_setup_costs[0] if self.initial_setup_costs else 0.0
            return {
                "status": "OPTIMAL",
                "ordered_indices": [0],
                "ordered_order_ids": [self.runs[0]["order_id"]],
                "objective_value_eur": round(initial_cost, 2),
                "best_lower_bound_eur": round(initial_cost, 2),
                "optimality_gap_pct": 0.0,
                "solve_time_ms": round((time.time() - start_wall_time) * 1000, 2),
                "run_count": 1,
                "arc_count": 1,
                "due_date_violations": 0,
                "message": "Single run trivial schedule"
            }

        solver = pywraplp.Solver.CreateSolver("SCIP")
        if not solver:
            solver = pywraplp.Solver.CreateSolver("CBC") or pywraplp.Solver.CreateSolver("GLOP")

        node_count = self.n + 1

        x: Dict[Tuple[int, int], pywraplp.Variable] = {}
        arc_costs: Dict[Tuple[int, int], float] = {}

        # 1. Depot to runs
        for j in range(1, node_count):
            x[(0, j)] = solver.BoolVar(f"x_0_{j}")
            arc_costs[(0, j)] = self.initial_setup_costs[j - 1]

        # 2. Runs to depot (open tour)
        for i in range(1, node_count):
            x[(i, 0)] = solver.BoolVar(f"x_{i}_0")
            arc_costs[(i, 0)] = 0.0

        # 3. Between runs
        for i in range(1, node_count):
            for j in range(1, node_count):
                if i != j:
                    x[(i, j)] = solver.BoolVar(f"x_{i}_{j}")
                    arc_costs[(i, j)] = self.cost_matrix[i - 1][j - 1]

        # Flow conservation
        solver.Add(sum(x[(0, j)] for j in range(1, node_count)) == 1)
        solver.Add(sum(x[(i, 0)] for i in range(1, node_count)) == 1)

        for k in range(1, node_count):
            solver.Add(x[(0, k)] + sum(x[(i, k)] for i in range(1, node_count) if i != k) == 1)
            solver.Add(x[(k, 0)] + sum(x[(k, j)] for j in range(1, node_count) if j != k) == 1)

        # Completion times & MTZ subtour elimination
        max_horizon_hours = (
            sum(r.get("production_hours", 0) for r in self.runs) +
            sum(max(row) if row else 10 for row in self.setup_hours_matrix) + 200.0
        )
        t = {j: solver.NumVar(0, max_horizon_hours, f"t_{j}") for j in range(1, node_count)}
        l = {j: solver.NumVar(0, max_horizon_hours, f"l_{j}") for j in range(1, node_count)}

        big_m = max_horizon_hours

        for j in range(1, node_count):
            u = j - 1
            init_h = self.initial_setup_hours[u]
            prod_h = self.runs[u].get("production_hours", 0)
            solver.Add(t[j] >= init_h + prod_h - big_m * (1 - x[(0, j)]))

            due_h = self.runs[u].get("due_in_days", 14) * 24.0
            is_strict = "Strict" in self.runs[u].get("customer_priority", "") or self.runs[u].get("due_in_days", 14) <= 13
            if self.enforce_hard_due_dates and is_strict:
                solver.Add(t[j] <= due_h)
            else:
                solver.Add(l[j] >= t[j] - due_h)

        for i in range(1, node_count):
            for j in range(1, node_count):
                if i != j:
                    u = i - 1
                    v = j - 1
                    setup_h = self.setup_hours_matrix[u][v]
                    prod_h = self.runs[v].get("production_hours", 0)
                    solver.Add(t[j] >= t[i] + setup_h + prod_h - big_m * (1 - x[(i, j)]))

        obj = solver.Objective()
        obj.SetMinimization()

        for (u, v), var in x.items():
            cost = arc_costs[(u, v)]
            if cost > 0:
                obj.SetCoefficient(var, cost)

        for j in range(1, node_count):
            u = j - 1
            is_strict = "Strict" in self.runs[u].get("customer_priority", "") or self.runs[u].get("due_in_days", 14) <= 13
            penalty_eur_per_hour = 20.0 if is_strict else 2.0
            obj.SetCoefficient(l[j], penalty_eur_per_hour)

        # Warm start
        if self.hint_sequence and len(self.hint_sequence) == self.n:
            hint_vars = []
            hint_vals = []
            first_node = self.hint_sequence[0] + 1
            if (0, first_node) in x:
                hint_vars.append(x[(0, first_node)])
                hint_vals.append(1.0)
            for idx in range(len(self.hint_sequence) - 1):
                tail_node = self.hint_sequence[idx] + 1
                head_node = self.hint_sequence[idx + 1] + 1
                if (tail_node, head_node) in x:
                    hint_vars.append(x[(tail_node, head_node)])
                    hint_vals.append(1.0)
            last_node = self.hint_sequence[-1] + 1
            if (last_node, 0) in x:
                hint_vars.append(x[(last_node, 0)])
                hint_vals.append(1.0)

            try:
                solver.SetHint(hint_vars, hint_vals)
            except Exception:
                pass

        solver.SetTimeLimit(int(self.time_limit_seconds * 1000))
        try:
            solver.SetSolverSpecificParametersAsString(f"limits/gap = {self.gap_limit}")
        except Exception:
            pass

        result_status = solver.Solve()
        solve_time_ms = round((time.time() - start_wall_time) * 1000, 2)

        status_map = {
            pywraplp.Solver.OPTIMAL: "OPTIMAL",
            pywraplp.Solver.FEASIBLE: "FEASIBLE",
            pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
            pywraplp.Solver.UNBOUNDED: "UNBOUNDED",
            pywraplp.Solver.ABNORMAL: "TIMED_OUT",
            pywraplp.Solver.NOT_SOLVED: "TIMED_OUT",
        }
        status_str = status_map.get(result_status, "UNKNOWN")

        if result_status in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
            next_node = {}
            for (u, v), var in x.items():
                if var.solution_value() > 0.5:
                    next_node[u] = v

            ordered_indices = []
            curr = next_node.get(0, None)
            visited = set()
            while curr is not None and curr != 0 and curr not in visited:
                visited.add(curr)
                ordered_indices.append(curr - 1)
                curr = next_node.get(curr, None)

            if len(ordered_indices) != self.n:
                ordered_indices = self.hint_sequence if self.hint_sequence else list(range(self.n))

            transition_cost_eur = round(sum(
                arc_costs[(u, v)] for (u, v), var in x.items() if var.solution_value() > 0.5
            ), 2)

            best_bound_eur = round(obj.BestBound(), 2)
            obj_val = round(obj.Value(), 2)

            if result_status == pywraplp.Solver.OPTIMAL:
                gap_pct = 0.0
            elif obj_val > 0 and best_bound_eur >= 0:
                gap_pct = round(max(0.0, (obj_val - best_bound_eur) / obj_val) * 100.0, 2)
            else:
                gap_pct = 0.0

            due_violations = 0
            for j in range(1, node_count):
                u = j - 1
                c_val = t[j].solution_value()
                due_val = self.runs[u].get("due_in_days", 14) * 24.0
                if c_val > due_val:
                    due_violations += 1

            return {
                "status": status_str,
                "ordered_indices": ordered_indices,
                "ordered_order_ids": [self.runs[idx]["order_id"] for idx in ordered_indices],
                "objective_value_eur": transition_cost_eur,
                "total_solver_objective": obj_val,
                "best_lower_bound_eur": best_bound_eur,
                "optimality_gap_pct": gap_pct,
                "solve_time_ms": solve_time_ms,
                "run_count": self.n,
                "arc_count": len(x),
                "due_date_violations": due_violations,
                "message": f"Solved successfully (MIP - SCIP {status_str})"
            }
        else:
            fallback_indices = self.hint_sequence if self.hint_sequence else list(range(self.n))
            fallback_ids = [self.runs[idx]["order_id"] for idx in fallback_indices]
            return {
                "status": status_str,
                "ordered_indices": fallback_indices,
                "ordered_order_ids": fallback_ids,
                "objective_value_eur": None,
                "best_lower_bound_eur": None,
                "optimality_gap_pct": None,
                "solve_time_ms": solve_time_ms,
                "run_count": self.n,
                "arc_count": len(x),
                "due_date_violations": None,
                "message": f"MIP solver returned {status_str}; fallback to rule-based sequence applied"
            }
