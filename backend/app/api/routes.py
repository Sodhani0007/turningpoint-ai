import os
import json
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from ..models.schemas import (
    MatchSummary, MatchMetadata, MatchReplayResponse, TurningPoint,
    ExplainRequest, ExplainResponse, DeliveryEvent
)
from ..services.ml_model import get_ml_model, WinProbabilityModel
from ..services.explainer import get_explainer, ExplanationEngine

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
PRECOMP_DIR = os.path.join(DATA_DIR, "precomputed")

def load_precomputed_replays() -> Dict[str, Any]:
    path = os.path.join(PRECOMP_DIR, "matches_replay.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def load_precomputed_summaries() -> List[Dict[str, Any]]:
    path = os.path.join(PRECOMP_DIR, "matches_summary.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

@router.get("/health")
def get_health(ml_model: WinProbabilityModel = Depends(get_ml_model)):
    metrics_path = os.path.join(DATA_DIR, "model", "model_metrics.json")
    metrics = {}
    if os.path.exists(metrics_path):
        with open(metrics_path, "r") as f:
            metrics = json.load(f)
            
    replays = load_precomputed_replays()
    return {
        "status": "healthy",
        "service": "TurningPoint AI Backend",
        "model_loaded": ml_model.model is not None,
        "available_matches_count": len(replays),
        "model_evaluation_metrics": metrics
    }

@router.get("/matches", response_model=List[MatchSummary])
def get_matches():
    summaries = load_precomputed_summaries()
    if not summaries:
        raise HTTPException(status_code=500, detail="Match summaries not available.")
    return [MatchSummary(**s) for s in summaries]

@router.get("/matches/{match_id}", response_model=MatchMetadata)
def get_match_metadata(match_id: str):
    replays = load_precomputed_replays()
    if match_id not in replays:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")
    return MatchMetadata(**replays[match_id]["metadata"])

@router.get("/matches/{match_id}/replay", response_model=MatchReplayResponse)
def get_match_replay(match_id: str):
    replays = load_precomputed_replays()
    if match_id not in replays:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")
    match_data = replays[match_id]
    return MatchReplayResponse(
        metadata=MatchMetadata(**match_data["metadata"]),
        deliveries=[DeliveryEvent(**d) for d in match_data["deliveries"]],
        turning_points=[TurningPoint(**tp) for tp in match_data["turning_points"]]
    )

@router.get("/matches/{match_id}/turning-points", response_model=List[TurningPoint])
def get_match_turning_points(match_id: str):
    replays = load_precomputed_replays()
    if match_id not in replays:
        raise HTTPException(status_code=404, detail=f"Match '{match_id}' not found.")
    return [TurningPoint(**tp) for tp in replays[match_id]["turning_points"]]

@router.get("/matches/{match_id}/summary", response_model=MatchSummary)
def get_match_summary(match_id: str):
    summaries = load_precomputed_summaries()
    for s in summaries:
        if s["match_id"] == match_id:
            return MatchSummary(**s)
    raise HTTPException(status_code=404, detail=f"Match summary for '{match_id}' not found.")

@router.post("/explain", response_model=ExplainResponse)
async def explain_turning_point(
    req: ExplainRequest,
    explainer: ExplanationEngine = Depends(get_explainer)
):
    replays = load_precomputed_replays()
    if req.match_id not in replays:
        raise HTTPException(status_code=404, detail=f"Match '{req.match_id}' not found.")
    
    match_data = replays[req.match_id]
    tps = [TurningPoint(**tp) for tp in match_data["turning_points"]]
    target_tp = next((t for t in tps if t.id == req.turning_point_id), None)
    
    if not target_tp:
        raise HTTPException(status_code=404, detail=f"Turning point '{req.turning_point_id}' not found in match '{req.match_id}'.")
        
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    metadata = MatchMetadata(**match_data["metadata"])
    
    response = await explainer.explain(
        tp=target_tp,
        deliveries=deliveries,
        metadata=metadata,
        custom_prompt=req.custom_prompt
    )
    return response
