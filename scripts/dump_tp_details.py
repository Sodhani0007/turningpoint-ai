import json

with open("backend/data/precomputed/matches_replay.json", "r") as f:
    replays = json.load(f)

for mid, match_data in replays.items():
    print(f"\n=================== MATCH {mid} ({match_data['metadata']['second_innings_team']} vs {match_data['metadata']['first_innings_team']}) ===================")
    dels = match_data['deliveries']
    for tp in match_data['turning_points']:
        print(f"\n--- TP {tp['id']} ({tp['over_label']}, Shift: {tp['shift_percentage']}%) ---")
        window_dels = dels[tp['start_delivery_idx']: tp['end_delivery_idx'] + 1]
        for d in window_dels:
            w_str = f" [WICKET: {d['wickets'][0]['player_out']}]" if d['wickets'] else ""
            print(f"  Delivery {d['delivery_idx']} ({d['display_over']}): {d['bowler']} -> {d['batter']} | {d['total_runs']} runs ({d['batter_runs']} bat, {d['extra_runs']} ext){w_str} | Score: {d['score']}/{d['wickets_lost']} | Need: {d['runs_required']} off {d['legal_balls_remaining']}b | WinProb: {d['win_probability']}")

