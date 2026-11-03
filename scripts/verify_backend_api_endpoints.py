import os
import json
from fastapi.testclient import TestClient
from backend.app.main import app

def test_all_backend_endpoints():
    print("=====================================================================")
    print("  TURNINGPOINT AI — BACKEND ENDPOINT CONTRACT VERIFICATION")
    print("=====================================================================")

    client = TestClient(app)

    # 1. Test /api/health
    resp_health = client.get("/api/health")
    print(f"\n[1. Testing GET /api/health]")
    print(f"  Status Code: {resp_health.status_code}")
    assert resp_health.status_code == 200
    health_data = resp_health.json()
    print(f"  Status: {health_data['status']}")
    print(f"  Model Loaded: {health_data['model_loaded']}")
    print(f"  Available Matches: {health_data['available_matches_count']}")
    print(f"  AI Provider Status: {health_data['ai_provider_status']}")
    print(f"  AI Provider Model: {health_data['ai_provider_model']}")
    assert health_data["status"] == "healthy"
    assert health_data["model_loaded"] is True
    assert health_data["available_matches_count"] >= 4
    assert "brier_score" in health_data["model_evaluation_metrics"]

    # 2. Test /api/matches
    resp_matches = client.get("/api/matches")
    print(f"\n[2. Testing GET /api/matches]")
    print(f"  Status Code: {resp_matches.status_code}")
    assert resp_matches.status_code == 200
    matches = resp_matches.json()
    print(f"  Total Matches: {len(matches)}")
    match_ids = [m["match_id"] for m in matches]
    print(f"  Match IDs: {match_ids}")
    assert len(matches) == 4
    assert "1359487" in match_ids
    assert "1181768" in match_ids
    assert "1216527" in match_ids
    assert "1254084" in match_ids

    # 3. Test /api/explain on Rinku Singh Turning Point (1359487, tp_1359487_1)
    resp_explain = client.post("/api/explain", json={
        "match_id": "1359487",
        "turning_point_id": "tp_1359487_1"
    })
    print(f"\n[3. Testing POST /api/explain (Rinku Singh Over 19)]")
    print(f"  Status Code: {resp_explain.status_code}")
    assert resp_explain.status_code == 200
    explain_data = resp_explain.json()
    print(f"  Headline: {explain_data['headline']}")
    print(f"  Source: {explain_data['source']}")
    print(f"  Supporting Deliveries: {explain_data['supporting_delivery_ids']}")
    
    # Verify deterministic factual disambiguation in evidence payload
    evidence = explain_data["verified_evidence"]
    print(f"\n[Factual Disambiguation Check]")
    print(f"  Entering Score: {evidence.get('entering_score', 'N/A')} (runs needed: {evidence.get('entering_runs_needed', 'N/A')} off {evidence.get('entering_balls_remaining', 'N/A')} balls)")
    print(f"  First Delivery Event: {evidence.get('first_delivery_over', 'N/A')} -> {evidence.get('first_delivery_event', 'N/A')}")
    print(f"  Score After First Ball: {evidence.get('score_after_first_delivery', 'N/A')} (runs needed: {evidence.get('runs_needed_after_first_delivery', 'N/A')} off {evidence.get('balls_remaining_after_first_delivery', 'N/A')} balls)")
    print(f"  Ending Score: {evidence.get('ending_score', 'N/A')}")
    
    assert evidence["entering_score"] == "176/7", f"Expected entering score 176/7, got {evidence.get('entering_score')}"
    assert evidence["entering_runs_needed"] == 29, f"Expected 29 runs needed entering, got {evidence.get('entering_runs_needed')}"
    assert evidence["entering_balls_remaining"] == 6, f"Expected 6 balls remaining entering, got {evidence.get('entering_balls_remaining')}"
    assert evidence["score_after_first_delivery"] == "177/7", f"Expected 177/7 after 19.1, got {evidence.get('score_after_first_delivery')}"
    assert evidence["runs_needed_after_first_delivery"] == 28, f"Expected 28 runs needed after 19.1, got {evidence.get('runs_needed_after_first_delivery')}"
    assert evidence["balls_remaining_after_first_delivery"] == 5, f"Expected 5 balls remaining after 19.1, got {evidence.get('balls_remaining_after_first_delivery')}"
    assert evidence["ending_score"] == "207/7", f"Expected ending score 207/7, got {evidence.get('ending_score')}"
    assert evidence["ending_runs_needed"] == 0, f"Expected 0 runs needed ending, got {evidence.get('ending_runs_needed')}"

    print(f"\n[Explanation Text]")
    print(f"  {explain_data['explanation']}")

    print("\n=====================================================================")
    print("  >>> SUCCESS: ALL BACKEND ENDPOINTS AND DISAMBIGUATION VERIFIED <<<")
    print("=====================================================================")

if __name__ == "__main__":
    test_all_backend_endpoints()
