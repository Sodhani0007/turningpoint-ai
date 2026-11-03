import os
import sys
import json
import asyncio
from backend.app.models.schemas import MatchMetadata, DeliveryEvent, TurningPoint, ExplainResponse
from backend.app.services.explainer import ExplanationEngine

async def run_real_provider_smoke_test():
    print("=====================================================================")
    print("  TURNINGPOINT AI — REAL GROQ LLM INFERENCE SMOKE TEST")
    print("=====================================================================")

    # 1. Check GROQ_API_KEY from environment only (never print raw key)
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        print("\n[ERROR] GROQ_API_KEY is not set in the backend environment.")
        print("Please set GROQ_API_KEY in your environment before running this test:")
        print("  Windows PowerShell: $env:GROQ_API_KEY='your_api_key_here'")
        print("  Linux/macOS Bash:   export GROQ_API_KEY='your_api_key_here'")
        print("\nResult: INFERENCE NOT EXECUTED (Missing Credentials)")
        sys.exit(1)

    masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***"
    print(f"\n[Environment Check]")
    print(f"  GROQ_API_KEY: Configured (masked: {masked_key}, length: {len(api_key)})")
    print(f"  Target Provider: Groq Cloud API (OpenAI-compatible /chat/completions)")
    print(f"  Target Model: llama-3.3-70b-versatile")

    # 2. Load Match 1359487 (GT vs KKR) and Rinku Singh Turning Point
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "precomputed")
    replay_file = os.path.join(data_dir, "matches_replay.json")

    with open(replay_file, "r", encoding="utf-8") as f:
        replays = json.load(f)

    match_data = replays.get("1359487")
    if not match_data:
        print("[ERROR] Match 1359487 not found in precomputed replay data.")
        sys.exit(1)

    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tps = [TurningPoint(**tp) for tp in match_data["turning_points"]]
    
    # Target Rinku Singh's final over (tp_1359487_1)
    target_tp = next((t for t in tps if t.id == "tp_1359487_1"), tps[0])

    print(f"\n[Target Turning Point]")
    print(f"  Match: {metadata.second_innings_team} vs {metadata.first_innings_team} ({metadata.date})")
    print(f"  ID: {target_tp.id}")
    print(f"  Phase: {target_tp.over_label}")
    print(f"  Win Probability Shift: {target_tp.shift_percentage}%")
    print(f"  Delivery Index Range: [{target_tp.start_delivery_idx}, {target_tp.end_delivery_idx}]")

    # 3. Instantiate Engine with explicit Groq parameters
    base_url = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
    engine = ExplanationEngine(
        api_key=api_key,
        base_url=base_url,
        provider="groq",
        model="llama-3.3-70b-versatile"
    )

    # 4. Execute STRICT live inference (NO caches, NO fallbacks)
    print("\n[Executing Real Server-Side Groq Request]")
    print("  Endpoint: https://api.groq.com/openai/v1/chat/completions")
    print("  Calling explain_live_strict() — will fail if provider call fails...")

    try:
        response: ExplainResponse = await engine.explain_live_strict(
            tp=target_tp,
            deliveries=deliveries,
            metadata=metadata
        )
    except Exception as exc:
        print(f"\n[FAIL] Live Groq inference failed with error:")
        print(f"  Type: {type(exc).__name__}")
        print(f"  Message: {exc}")
        sys.exit(1)

    # 5. Rigorous contract validation
    print("\n[Contract Verification & Integrity Audit]")

    # Check source tag
    if response.source != "live_llm":
        print(f"  [FAIL] Response source must be 'live_llm', got '{response.source}'")
        sys.exit(1)
    print(f"  [PASS] source: {response.source}")

    # Check LLM metadata
    meta = response.llm_metadata or {}
    if meta.get("provider") != "groq":
        print(f"  [FAIL] Provider mismatch: expected 'groq', got '{meta.get('provider')}'")
        sys.exit(1)
    if meta.get("model") != "llama-3.3-70b-versatile":
        print(f"  [FAIL] Model mismatch: expected 'llama-3.3-70b-versatile', got '{meta.get('model')}'")
        sys.exit(1)
    latency_ms = meta.get("latency_ms", 0)
    if latency_ms <= 0:
        print(f"  [FAIL] Invalid latency: {latency_ms}ms")
        sys.exit(1)

    print(f"  [PASS] Provider: {meta['provider']}")
    print(f"  [PASS] Model: {meta['model']}")
    print(f"  [PASS] Measured Latency: {latency_ms}ms")

    # Check supporting delivery IDs are within strict boundaries
    valid_range = set(range(target_tp.start_delivery_idx, target_tp.end_delivery_idx + 1))
    supporting_ids = response.supporting_delivery_ids
    if not supporting_ids:
        print(f"  [FAIL] supporting_delivery_ids cannot be empty")
        sys.exit(1)

    for did in supporting_ids:
        if did not in valid_range:
            print(f"  [FAIL] Hallucinated delivery ID {did} outside valid range {valid_range}")
            sys.exit(1)
    print(f"  [PASS] Supporting Delivery IDs: {supporting_ids} (All within [{target_tp.start_delivery_idx}, {target_tp.end_delivery_idx}])")

    # Check structured content
    assert len(response.headline) > 5, "Headline is too short"
    assert len(response.explanation) > 20, "Explanation is too short"
    assert len(response.takeaway) > 10, "Takeaway is too short"

    print("\n[LLM Generated Output]")
    print(f"  Headline: {response.headline}")
    print(f"  Explanation: {response.explanation}")
    print(f"  Takeaway: {response.takeaway}")
    if response.confidence_notes:
        print(f"  Confidence Notes: {response.confidence_notes}")

    print("\n=====================================================================")
    print("  >>> SUCCESS: REAL GROQ LLM INFERENCE PROVEN & VALIDATED <<<")
    print("=====================================================================")

if __name__ == "__main__":
    asyncio.run(run_real_provider_smoke_test())
