import json

with open("backend/data/precomputed/turning_points.json", "r") as f:
    data = json.load(f)

for mid, tps in data.items():
    print(f"\n=== Match {mid} Top Turning Points ===")
    for t in tps:
        print(f"[{t['id']}] {t['over_label']} (Shift: {t['shift_percentage']}%) : {t['summary']}")
