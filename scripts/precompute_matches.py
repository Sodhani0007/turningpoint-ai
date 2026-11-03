import os
import json
from backend.app.services.parser import parse_cricsheet_json
from backend.app.services.ml_model import WinProbabilityModel
from backend.app.services.turning_points import detect_turning_points
from backend.app.services.explainer import ExplanationEngine
from backend.app.models.schemas import MatchSummary

MATCHES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "matches")
PRECOMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "precomputed")
os.makedirs(PRECOMP_DIR, exist_ok=True)

MATCH_TITLES = {
    "1359487": {
        "title": "GT vs KKR (2023) — The Rinku Singh Miracle",
        "subtitle": "Kolkata Knight Riders chase 205 with 5 sixes in the final over",
        "key_hero": "Rinku Singh (48* off 21 balls, 5 sixes in 20th over)"
    },
    "1181768": {
        "title": "MI vs CSK (2019 Final) — The 1-Run Thriller",
        "subtitle": "Mumbai Indians defend 149 in a heart-stopping last-ball finish",
        "key_hero": "Lasith Malinga & Shane Watson (1-run victory)"
    },
    "1216527": {
        "title": "KXIP vs RR (2020) — The Tewatia Turnaround",
        "subtitle": "Rajasthan Royals chase 224 in the highest IPL chase at Sharjah",
        "key_hero": "Rahul Tewatia (53 off 31, 5 sixes in 18th over)"
    },
    "1254084": {
        "title": "CSK vs MI (2021) — Pollard's Delhi Blitz",
        "subtitle": "Mumbai Indians pull off a mammoth 219 chase on the final delivery",
        "key_hero": "Kieron Pollard (87* off 34 balls, 8 sixes)"
    }
}

def precompute_all():
    ml_model = WinProbabilityModel()
    explainer = ExplanationEngine()
    
    match_files = [f for f in os.listdir(MATCHES_DIR) if f.endswith(".json")]
    
    summaries = []
    all_replays = {}
    all_turning_points = {}
    all_explanations = {}
    
    for filename in sorted(match_files):
        match_id = os.path.splitext(filename)[0]
        filepath = os.path.join(MATCHES_DIR, filename)
        
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        metadata, deliveries = parse_cricsheet_json(data, match_id)
        # 1. Run ML prediction
        deliveries = ml_model.predict_delivery_probabilities(deliveries, metadata)
        
        # 2. Detect Turning Points
        tps = detect_turning_points(match_id, deliveries, top_n=5)
        all_turning_points[match_id] = [tp.model_dump() for tp in tps]
        
        # 3. Generate grounded explanations
        for tp in tps:
            evidence = explainer.build_evidence_payload(tp, deliveries, metadata)
            exp_resp = explainer._generate_deterministic_explanation(tp, evidence, metadata)
            cache_key = f"{match_id}_{tp.id}"
            all_explanations[cache_key] = exp_resp.model_dump()
            
        # 4. Summary
        meta_dict = MATCH_TITLES.get(match_id, {
            "title": f"{metadata.second_innings_team} vs {metadata.first_innings_team}",
            "subtitle": f"Target: {metadata.target_runs} runs",
            "key_hero": metadata.player_of_match or "Player of the match"
        })
        
        last_d = deliveries[-1]
        second_inn_score_str = f"{last_d.score}/{last_d.wickets_lost} ({last_d.display_over} ov)"
        first_inn_score_str = f"{metadata.first_innings_total}/{metadata.first_innings_wickets} (20 ov)"
        
        if metadata.outcome.winner == metadata.second_innings_team:
            res_text = f"{metadata.second_innings_team} won by {metadata.outcome.by_wickets} wickets"
        else:
            res_text = f"{metadata.first_innings_team} won by {metadata.outcome.by_runs} runs"
            
        summary = MatchSummary(
            match_id=match_id,
            title=meta_dict["title"],
            subtitle=meta_dict["subtitle"],
            date=metadata.date,
            venue=metadata.venue,
            first_innings_team=metadata.first_innings_team,
            first_innings_score=first_inn_score_str,
            second_innings_team=metadata.second_innings_team,
            second_innings_score=second_inn_score_str,
            result_text=res_text,
            target=metadata.target_runs,
            total_deliveries=len(deliveries),
            turning_points_count=len(tps),
            key_hero=meta_dict["key_hero"]
        )
        summaries.append(summary.model_dump())
        
        all_replays[match_id] = {
            "metadata": metadata.model_dump(),
            "deliveries": [d.model_dump() for d in deliveries],
            "turning_points": [tp.model_dump() for tp in tps]
        }
        print(f"Precomputed match {match_id}: {len(deliveries)} deliveries, {len(tps)} turning points.")

    # Save to backend precomputed dir
    with open(os.path.join(PRECOMP_DIR, "matches_summary.json"), "w") as f:
        json.dump(summaries, f, indent=2)
    with open(os.path.join(PRECOMP_DIR, "matches_replay.json"), "w") as f:
        json.dump(all_replays, f, indent=2)
    with open(os.path.join(PRECOMP_DIR, "turning_points.json"), "w") as f:
        json.dump(all_turning_points, f, indent=2)
    with open(os.path.join(PRECOMP_DIR, "explanations.json"), "w") as f:
        json.dump(all_explanations, f, indent=2)

    print("All match replays, turning points, and explanations successfully precomputed and saved.")

if __name__ == "__main__":
    precompute_all()
