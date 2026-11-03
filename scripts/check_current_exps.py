import json

with open("backend/data/precomputed/explanations.json", "r") as f:
    exps = json.load(f)

for k, v in list(exps.items())[:3]:
    print(f"Key: {k}")
    print(f"Headline: {v.get('headline')}")
    print(f"Explanation: {v.get('explanation')}")
    print(f"Takeaway: {v.get('takeaway')}")
    print("-" * 50)

