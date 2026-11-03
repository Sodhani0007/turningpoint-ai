import json
import os

BUNDLE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "src", "data", "precomputed_bundle.json")

def audit_bundle():
    with open(BUNDLE_PATH, "r", encoding="utf-8") as f:
        bundle = json.load(f)
        
    print("=== AUDITING STATIC REPLAY BUNDLE ===")
    assert "version" in bundle
    assert "attribution" in bundle
    assert "model_metrics" in bundle
    assert "summaries" in bundle
    assert "replays" in bundle
    assert "turning_points" in bundle
    assert "explanations" in bundle
    
    # 1. Model metrics
    mm = bundle["model_metrics"]
    print(f"Model Metrics: AUC={mm['roc_auc']}, Brier={mm['brier_score']}, LogLoss={mm['log_loss']}")
    assert mm["roc_auc"] == 0.887
    assert mm["brier_score"] == 0.1436
    assert mm["log_loss"] == 0.4357
    assert mm["train_samples"] == 96462
    assert mm["test_samples"] == 32419
    
    # 2. Summaries
    summaries = bundle["summaries"]
    assert len(summaries) == 4
    print(f"Verified {len(summaries)} match summaries:")
    for s in summaries:
        print(f"  - [{s['match_id']}] {s['title']}: Target {s['target']}, Result: {s['result_text']}")
        
    # 3. Replays & Deliveries
    replays = bundle["replays"]
    for mid, match_data in replays.items():
        meta = match_data["metadata"]
        dels = match_data["deliveries"]
        tps = match_data["turning_points"]
        print(f"\nMatch {mid} ({meta['second_innings_team']} vs {meta['first_innings_team']}):")
        print(f"  Deliveries count: {len(dels)}")
        print(f"  Target: {meta['target_runs']}")
        print(f"  Final score: {dels[-1]['score']}/{dels[-1]['wickets_lost']}")
        print(f"  Final Win Probability: {dels[-1]['win_probability']}")
        
        # Verify terminal condition
        if meta["outcome"]["winner"] == meta["second_innings_team"]:
            assert dels[-1]["win_probability"] == 1.0, f"Expected 1.0 for winning chase in {mid}"
            assert dels[-1]["score"] >= meta["target_runs"]
        else:
            assert dels[-1]["win_probability"] == 0.0, f"Expected 0.0 for losing chase in {mid}"
            
        # Verify all delivery probabilities
        for d in dels:
            assert d["win_probability"] is not None
            assert 0.0 <= d["win_probability"] <= 1.0
            assert d["score"] >= 0
            assert 0 <= d["wickets_lost"] <= 10
            
        # Verify turning points
        assert len(tps) == 5
        for tp in tps:
            assert tp["prob_before"] is not None
            assert tp["prob_after"] is not None
            assert len(tp["supporting_delivery_ids"]) > 0
            
            # Verify explanation exists
            exp_key = f"{mid}_{tp['id']}"
            assert exp_key in bundle["explanations"], f"Missing explanation for {exp_key}"
            exp = bundle["explanations"][exp_key]
            assert len(exp["headline"]) > 0
            assert len(exp["explanation"]) > 20
            assert len(exp["takeaway"]) > 5
            # Verify headline is not generic template
            assert not exp["headline"].startswith("Shift of ")
            
    print("\nALL STATIC BUNDLE CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    audit_bundle()

