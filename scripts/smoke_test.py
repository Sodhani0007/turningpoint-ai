import sys
from fastapi.testclient import TestClient
from backend.app.main import app

def run_smoke_test():
    client = TestClient(app)
    
    print("1. Testing GET /api/health...")
    r = client.get("/api/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    health = r.json()
    print("   Health response:", health)
    assert health["model_loaded"] is True
    assert health["available_matches_count"] >= 4
    
    print("\n2. Testing GET /api/matches...")
    r = client.get("/api/matches")
    assert r.status_code == 200, f"Matches failed: {r.text}"
    matches = r.json()
    print(f"   Loaded {len(matches)} matches.")
    for m in matches:
        print(f"   - Match {m['match_id']}: {m['title']} (Target: {m['target']})")
        
    print("\n3. Testing GET /api/matches/1359487/replay (GT vs KKR)...")
    r = client.get("/api/matches/1359487/replay")
    assert r.status_code == 200, f"Replay failed: {r.text}"
    replay = r.json()
    deliveries = replay["deliveries"]
    tps = replay["turning_points"]
    print(f"   Total Deliveries: {len(deliveries)}")
    print(f"   Turning Points Count: {len(tps)}")
    assert len(tps) == 5
    assert deliveries[-1]["win_probability"] == 1.0
    print(f"   Final ball: {deliveries[-1]['display_over']} - {deliveries[-1]['event_description']}")
    print(f"   Final score: {deliveries[-1]['score']}/{deliveries[-1]['wickets_lost']}")
    
    print("\n4. Testing GET /api/matches/1181768/replay (MI vs CSK Final)...")
    r = client.get("/api/matches/1181768/replay")
    assert r.status_code == 200
    replay_mi = r.json()
    assert replay_mi["deliveries"][-1]["win_probability"] == 0.0  # CSK lost by 1 run
    print(f"   CSK final ball: {replay_mi['deliveries'][-1]['display_over']} - {replay_mi['deliveries'][-1]['event_description']}")
    
    print("\n5. Testing POST /api/explain...")
    r = client.post("/api/explain", json={
        "match_id": "1359487",
        "turning_point_id": "tp_1359487_1"
    })
    assert r.status_code == 200, f"Explain failed: {r.text}"
    explain = r.json()
    print(f"   Headline: {explain['headline']}")
    print(f"   Explanation: {explain['explanation']}")
    print(f"   Takeaway: {explain['takeaway']}")
    print(f"   Supporting Deliveries: {explain['supporting_delivery_ids']}")
    
    print("\nALL SMOKE TESTS PASSED CLEANLY!")

if __name__ == "__main__":
    run_smoke_test()
