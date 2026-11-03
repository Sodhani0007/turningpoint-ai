import os
import json

PRECOMP_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "precomputed")
MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "model")
FRONTEND_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "src", "data")
os.makedirs(FRONTEND_DATA_DIR, exist_ok=True)

with open(os.path.join(PRECOMP_DIR, "matches_summary.json"), "r") as f:
    summaries = json.load(f)

with open(os.path.join(PRECOMP_DIR, "matches_replay.json"), "r") as f:
    replays = json.load(f)

with open(os.path.join(PRECOMP_DIR, "turning_points.json"), "r") as f:
    turning_points = json.load(f)

with open(os.path.join(PRECOMP_DIR, "explanations.json"), "r") as f:
    explanations = json.load(f)

with open(os.path.join(MODEL_DIR, "model_metrics.json"), "r") as f:
    model_metrics = json.load(f)

bundle = {
    "version": "1.0.0",
    "attribution": {
        "source": "Cricsheet (cricsheet.org)",
        "license": "Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)",
        "matches_curated": 4,
        "historical_training_matches": 1195,
        "historical_training_deliveries": 137500
    },
    "model_metrics": model_metrics,
    "summaries": summaries,
    "replays": replays,
    "turning_points": turning_points,
    "explanations": explanations
}

out_path = os.path.join(FRONTEND_DATA_DIR, "precomputed_bundle.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(bundle, f, indent=2)

print(f"Exported bundle to {out_path} ({os.path.getsize(out_path)} bytes)")
