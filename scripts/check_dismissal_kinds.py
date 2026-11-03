import json
import os
import glob

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")
kinds = set()
for fp in glob.glob(os.path.join(DATA_DIR, "*.json"))[:200]:
    with open(fp, "r", encoding="utf-8") as f:
        data = json.load(f)
    for inn in data.get("innings", []):
        for over in inn.get("overs", []):
            for d in over.get("deliveries", []):
                for w in d.get("wickets", []):
                    kinds.add(w.get("kind"))

print("Dismissal kinds found:", sorted(list(kinds)))
