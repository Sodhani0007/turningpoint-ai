import json
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")
file_path = os.path.join(DATA_DIR, "1359487.json")

with open(file_path, "r", encoding="utf-8") as f:
    match = json.load(f)

print("Keys:", match.keys())
print("Info keys:", match["info"].keys())
print("Teams:", match["info"]["teams"])
print("Toss:", match["info"]["toss"])
print("Outcome:", match["info"]["outcome"])
print("Number of innings:", len(match["innings"]))

for i, inn in enumerate(match["innings"]):
    print(f"\nInnings {i+1} team:", inn["team"])
    print(f"Overs count:", len(inn["overs"]))
    first_over = inn["overs"][0]
    print("First over:", first_over["over"])
    print("First delivery sample:", first_over["deliveries"][0])
    last_over = inn["overs"][-1]
    print("Last over:", last_over["over"], "deliveries:", len(last_over["deliveries"]))
    print("Last delivery sample:", last_over["deliveries"][-1])
