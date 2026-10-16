"""
FastAPI Server for Google OR-Tools CP-SAT Sequence Optimization.
Illustrative / Synthetic - Not actual Lessebo results.
Client input required for real machine parameters and changeover penalties.
"""

from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import ortools
from model import CpsatSequenceOptimizer, RoutingSequenceOptimizer, MipSequenceOptimizer

app = FastAPI(
    title="Lessebo Paper Multi-Solver Service",
    description="Google OR-Tools (CP-SAT & Routing) and MIP (SCIP) sequence optimization service for paper mill scheduling.",
    version="2.0.0"
)

# Allow CORS from local Vite dev server and common local origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RunItem(BaseModel):
    order_id: str
    production_hours: float
    due_in_days: float = 14.0
    customer_priority: str = "Standard"

class SolveRequest(BaseModel):
    solver_type: str = Field(default="cpsat") # "cpsat" | "routing" | "mip"
    runs: List[RunItem]
    cost_matrix: List[List[float]]
    setup_hours_matrix: List[List[float]]
    initial_setup_costs: List[float]
    initial_setup_hours: List[float]
    hint_sequence: Optional[List[int]] = None
    time_limit_seconds: float = Field(default=4.0, ge=0.01, le=60.0)
    gap_limit: float = Field(default=0.005, ge=0.0)
    random_seed: int = Field(default=42)
    num_workers: int = Field(default=1, ge=1, le=16)
    enforce_hard_due_dates: bool = Field(default=False)

class SolveResponse(BaseModel):
    status: str
    ordered_indices: List[int]
    ordered_order_ids: List[str]
    objective_value_eur: Optional[float]
    total_solver_objective: Optional[float] = None
    best_lower_bound_eur: Optional[float]
    optimality_gap_pct: Optional[float]
    solve_time_ms: float
    run_count: int
    arc_count: int
    due_date_violations: Optional[int]
    message: str

@app.get("/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "solver": "Google OR-Tools & MIP (SCIP)",
        "available_solvers": ["cpsat", "routing", "mip"],
        "ortools_version": ortools.__version__,
        "disclaimer": "Illustrative / Synthetic - Not actual Lessebo results."
    }

@app.post("/solve", response_model=SolveResponse)
def solve_sequence(req: SolveRequest) -> SolveResponse:
    try:
        runs_dict = [r.dict() for r in req.runs]
        solver_type = (req.solver_type or "cpsat").lower().strip()

        if solver_type in ("routing", "ortools_routing", "tsp"):
            optimizer = RoutingSequenceOptimizer(
                runs=runs_dict,
                cost_matrix=req.cost_matrix,
                setup_hours_matrix=req.setup_hours_matrix,
                initial_setup_costs=req.initial_setup_costs,
                initial_setup_hours=req.initial_setup_hours,
                hint_sequence=req.hint_sequence,
                time_limit_seconds=req.time_limit_seconds,
                gap_limit=req.gap_limit,
                random_seed=req.random_seed,
                num_workers=req.num_workers,
                enforce_hard_due_dates=req.enforce_hard_due_dates
            )
        elif solver_type in ("mip", "scip", "integer_programming"):
            optimizer = MipSequenceOptimizer(
                runs=runs_dict,
                cost_matrix=req.cost_matrix,
                setup_hours_matrix=req.setup_hours_matrix,
                initial_setup_costs=req.initial_setup_costs,
                initial_setup_hours=req.initial_setup_hours,
                hint_sequence=req.hint_sequence,
                time_limit_seconds=req.time_limit_seconds,
                gap_limit=req.gap_limit,
                random_seed=req.random_seed,
                num_workers=req.num_workers,
                enforce_hard_due_dates=req.enforce_hard_due_dates
            )
        else:
            optimizer = CpsatSequenceOptimizer(
                runs=runs_dict,
                cost_matrix=req.cost_matrix,
                setup_hours_matrix=req.setup_hours_matrix,
                initial_setup_costs=req.initial_setup_costs,
                initial_setup_hours=req.initial_setup_hours,
                hint_sequence=req.hint_sequence,
                time_limit_seconds=req.time_limit_seconds,
                gap_limit=req.gap_limit,
                random_seed=req.random_seed,
                num_workers=req.num_workers,
                enforce_hard_due_dates=req.enforce_hard_due_dates
            )

        result = optimizer.solve()
        return SolveResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Solver error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
