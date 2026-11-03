export interface MatchOutcome {
  winner: string | null;
  by_runs: number | null;
  by_wickets: number | null;
  result: string | null;
  method: string | null;
}

export interface MatchMetadata {
  match_id: string;
  season: string;
  date: string;
  venue: string;
  city: string | null;
  team1: string;
  team2: string;
  toss_winner: string;
  toss_decision: string;
  player_of_match: string | null;
  first_innings_team: string;
  second_innings_team: string;
  target_runs: number;
  scheduled_overs: number;
  scheduled_balls: number;
  first_innings_total: number;
  first_innings_wickets: number;
  outcome: MatchOutcome;
}

export interface WicketEvent {
  player_out: string;
  kind: string;
  fielders: string[];
  is_wicket: boolean;
}

export interface DeliveryEvent {
  delivery_idx: number;
  over_num: number;
  ball_in_over: number;
  display_over: string;
  batter: string;
  bowler: string;
  non_striker: string;
  batter_runs: number;
  extra_runs: number;
  total_runs: number;
  is_wide: boolean;
  is_noball: boolean;
  is_bye: boolean;
  is_legbye: boolean;
  is_penalty: boolean;
  is_legal_ball: boolean;
  wickets: WicketEvent[];
  wicket_count_delivery: number;
  score: number;
  wickets_lost: number;
  wickets_remaining: number;
  legal_balls_bowled: number;
  legal_balls_remaining: number;
  target_runs: number;
  runs_required: number;
  current_run_rate: number;
  required_run_rate: number;
  is_boundary: boolean;
  is_dot: boolean;
  event_description: string;
  win_probability: number | null;
}

export interface TurningPoint {
  id: string;
  match_id: string;
  start_delivery_idx: number;
  end_delivery_idx: number;
  over_label: string;
  prob_before: number;
  prob_after: number;
  shift_percentage: number;
  runs_in_window: number;
  wickets_in_window: number;
  balls_in_window: number;
  supporting_delivery_ids: number[];
  summary: string;
  batters_involved: string[];
  bowler_involved: string | null;
}

export interface MatchSummary {
  match_id: string;
  title: string;
  subtitle: string;
  date: string;
  venue: string;
  first_innings_team: string;
  first_innings_score: string;
  second_innings_team: string;
  second_innings_score: string;
  result_text: string;
  target: number;
  total_deliveries: number;
  turning_points_count: number;
  key_hero: string | null;
}

export interface ExplainResponse {
  turning_point_id: string;
  match_id: string;
  headline: string;
  explanation: string;
  takeaway: string;
  confidence_notes?: string;
  supporting_delivery_ids: number[];
  verified_evidence: {
    match_id: string;
    match_context: string;
    venue: string;
    date: string;
    over_range: string;
    score_before: string;
    score_after: string;
    target: number;
    runs_needed_before: number;
    runs_needed_after: number;
    balls_remaining_before: number;
    balls_remaining_after: number;
    required_run_rate_before: number;
    required_run_rate_after: number;
    model_win_prob_before: string;
    model_win_prob_after: string;
    win_prob_shift: string;
    runs_in_window: number;
    wickets_in_window: number;
    batters_involved: string[];
    bowler_involved: string | null;
    deliveries: Array<{
      delivery_id: number;
      over: string;
      batter: string;
      bowler: string;
      runs_total: number;
      batter_runs: number;
      extra_runs: number;
      is_boundary: boolean;
      is_dot: boolean;
      wickets: Array<{ player: string; kind: string }>;
      event_description: string;
    }>;
  };
  source: 'ai_live' | 'precomputed';
}

export interface ModelMetrics {
  brier_score: number;
  log_loss: number;
  roc_auc: number;
  train_samples: number;
  val_samples: number;
  test_samples: number;
  train_matches: number;
  val_matches: number;
  test_matches: number;
  calibration: {
    prob_true: number[];
    prob_pred: number[];
  };
}
