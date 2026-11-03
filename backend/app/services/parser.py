import json
from typing import Dict, Any, Tuple, List, Optional
from ..models.schemas import (
    MatchMetadata, MatchOutcome, DeliveryEvent, WicketEvent
)

NON_WICKET_DISMISSALS = {"retired hurt"}

def parse_cricsheet_json(data: Dict[str, Any], match_id: str) -> Tuple[MatchMetadata, List[DeliveryEvent]]:
    info = data["info"]
    innings = data["innings"]
    
    if len(innings) < 2:
        raise ValueError(f"Match {match_id} does not have at least two innings")
    
    inn1 = innings[0]
    inn2 = innings[1]
    
    team1 = inn1["team"]
    team2 = inn2["team"]
    
    # 1st Innings total and wickets calculation
    first_inn_runs = 0
    first_inn_wickets = 0
    for over in inn1.get("overs", []):
        for d in over.get("deliveries", []):
            first_inn_runs += d.get("runs", {}).get("total", 0)
            for w in d.get("wickets", []):
                if w.get("kind") not in NON_WICKET_DISMISSALS:
                    first_inn_wickets += 1
    
    target_runs = first_inn_runs + 1
    scheduled_overs = info.get("overs", 20)
    scheduled_balls = scheduled_overs * 6
    
    outcome_raw = info.get("outcome", {})
    by_data = outcome_raw.get("by", {})
    outcome = MatchOutcome(
        winner=outcome_raw.get("winner"),
        by_runs=by_data.get("runs"),
        by_wickets=by_data.get("wickets"),
        result=outcome_raw.get("result"),
        method=outcome_raw.get("method")
    )
    
    pom = info.get("player_of_match", [None])
    player_of_match = pom[0] if pom else None
    
    dates = info.get("dates", ["Unknown"])
    match_date = dates[0] if dates else "Unknown"
    
    metadata = MatchMetadata(
        match_id=str(match_id),
        season=str(info.get("season", "Unknown")),
        date=match_date,
        venue=info.get("venue", "Unknown"),
        city=info.get("city"),
        team1=info.get("teams", [team1, team2])[0],
        team2=info.get("teams", [team1, team2])[1],
        toss_winner=info.get("toss", {}).get("winner", "Unknown"),
        toss_decision=info.get("toss", {}).get("decision", "Unknown"),
        player_of_match=player_of_match,
        first_innings_team=team1,
        second_innings_team=team2,
        target_runs=target_runs,
        scheduled_overs=scheduled_overs,
        scheduled_balls=scheduled_balls,
        first_innings_total=first_inn_runs,
        first_innings_wickets=first_inn_wickets,
        outcome=outcome
    )
    
    deliveries: List[DeliveryEvent] = []
    
    current_score = 0
    wickets_lost = 0
    legal_balls_bowled = 0
    delivery_idx = 0
    
    for over in inn2.get("overs", []):
        over_num = over.get("over", 0)  # Cricsheet uses 0-based over numbers (0 to 19)
        legal_balls_in_this_over = 0
        
        for d in over.get("deliveries", []):
            runs_info = d.get("runs", {})
            extras_info = d.get("extras", {})
            
            batter_runs = runs_info.get("batter", 0)
            extra_runs = runs_info.get("extras", 0)
            total_runs = runs_info.get("total", 0)
            
            is_wide = "wides" in extras_info
            is_noball = "noballs" in extras_info
            is_bye = "byes" in extras_info
            is_legbye = "legbyes" in extras_info
            is_penalty = "penalty" in extras_info
            
            is_legal = not (is_wide or is_noball)
            
            # Wickets handling
            wickets_list: List[WicketEvent] = []
            wicket_count_on_delivery = 0
            for w in d.get("wickets", []):
                kind = w.get("kind", "")
                is_real_wicket = kind not in NON_WICKET_DISMISSALS
                if is_real_wicket:
                    wicket_count_on_delivery += 1
                fielders = [f.get("name") for f in w.get("fielders", []) if f.get("name")]
                wickets_list.append(WicketEvent(
                    player_out=w.get("player_out", ""),
                    kind=kind,
                    fielders=fielders,
                    is_wicket=is_real_wicket
                ))
            
            # Update running totals
            current_score += total_runs
            wickets_lost += wicket_count_on_delivery
            
            if is_legal:
                legal_balls_bowled += 1
                legal_balls_in_this_over += 1
                display_ball = legal_balls_in_this_over
                display_over = f"{over_num}.{display_ball}"
            else:
                # Wide or no-ball
                suffix = "wd" if is_wide else "nb"
                display_ball = legal_balls_in_this_over + 1
                display_over = f"{over_num}.{display_ball} ({suffix})"
            
            legal_balls_remaining = max(0, scheduled_balls - legal_balls_bowled)
            runs_required = max(0, target_runs - current_score)
            wickets_remaining = max(0, 10 - wickets_lost)
            
            crr = round((current_score / legal_balls_bowled) * 6, 2) if legal_balls_bowled > 0 else 0.0
            
            if runs_required == 0:
                rrr = 0.0
            elif legal_balls_remaining > 0:
                rrr = round((runs_required / legal_balls_remaining) * 6, 2)
            else:
                rrr = 999.0
            
            is_boundary = batter_runs in (4, 6)
            is_dot = (total_runs == 0 and not is_wide and not is_noball)
            
            # Concise event description
            desc_parts = []
            if is_wide:
                desc_parts.append(f"Wide (+{extra_runs})")
            elif is_noball:
                desc_parts.append(f"No ball (+{extra_runs})")
            elif batter_runs == 4:
                desc_parts.append("FOUR!")
            elif batter_runs == 6:
                desc_parts.append("SIX!")
            elif is_dot:
                desc_parts.append("Dot ball")
            else:
                desc_parts.append(f"{total_runs} run{'s' if total_runs > 1 else ''}")
            
            if wicket_count_on_delivery > 0:
                for w in wickets_list:
                    if w.is_wicket:
                        desc_parts.append(f"WICKET: {w.player_out} ({w.kind})")
            
            event_desc = f"{d.get('bowler')} to {d.get('batter')}, " + ", ".join(desc_parts)
            
            delivery_event = DeliveryEvent(
                delivery_idx=delivery_idx,
                over_num=over_num,
                ball_in_over=display_ball,
                display_over=display_over,
                batter=d.get("batter", ""),
                bowler=d.get("bowler", ""),
                non_striker=d.get("non_striker", ""),
                batter_runs=batter_runs,
                extra_runs=extra_runs,
                total_runs=total_runs,
                is_wide=is_wide,
                is_noball=is_noball,
                is_bye=is_bye,
                is_legbye=is_legbye,
                is_penalty=is_penalty,
                is_legal_ball=is_legal,
                wickets=wickets_list,
                wicket_count_delivery=wicket_count_on_delivery,
                score=current_score,
                wickets_lost=wickets_lost,
                wickets_remaining=wickets_remaining,
                legal_balls_bowled=legal_balls_bowled,
                legal_balls_remaining=legal_balls_remaining,
                target_runs=target_runs,
                runs_required=runs_required,
                current_run_rate=crr,
                required_run_rate=rrr,
                is_boundary=is_boundary,
                is_dot=is_dot,
                event_description=event_desc,
                win_probability=None
            )
            
            deliveries.append(delivery_event)
            delivery_idx += 1
            
            # Check terminal state early exit (e.g. chase achieved or 10 wickets)
            if current_score >= target_runs or wickets_lost >= 10:
                break
        
        if current_score >= target_runs or wickets_lost >= 10:
            break
            
    return metadata, deliveries
