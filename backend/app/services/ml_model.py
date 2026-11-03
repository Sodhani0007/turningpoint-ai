import os
import json
import joblib
import pandas as pd
from typing import List, Optional
from ..models.schemas import DeliveryEvent, MatchMetadata

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "model", "win_probability_model.joblib"
)
SCHEMA_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "model", "feature_schema.json"
)

FEATURE_COLS = [
    "target_runs",
    "score",
    "wickets_lost",
    "legal_balls_bowled",
    "balls_remaining",
    "runs_required",
    "current_run_rate",
    "required_run_rate",
    "wickets_remaining",
    "recent_run_rate",
]

class WinProbabilityModel:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or MODEL_PATH
        self.model = None
        self._load_model()
        
    def _load_model(self):
        if os.path.exists(self.model_path):
            self.model = joblib.load(self.model_path)
        else:
            self.model = None

    def compute_features(
        self,
        delivery: DeliveryEvent,
        recent_run_rate: float
    ) -> dict:
        rrr_capped = min(36.0, delivery.required_run_rate)
        return {
            "target_runs": delivery.target_runs,
            "score": delivery.score,
            "wickets_lost": delivery.wickets_lost,
            "legal_balls_bowled": delivery.legal_balls_bowled,
            "balls_remaining": delivery.legal_balls_remaining,
            "runs_required": delivery.runs_required,
            "current_run_rate": delivery.current_run_rate,
            "required_run_rate": rrr_capped,
            "wickets_remaining": delivery.wickets_remaining,
            "recent_run_rate": recent_run_rate,
        }

    def predict_delivery_probabilities(
        self,
        deliveries: List[DeliveryEvent],
        metadata: MatchMetadata
    ) -> List[DeliveryEvent]:
        if not self.model:
            raise RuntimeError(f"ML Model not loaded from {self.model_path}")
            
        recent_runs_window: List[int] = []
        feature_rows = []
        indices_to_predict = []
        
        for idx, d in enumerate(deliveries):
            # Terminal states assignment
            if d.score >= d.target_runs:
                # Target reached -> 100% win for chasing team
                d.win_probability = 1.0
                continue
            if d.wickets_lost >= 10:
                # All out -> 0% win
                d.win_probability = 0.0
                continue
            if d.legal_balls_remaining == 0:
                # Balls exhausted -> 0% win if score < target
                d.win_probability = 0.0
                continue
                
            # Track recent run rate (last 12 legal deliveries)
            if d.is_legal_ball:
                recent_runs_window.append(d.total_runs)
                if len(recent_runs_window) > 12:
                    recent_runs_window.pop(0)
            else:
                if recent_runs_window:
                    recent_runs_window[-1] += d.total_runs
                    
            recent_rr = (sum(recent_runs_window) / len(recent_runs_window)) * 6.0 if recent_runs_window else d.current_run_rate
            
            row = self.compute_features(d, recent_run_rate=round(recent_rr, 2))
            feature_rows.append(row)
            indices_to_predict.append(idx)
            
        if feature_rows:
            X_df = pd.DataFrame(feature_rows)[FEATURE_COLS]
            probs = self.model.predict_proba(X_df)[:, 1]
            
            for list_idx, prob in zip(indices_to_predict, probs):
                # Clamp strictly within [0.001, 0.999] for non-terminal states
                clamped_prob = max(0.001, min(0.999, float(prob)))
                deliveries[list_idx].win_probability = round(clamped_prob, 4)
                
        # Ensure final ball matches actual match outcome
        if deliveries:
            last = deliveries[-1]
            if metadata.outcome.winner == metadata.second_innings_team:
                last.win_probability = 1.0
            else:
                last.win_probability = 0.0
                
        return deliveries

# Global singleton
_model_instance = None

def get_ml_model() -> WinProbabilityModel:
    global _model_instance
    if _model_instance is None:
        _model_instance = WinProbabilityModel()
    return _model_instance
