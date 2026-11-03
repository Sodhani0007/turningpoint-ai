import json
import os
import pytest
from backend.app.services.parser import parse_cricsheet_json, NON_WICKET_DISMISSALS

CURATED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "matches")

def test_parse_curated_matches_offline():
    match_files = [f for f in os.listdir(CURATED_DIR) if f.endswith(".json")]
    assert len(match_files) >= 4, f"Expected at least 4 curated matches, found {len(match_files)}"
    
    for filename in match_files:
        match_id = os.path.splitext(filename)[0]
        filepath = os.path.join(CURATED_DIR, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        metadata, deliveries = parse_cricsheet_json(data, match_id)
        
        assert metadata.match_id == match_id
        assert metadata.target_runs == metadata.first_innings_total + 1
        assert metadata.scheduled_overs == 20
        assert metadata.scheduled_balls == 120
        assert len(deliveries) > 0
        
        # Verify sequential unique delivery_idx
        for idx, d in enumerate(deliveries):
            assert d.delivery_idx == idx, f"Mismatch at idx {idx} in {match_id}"
            
        # Verify legal balls monotonicity
        legal_count = 0
        for d in deliveries:
            if d.is_legal_ball:
                legal_count += 1
            assert d.legal_balls_bowled == legal_count
            assert d.legal_balls_remaining == max(0, 120 - legal_count)

def test_parse_gt_vs_kkr_2023():
    # Match 1359487: KKR chasing 205 vs GT
    filepath = os.path.join(CURATED_DIR, "1359487.json")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    metadata, deliveries = parse_cricsheet_json(data, "1359487")
    
    assert metadata.first_innings_team == "Gujarat Titans"
    assert metadata.second_innings_team == "Kolkata Knight Riders"
    assert metadata.first_innings_total == 204
    assert metadata.target_runs == 205
    assert metadata.outcome.winner == "Kolkata Knight Riders"
    assert metadata.outcome.by_wickets == 3
    
    # Last delivery should achieve the target (207 >= 205)
    last_del = deliveries[-1]
    assert last_del.score >= 205
    assert last_del.wickets_lost == 7
    assert last_del.wickets_remaining == 3
    assert last_del.runs_required == 0
    assert last_del.batter == "RK Singh"
    assert last_del.batter_runs == 6  # 5th six in the final over!

def test_parse_mi_vs_csk_2019_final():
    # Match 1181768: MI 149/8, CSK 148/7, MI won by 1 run
    filepath = os.path.join(CURATED_DIR, "1181768.json")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    metadata, deliveries = parse_cricsheet_json(data, "1181768")
    
    assert metadata.first_innings_total == 149
    assert metadata.target_runs == 150
    assert metadata.outcome.winner == "Mumbai Indians"
    assert metadata.outcome.by_runs == 1
    
    last_del = deliveries[-1]
    assert last_del.score == 148
    assert last_del.wickets_lost == 7
    assert last_del.runs_required == 2  # Needed 2 to tie / win on the last ball, got 0 and wicket!
    assert last_del.wicket_count_delivery == 1

def test_illegal_deliveries_and_legal_ball_accounting():
    # Synthetic test data with wide, noball, bye, legbye, retired hurt
    synthetic_data = {
        "info": {
            "dates": ["2024-05-01"],
            "event": {"name": "IPL"},
            "overs": 20,
            "teams": ["Team A", "Team B"],
            "outcome": {"winner": "Team B", "by": {"wickets": 6}}
        },
        "innings": [
            {
                "team": "Team A",
                "overs": [
                    {
                        "over": 0,
                        "deliveries": [
                            {"batter": "A", "bowler": "B", "runs": {"batter": 4, "extras": 0, "total": 4}}
                        ]
                    }
                ]
            },
            {
                "team": "Team B",
                "overs": [
                    {
                        "over": 0,
                        "deliveries": [
                            # Wide ball (+1 extra)
                            {
                                "batter": "Bat1", "bowler": "Bowl1", "non_striker": "Bat2",
                                "extras": {"wides": 1},
                                "runs": {"batter": 0, "extras": 1, "total": 1}
                            },
                            # Leg bye (+1 extra, legal ball)
                            {
                                "batter": "Bat1", "bowler": "Bowl1", "non_striker": "Bat2",
                                "extras": {"legbyes": 1},
                                "runs": {"batter": 0, "extras": 1, "total": 1}
                            },
                            # Retired hurt (non-wicket)
                            {
                                "batter": "Bat1", "bowler": "Bowl1", "non_striker": "Bat2",
                                "runs": {"batter": 0, "extras": 0, "total": 0},
                                "wickets": [{"player_out": "Bat1", "kind": "retired hurt"}]
                            },
                            # Genuine wicket (bowled)
                            {
                                "batter": "Bat3", "bowler": "Bowl1", "non_striker": "Bat2",
                                "runs": {"batter": 0, "extras": 0, "total": 0},
                                "wickets": [{"player_out": "Bat3", "kind": "bowled"}]
                            },
                            # Boundary 4 runs (chase target = 5)
                            {
                                "batter": "Bat4", "bowler": "Bowl1", "non_striker": "Bat2",
                                "runs": {"batter": 4, "extras": 0, "total": 4}
                            }
                        ]
                    }
                ]
            }
        ]
    }
    
    metadata, deliveries = parse_cricsheet_json(synthetic_data, "synthetic_01")
    assert metadata.target_runs == 5  # 4 + 1
    
    # Delivery 0: Wide
    d0 = deliveries[0]
    assert d0.is_wide is True
    assert d0.is_legal_ball is False
    assert d0.legal_balls_bowled == 0
    assert d0.score == 1
    assert "wd" in d0.display_over
    
    # Delivery 1: Legbye
    d1 = deliveries[1]
    assert d1.is_legbye is True
    assert d1.is_legal_ball is True
    assert d1.legal_balls_bowled == 1
    assert d1.batter_runs == 0
    assert d1.score == 2
    
    # Delivery 2: Retired hurt
    d2 = deliveries[2]
    assert d2.is_legal_ball is True
    assert d2.legal_balls_bowled == 2
    assert d2.wicket_count_delivery == 0
    assert d2.wickets_lost == 0  # Retired hurt does NOT increment wickets lost!
    assert d2.wickets_remaining == 10
    
    # Delivery 3: Bowled wicket
    d3 = deliveries[3]
    assert d3.wicket_count_delivery == 1
    assert d3.wickets_lost == 1
    assert d3.wickets_remaining == 9
    
    # Delivery 4: Boundary 4 runs -> total score = 6 >= 5 (target achieved)
    d4 = deliveries[4]
    assert d4.score == 6
    assert d4.runs_required == 0
    assert d4.is_boundary is True
    assert len(deliveries) == 5
