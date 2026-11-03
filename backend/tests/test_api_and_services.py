import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.ml_model import get_ml_model
from backend.app.services.turning_points import detect_turning_points
from backend.app.services.explainer import get_explainer
from backend.app.models.schemas import DeliveryEvent, TurningPoint, MatchMetadata, MatchOutcome

client = TestClient(app)

def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["model_loaded"] is True
    assert data["available_matches_count"] >= 4
    assert "ai_provider_status" in data
    assert "ai_provider_name" in data
    assert "ai_provider_model" in data
    assert "brier_score" in data["model_evaluation_metrics"]

def test_get_matches():
    resp = client.get("/api/matches")
    assert resp.status_code == 200
    matches = resp.json()
    assert len(matches) >= 4
    match_ids = [m["match_id"] for m in matches]
    assert "1359487" in match_ids  # GT vs KKR
    assert "1181768" in match_ids  # MI vs CSK Final

def test_get_match_replay():
    resp = client.get("/api/matches/1359487/replay")
    assert resp.status_code == 200
    data = resp.json()
    assert data["metadata"]["match_id"] == "1359487"
    assert len(data["deliveries"]) > 100
    assert len(data["turning_points"]) == 5
    
    # Check probabilities
    deliveries = data["deliveries"]
    for d in deliveries:
        assert d["win_probability"] is not None
        assert 0.0 <= d["win_probability"] <= 1.0

    # Terminal state check
    assert deliveries[-1]["win_probability"] == 1.0  # KKR won the match

def test_get_match_not_found():
    resp = client.get("/api/matches/non_existent_999999/replay")
    assert resp.status_code == 404

def test_turning_points_ranking_and_overlap_removal():
    resp = client.get("/api/matches/1359487/turning-points")
    assert resp.status_code == 200
    tps = resp.json()
    assert len(tps) == 5
    
    # Verify shifts are significant
    for tp in tps:
        assert abs(tp["shift_percentage"]) >= 5.0
        assert tp["start_delivery_idx"] < tp["end_delivery_idx"]
        assert len(tp["supporting_delivery_ids"]) > 0

    # Verify no massive overlap between turning points
    for i in range(len(tps)):
        for j in range(i + 1, len(tps)):
            set_i = set(range(tps[i]["start_delivery_idx"], tps[i]["end_delivery_idx"] + 1))
            set_j = set(range(tps[j]["start_delivery_idx"], tps[j]["end_delivery_idx"] + 1))
            intersection = set_i.intersection(set_j)
            smaller = min(len(set_i), len(set_j))
            assert len(intersection) / smaller <= 0.6  # Overlap should be pruned

def test_explain_endpoint_precomputed():
    payload = {
        "match_id": "1359487",
        "turning_point_id": "tp_1359487_1"
    }
    resp = client.post("/api/explain", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["turning_point_id"] == "tp_1359487_1"
    assert len(data["headline"]) > 0
    assert len(data["explanation"]) > 0
    assert len(data["supporting_delivery_ids"]) > 0
    assert data["source"] in ["live_llm", "precomputed_llm", "deterministic_fallback"]
    # Must have verified evidence payload
    assert "verified_evidence" in data
    assert data["verified_evidence"]["match_id"] == "1359487"

def test_explain_sanitizes_hallucinated_delivery_ids():
    from backend.app.services.explainer import ExplanationEngine
    from unittest.mock import patch, MagicMock
    
    mock_engine = ExplanationEngine(api_key="test_dummy_key", provider="test_provider", model="test_model")
    
    # Mock httpx response returning out-of-range delivery IDs (e.g. 9999, -50)
    fake_llm_json = {
        "headline": "Mocked LLM Headline",
        "explanation": "Mocked LLM explanation.",
        "takeaway": "Mocked takeaway.",
        "confidence_notes": "Mocked notes.",
        "supporting_delivery_ids": [9999, -50] # Hallucinated IDs!
    }
    
    resp = client.get("/api/matches/1359487/replay")
    match_data = resp.json()
    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tp = TurningPoint(**match_data["turning_points"][0])
    
    class MockHttpxResponse:
        status_code = 200
        def json(self):
            import json
            return {"choices": [{"message": {"content": json.dumps(fake_llm_json)}}]}

    with patch("httpx.AsyncClient.post") as mock_post:
        import asyncio
        async def mock_async_post(*args, **kwargs):
            return MockHttpxResponse()
        mock_post.side_effect = mock_async_post
        
        result = asyncio.run(mock_engine.explain(tp, deliveries, metadata))
        assert result.source == "live_llm"
        assert result.llm_metadata["provider"] == "test_provider"
        # Since 9999 and -50 are hallucinated outside tp range, they should be sanitized
        assert 9999 not in result.supporting_delivery_ids
        assert -50 not in result.supporting_delivery_ids
        assert all(tp.start_delivery_idx <= did <= tp.end_delivery_idx for did in result.supporting_delivery_ids)

def test_explain_endpoint_rejects_invalid_tp():
    payload = {
        "match_id": "1359487",
        "turning_point_id": "tp_fake_invalid"
    }
    resp = client.post("/api/explain", json=payload)
    assert resp.status_code == 404

def test_no_future_data_leakage_in_evidence():
    explainer = get_explainer()
    resp = client.get("/api/matches/1359487/replay")
    match_data = resp.json()
    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tps = [TurningPoint(**tp) for tp in match_data["turning_points"]]
    
    # Pick an early turning point
    tp_early = min(tps, key=lambda x: x.end_delivery_idx)
    evidence = explainer.build_evidence_payload(tp_early, deliveries, metadata)
    
    # Ensure evidence does NOT contain any delivery beyond tp_early.end_delivery_idx
    for d in evidence["deliveries"]:
        assert d["delivery_id"] <= tp_early.end_delivery_idx
