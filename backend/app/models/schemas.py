from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class MatchOutcome(BaseModel):
    winner: Optional[str] = None
    by_runs: Optional[int] = None
    by_wickets: Optional[int] = None
    result: Optional[str] = None  # tie, no result, etc.
    method: Optional[str] = None

class MatchMetadata(BaseModel):
    match_id: str
    season: str
    date: str
    venue: str
    city: Optional[str] = None
    team1: str
    team2: str
    toss_winner: str
    toss_decision: str
    player_of_match: Optional[str] = None
    first_innings_team: str
    second_innings_team: str
    target_runs: int
    scheduled_overs: int = 20
    scheduled_balls: int = 120
    first_innings_total: int
    first_innings_wickets: int
    outcome: MatchOutcome

class WicketEvent(BaseModel):
    player_out: str
    kind: str
    fielders: List[str] = Field(default_factory=list)
    is_wicket: bool = True  # False if retired hurt

class DeliveryEvent(BaseModel):
    delivery_idx: int  # Unique sequential 0-based index across 2nd innings
    over_num: int      # 0 to 19 (or 1 to 20)
    ball_in_over: int  # 1, 2, 3...
    display_over: str  # e.g., "19.1"
    batter: str
    bowler: str
    non_striker: str
    batter_runs: int
    extra_runs: int
    total_runs: int
    is_wide: bool = False
    is_noball: bool = False
    is_bye: bool = False
    is_legbye: bool = False
    is_penalty: bool = False
    is_legal_ball: bool = True
    wickets: List[WicketEvent] = Field(default_factory=list)
    wicket_count_delivery: int = 0  # Number of wickets lost on this delivery
    
    # State accumulated up to and including this delivery
    score: int
    wickets_lost: int
    wickets_remaining: int
    legal_balls_bowled: int
    legal_balls_remaining: int
    target_runs: int
    runs_required: int
    current_run_rate: float
    required_run_rate: float
    is_boundary: bool = False
    is_dot: bool = False
    event_description: str
    
    # Model win probability (chasing team)
    win_probability: Optional[float] = None

class TurningPoint(BaseModel):
    id: str
    match_id: str
    start_delivery_idx: int
    end_delivery_idx: int
    over_label: str  # e.g. "Over 19.1 - 19.6"
    prob_before: float
    prob_after: float
    shift_percentage: float  # e.g. +34.5% or -22.1%
    runs_in_window: int
    wickets_in_window: int
    balls_in_window: int
    supporting_delivery_ids: List[int]
    summary: str
    batters_involved: List[str] = Field(default_factory=list)
    bowler_involved: Optional[str] = None

class ExplainRequest(BaseModel):
    match_id: str
    turning_point_id: str
    custom_prompt: Optional[str] = None

class ExplainResponse(BaseModel):
    turning_point_id: str
    match_id: str
    headline: str
    explanation: str
    takeaway: str
    confidence_notes: Optional[str] = None
    supporting_delivery_ids: List[int]
    verified_evidence: Dict[str, Any]
    source: str = "deterministic_fallback"  # "live_llm" | "precomputed_llm" | "deterministic_fallback"
    llm_metadata: Optional[Dict[str, Any]] = None
    user_question: Optional[str] = None

class MatchReplayResponse(BaseModel):
    metadata: MatchMetadata
    deliveries: List[DeliveryEvent]
    turning_points: List[TurningPoint]

class MatchSummary(BaseModel):
    match_id: str
    title: str
    subtitle: str
    date: str
    venue: str
    first_innings_team: str
    first_innings_score: str
    second_innings_team: str
    second_innings_score: str
    result_text: str
    target: int
    total_deliveries: int
    turning_points_count: int
    key_hero: Optional[str] = None
