import json

with open("backend/data/precomputed/turning_points.json", "r") as f:
    tps = json.load(f)

for mid, match_tps in tps.items():
    print(f"Match {mid}: {len(match_tps)} turning points")
    for tp in match_tps:
        print(f"  {tp['id']}: {tp['over_label']} ({tp['shift_percentage']}%) - {tp['summary']}")

