import json
import os
import glob

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")

# Search for matches of interest
matches_to_check = []
for file_path in glob.glob(os.path.join(DATA_DIR, "*.json")):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        info = data.get("info", {})
        dates = info.get("dates", [])
        teams = info.get("teams", [])
        event = info.get("event", {})
        match_id = os.path.splitext(os.path.basename(file_path))[0]
        
        # Check for specific iconic matches:
        # 1. KKR vs GT 2023 (Rinku Singh)
        if "2023" in str(dates) and "Gujarat Titans" in teams and "Kolkata Knight Riders" in teams:
            matches_to_check.append(("GT_vs_KKR_2023", match_id, dates, teams, info.get("outcome", {}), file_path))
        # 2. RR vs PBKS / Kings XI Punjab 2020 (Tewatia 224 chase)
        if "2020" in str(dates) and "Rajasthan Royals" in teams and ("Kings XI Punjab" in teams or "Punjab Kings" in teams):
            matches_to_check.append(("RR_vs_KXIP_2020", match_id, dates, teams, info.get("outcome", {}), file_path))
        # 3. MI vs CSK 2019 Final
        if "2019-05-12" in str(dates) and "Mumbai Indians" in teams and "Chennai Super Kings" in teams:
            matches_to_check.append(("MI_vs_CSK_2019_Final", match_id, dates, teams, info.get("outcome", {}), file_path))
        # 4. MI vs CSK 2021 Pollard 219 chase (Delhi, 2021-05-01)
        if "2021-05-01" in str(dates) and "Mumbai Indians" in teams and "Chennai Super Kings" in teams:
            matches_to_check.append(("MI_vs_CSK_2021_Pollard", match_id, dates, teams, info.get("outcome", {}), file_path))
    except Exception as e:
        continue

for tag, mid, dates, teams, outcome, fp in matches_to_check:
    print(f"[{tag}] ID: {mid}, Dates: {dates}, Teams: {teams}, Outcome: {outcome}")
