import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")
file_path = os.path.join(DATA_DIR, "1359487.json")

with open(file_path, "r", encoding="utf-8") as f:
    match = json.load(f)

# Find deliveries with wickets and extras in 2nd innings
inn2 = match["innings"][1]
wicket_samples = []
extra_samples = []

for over in inn2["overs"]:
    for d in over["deliveries"]:
        if "wickets" in d:
            wicket_samples.append((over["over"], d))
        if "extras" in d:
            extra_samples.append((over["over"], d))

print(f"Total wickets in inn 2: {len(wicket_samples)}")
for o, d in wicket_samples[:4]:
    print(f"Over {o}: batter={d['batter']}, bowler={d['bowler']}, wickets={d['wickets']}")

print(f"\nTotal deliveries with extras in inn 2: {len(extra_samples)}")
for o, d in extra_samples[:4]:
    print(f"Over {o}: extras={d['extras']}, runs={d['runs']}")
