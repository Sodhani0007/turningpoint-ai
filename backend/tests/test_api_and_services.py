import json
import asyncio
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
        text = json.dumps({"choices": [{"message": {"content": json.dumps(fake_llm_json)}}]})
        def json(self):
            return json.loads(self.text)

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

def test_groq_model_configuration_and_json_parsing():
    import os
    from backend.app.services.explainer import ExplanationEngine, extract_json_payload
    
    # 1. Test default Groq model is openai/gpt-oss-20b
    old_groq_key = os.environ.get("GROQ_API_KEY")
    old_groq_model = os.environ.get("GROQ_MODEL")
    try:
        os.environ["GROQ_API_KEY"] = "gsk_dummy_test_key"
        os.environ.pop("GROQ_MODEL", None)
        engine_default = ExplanationEngine()
        assert engine_default.provider == "groq"
        assert engine_default.model == "openai/gpt-oss-20b"
        
        # 2. Test GROQ_MODEL environment variable override
        os.environ["GROQ_MODEL"] = "qwen/qwen3.8-27b"
        engine_custom = ExplanationEngine()
        assert engine_custom.provider == "groq"
        assert engine_custom.model == "qwen/qwen3.8-27b"
    finally:
        if old_groq_key is not None:
            os.environ["GROQ_API_KEY"] = old_groq_key
        else:
            os.environ.pop("GROQ_API_KEY", None)
        if old_groq_model is not None:
            os.environ["GROQ_MODEL"] = old_groq_model
        else:
            os.environ.pop("GROQ_MODEL", None)

    # 3. Test robust JSON extraction with markdown code fences
    fenced_content = "```json\n{\"headline\": \"Test Headline\", \"supporting_delivery_ids\": [1, 2]}\n```"
    parsed = extract_json_payload(fenced_content)
    assert parsed["headline"] == "Test Headline"
    assert parsed["supporting_delivery_ids"] == [1, 2]

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

def test_groq_json_validate_failed_triggers_retry_and_succeeds():
    import json
    import asyncio
    from unittest.mock import patch
    from backend.app.services.explainer import ExplanationEngine

    mock_engine = ExplanationEngine(api_key="gsk_dummy_test_key", provider="groq", model="openai/gpt-oss-20b")
    
    resp = client.get("/api/matches/1359487/replay")
    match_data = resp.json()
    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tp = TurningPoint(**match_data["turning_points"][0])

    calls = []

    class MockFirstFailResponse:
        status_code = 400
        text = '{"error": {"message": "Failed to generate JSON. max completion tokens reached before generating a valid document", "type": "invalid_request_error", "code": "json_validate_failed"}}'
        def json(self):
            return json.loads(self.text)

    class MockSecondSuccessResponse:
        status_code = 200
        text = json.dumps({
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "headline": "Rinku Singh Historic Over",
                        "explanation": "KKR entered over 19 at 176/7 needing 29 runs off 6 balls. A single brought score to 177/7 with 28 needed off 5 balls, followed by 5 consecutive sixes.",
                        "takeaway": "Unprecedented 5 sixes in the final over.",
                        "confidence_notes": "Grounded in observed delivery events.",
                        "supporting_delivery_ids": [117, 118, 119, 120, 121, 122]
                    })
                }
            }]
        })
        def json(self):
            return json.loads(self.text)

    async def mock_post(url, headers=None, json=None, **kwargs):
        calls.append({"url": url, "headers": headers, "json": json})
        if len(calls) == 1:
            return MockFirstFailResponse()
        return MockSecondSuccessResponse()

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        result = asyncio.run(mock_engine.explain_live_strict(tp, deliveries, metadata))
        
        assert len(calls) == 2, "Expected exactly one initial request and one bounded retry"
        # Initial request checks
        assert calls[0]["json"]["max_completion_tokens"] == 1500
        assert "response_format" in calls[0]["json"]
        # Bounded retry checks
        assert calls[1]["json"]["max_completion_tokens"] == 2500
        assert "response_format" not in calls[1]["json"], "response_format should be omitted in retry to avoid parser abort"
        
        # Result checks
        assert result.source == "live_llm"
        assert result.llm_metadata["model"] == "openai/gpt-oss-20b"
        assert result.llm_metadata["provider"] == "groq"
        assert len(result.supporting_delivery_ids) > 0

def test_groq_json_validate_failed_retry_exhaustion_falls_back():
    import json
    import asyncio
    from unittest.mock import patch
    from backend.app.services.explainer import ExplanationEngine

    mock_engine = ExplanationEngine(api_key="gsk_dummy_test_key", provider="groq", model="openai/gpt-oss-20b")
    # Empty precomputed dict to ensure deterministic synthesis fallback
    mock_engine.precomputed = {}
    
    resp = client.get("/api/matches/1359487/replay")
    match_data = resp.json()
    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tp = TurningPoint(**match_data["turning_points"][0])

    calls = []

    class MockFailResponse:
        status_code = 400
        text = '{"error": {"message": "Failed to generate JSON. max completion tokens reached before generating a valid document", "type": "invalid_request_error", "code": "json_validate_failed"}}'
        def json(self):
            return json.loads(self.text)

    async def mock_post(url, headers=None, json=None, **kwargs):
        calls.append({"url": url, "headers": headers, "json": json})
        return MockFailResponse()

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        # explain() catches error from explain_live_strict and safely falls back
        result = asyncio.run(mock_engine.explain(tp, deliveries, metadata))
        
        assert len(calls) == 2, "Should attempt initial request + exactly 1 bounded retry before falling back"
        assert result.source != "live_llm", "Never label an unsuccessful LLM inference as live_llm"
        assert result.source == "deterministic_fallback"
        assert result.llm_metadata is None

def test_groq_request_payload_token_budget():
    import json
    import asyncio
    from unittest.mock import patch
    from backend.app.services.explainer import ExplanationEngine

    mock_engine = ExplanationEngine(api_key="gsk_dummy_test_key", provider="groq", model="openai/gpt-oss-20b")
    
    resp = client.get("/api/matches/1359487/replay")
    match_data = resp.json()
    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tp = TurningPoint(**match_data["turning_points"][0])

    calls = []

    class MockSuccessResponse:
        status_code = 200
        text = json.dumps({
            "choices": [{
                "message": {
                    "content": json.dumps({
                        "headline": "Clean Finish",
                        "explanation": "Normal explanation.",
                        "takeaway": "Key phase.",
                        "confidence_notes": "Verified.",
                        "supporting_delivery_ids": [117, 118]
                    })
                }
            }]
        })
        def json(self):
            return json.loads(self.text)

    async def mock_post(url, headers=None, json=None, **kwargs):
        calls.append({"url": url, "headers": headers, "json": json})
        return MockSuccessResponse()

    with patch("httpx.AsyncClient.post", side_effect=mock_post):
        result = asyncio.run(mock_engine.explain_live_strict(tp, deliveries, metadata))
        assert len(calls) == 1
        payload = calls[0]["json"]
        assert payload["max_completion_tokens"] >= 1500, "Must allocate at least 1500 completion tokens for reasoning models"
        assert payload["max_tokens"] >= 1500
        assert payload["model"] == "openai/gpt-oss-20b"
        assert result.source == "live_llm"
