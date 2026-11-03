from typing import List, Dict, Any, Optional
from ..models.schemas import DeliveryEvent, TurningPoint

def detect_turning_points(
    match_id: str,
    deliveries: List[DeliveryEvent],
    top_n: int = 5
) -> List[TurningPoint]:
    """
    Detects the most pivotal turning points in the second innings chase
    by examining momentum swings across windows (1 to 6 balls),
    filtering heavily overlapping segments, and ranking by probability shift magnitude.
    """
    if len(deliveries) < 2:
        return []

    candidates = []
    num_deliveries = len(deliveries)

    # Candidate windows: over-level chunks, 3-ball mini-windows, and key individual ball spikes
    window_sizes = [1, 3, 6]

    for w_size in window_sizes:
        for start_idx in range(num_deliveries - 1):
            end_idx = min(num_deliveries - 1, start_idx + w_size)
            if start_idx >= end_idx:
                continue

            prob_before = deliveries[start_idx].win_probability
            prob_after = deliveries[end_idx].win_probability

            if prob_before is None or prob_after is None:
                continue

            delta = prob_after - prob_before
            abs_delta = abs(delta)

            # Minimum threshold to be considered a turning point (at least 6% swing)
            if abs_delta < 0.06:
                continue

            # Calculate window stats
            window_deliveries = deliveries[start_idx + 1: end_idx + 1] if w_size > 1 else [deliveries[end_idx]]
            if not window_deliveries:
                window_deliveries = [deliveries[end_idx]]

            runs_in_window = sum(d.total_runs for d in window_deliveries)
            wickets_in_window = sum(d.wicket_count_delivery for d in window_deliveries)
            batters = list({d.batter for d in window_deliveries})
            bowlers = list({d.bowler for d in window_deliveries})
            bowler_name = bowlers[0] if bowlers else "Bowler"

            start_over_label = deliveries[start_idx].display_over
            end_over_label = deliveries[end_idx].display_over

            if start_over_label == end_over_label:
                over_label = f"Over {end_over_label}"
            else:
                over_label = f"Over {start_over_label} - {end_over_label}"

            # Meaningful deterministic summary
            shift_dir = "surged" if delta > 0 else "plummeted"
            shift_sign = "+" if delta > 0 else ""
            shift_pct_str = f"{shift_sign}{round(delta * 100, 1)}%"

            summary_parts = []
            if wickets_in_window > 0:
                summary_parts.append(f"{wickets_in_window} wicket{'s' if wickets_in_window > 1 else ''} lost")
            if runs_in_window >= 15:
                summary_parts.append(f"{runs_in_window} runs scored")
            elif runs_in_window <= 2 and len(window_deliveries) >= 3:
                summary_parts.append(f"tight bowling conceding only {runs_in_window} run(s)")
            else:
                summary_parts.append(f"{runs_in_window} runs added")

            summary = f"Win probability {shift_dir} by {shift_pct_str} as {', '.join(summary_parts)} ({bowler_name})."

            supporting_ids = [d.delivery_idx for d in window_deliveries]

            candidates.append({
                "start_idx": start_idx,
                "end_idx": end_idx,
                "prob_before": prob_before,
                "prob_after": prob_after,
                "shift_magnitude": abs_delta,
                "delta": delta,
                "over_label": over_label,
                "runs_in_window": runs_in_window,
                "wickets_in_window": wickets_in_window,
                "balls_in_window": len(window_deliveries),
                "supporting_delivery_ids": supporting_ids,
                "summary": summary,
                "batters": batters,
                "bowler": bowler_name
            })

    # Sort candidates by shift magnitude descending
    candidates.sort(key=lambda x: x["shift_magnitude"], reverse=True)

    # Non-maximum suppression / overlap merging
    selected = []
    for cand in candidates:
        overlap = False
        c_set = set(range(cand["start_idx"], cand["end_idx"] + 1))
        for sel in selected:
            s_set = set(range(sel["start_idx"], sel["end_idx"] + 1))
            intersection = len(c_set.intersection(s_set))
            smaller = min(len(c_set), len(s_set))
            # Overlap threshold: if more than 50% of the window overlaps with an already selected larger/higher-ranked shift
            if smaller > 0 and (intersection / smaller) > 0.5:
                overlap = True
                break
        if not overlap:
            selected.append(cand)
            if len(selected) >= top_n:
                break

    # Format into TurningPoint models
    result: List[TurningPoint] = []
    # Sort chronologically or by rank? We keep top 5 ranked, but provide clear rank IDs
    for idx, item in enumerate(selected):
        tp_id = f"tp_{match_id}_{idx + 1}"
        result.append(TurningPoint(
            id=tp_id,
            match_id=match_id,
            start_delivery_idx=item["start_idx"],
            end_delivery_idx=item["end_idx"],
            over_label=item["over_label"],
            prob_before=round(item["prob_before"], 4),
            prob_after=round(item["prob_after"], 4),
            shift_percentage=round(item["delta"] * 100, 1),
            runs_in_window=item["runs_in_window"],
            wickets_in_window=item["wickets_in_window"],
            balls_in_window=item["balls_in_window"],
            supporting_delivery_ids=item["supporting_delivery_ids"],
            summary=item["summary"],
            batters_involved=item["batters"],
            bowler_involved=item["bowler"]
        ))

    return result
