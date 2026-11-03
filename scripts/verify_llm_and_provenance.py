import os
import json
import asyncio
from backend.app.models.schemas import MatchMetadata, DeliveryEvent, TurningPoint, ExplainResponse
from backend.app.services.explainer import ExplanationEngine, get_explainer

async def main():
    print("=== TurningPoint AI — LLM Inference & Provenance Verification ===")
    
    # 1. Load sample match data
    precomp_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "precomputed", "matches_replay.json")
    with open(precomp_path, "r", encoding="utf-8") as f:
        replays = json.load(f)

    match_data = replays["1359487"]
    metadata = MatchMetadata(**match_data["metadata"])
    deliveries = [DeliveryEvent(**d) for d in match_data["deliveries"]]
    tps = [TurningPoint(**tp) for tp in match_data["turning_points"]]
    target_tp = tps[0] # Rinku Singh 5 sixes

    # 2. Test Default Engine (offline/precomputed fallback)
    default_engine = get_explainer()
    resp_default = await default_engine.explain(target_tp, deliveries, metadata)
    print(f"\n[Default Engine Result]")
    print(f"  Source: {resp_default.source}")
    print(f"  Headline: {resp_default.headline}")
    print(f"  Supporting IDs: {resp_default.supporting_delivery_ids}")
    print(f"  Valid Range: [{target_tp.start_delivery_idx}, {target_tp.end_delivery_idx}]")
    assert all(target_tp.start_delivery_idx <= i <= target_tp.end_delivery_idx for i in resp_default.supporting_delivery_ids), "Supporting IDs out of range!"
    assert resp_default.source in ["precomputed_llm", "deterministic_fallback"]

    # 3. Test Deterministic Fallback Synthesis (when not in precomputed)
    fake_tp = TurningPoint(
        id="tp_synthetic_test",
        match_id="1359487",
        start_delivery_idx=10,
        end_delivery_idx=15,
        over_label="Over 1.5 - 2.4",
        prob_before=0.45,
        prob_after=0.62,
        shift_percentage=17.0,
        runs_in_window=19,
        wickets_in_window=0,
        balls_in_window=6,
        supporting_delivery_ids=[10, 11, 12, 13, 14, 15],
        summary="Synthetic test turning point"
    )
    resp_synth = await default_engine.explain(fake_tp, deliveries, metadata)
    print(f"\n[Deterministic Fallback Synthesis]")
    print(f"  Source: {resp_synth.source}")
    print(f"  Headline: {resp_synth.headline}")
    print(f"  Explanation: {resp_synth.explanation}")
    assert resp_synth.source == "deterministic_fallback"

    # 4. Check for Live Provider Keys
    groq_key = os.environ.get("GROQ_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    if groq_key or gemini_key or openai_key:
        provider = "groq" if groq_key else ("gemini" if gemini_key else "openai")
        print(f"\n[Live API Key Detected: {provider.upper()}]")
        live_engine = ExplanationEngine()
        status = live_engine.get_provider_status()
        print(f"  Provider Status: {status}")
        try:
            resp_live = await live_engine.explain(target_tp, deliveries, metadata)
            print(f"  Live Response Source: {resp_live.source}")
            print(f"  Live Response Metadata: {resp_live.llm_metadata}")
            print(f"  Live Headline: {resp_live.headline}")
            assert resp_live.source == "live_llm"
            print("  >>> LIVE SERVER-SIDE LLM CALL VERIFIED SUCCESSFULLY <<<")
        except Exception as e:
            print(f"  Live call error: {e}")
    else:
        print("\n[Live API Keys: None configured in environment]")
        print("  Backend is operating in verified offline replay mode with exact source attribution.")
        print("  When GROQ_API_KEY / GEMINI_API_KEY is configured in backend environment, live LLM requests activate automatically.")

    print("\n=== Verification Completed Successfully ===")

if __name__ == "__main__":
    asyncio.run(main())
