import os
import glob
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

NON_WICKET_DISMISSALS = {"retired hurt"}

FEATURE_COLS = [
    "target_runs",
    "score",
    "wickets_lost",
    "legal_balls_bowled",
    "balls_remaining",
    "runs_required",
    "current_run_rate",
    "required_run_rate",
    "wickets_remaining",
    "recent_run_rate",
]

def extract_features_from_match(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    info = data.get("info", {})
    innings = data.get("innings", [])
    
    if len(innings) < 2:
        return []
        
    outcome = info.get("outcome", {})
    winner = outcome.get("winner")
    if not winner:
        # Match tied, no result, etc.
        return []
        
    inn1 = innings[0]
    inn2 = innings[1]
    
    # Exclude rain affected / DLS / super over revised matches to maintain clean dataset
    if "method" in outcome or outcome.get("result") in ["tie", "no result"]:
        return []
        
    chasing_team = inn2.get("team")
    if not chasing_team:
        return []
        
    chasing_team_won = 1 if winner == chasing_team else 0
    season = str(info.get("season", "Unknown"))
    match_id = os.path.splitext(os.path.basename(filepath))[0]
    
    # Calculate 1st innings total
    first_inn_runs = sum(
        d.get("runs", {}).get("total", 0)
        for over in inn1.get("overs", [])
        for d in over.get("deliveries", [])
    )
    target_runs = first_inn_runs + 1
    scheduled_overs = info.get("overs", 20)
    scheduled_balls = scheduled_overs * 6
    
    rows = []
    current_score = 0
    wickets_lost = 0
    legal_balls = 0
    
    recent_runs_window = []  # track runs on last 12 legal balls
    
    for over in inn2.get("overs", []):
        for d in over.get("deliveries", []):
            runs_info = d.get("runs", {})
            extras_info = d.get("extras", {})
            
            total_runs = runs_info.get("total", 0)
            is_wide = "wides" in extras_info
            is_noball = "noballs" in extras_info
            is_legal = not (is_wide or is_noball)
            
            w_count = 0
            for w in d.get("wickets", []):
                if w.get("kind") not in NON_WICKET_DISMISSALS:
                    w_count += 1
                    
            current_score += total_runs
            wickets_lost += w_count
            
            if is_legal:
                legal_balls += 1
                recent_runs_window.append(total_runs)
                if len(recent_runs_window) > 12:
                    recent_runs_window.pop(0)
            else:
                # Add extra runs to the recent window
                if recent_runs_window:
                    recent_runs_window[-1] += total_runs
            
            balls_remaining = max(0, scheduled_balls - legal_balls)
            runs_required = max(0, target_runs - current_score)
            wickets_remaining = max(0, 10 - wickets_lost)
            
            crr = (current_score / legal_balls) * 6.0 if legal_balls > 0 else 0.0
            
            if runs_required == 0:
                rrr = 0.0
            elif balls_remaining > 0:
                rrr = min(36.0, (runs_required / balls_remaining) * 6.0)
            else:
                rrr = 36.0
                
            recent_rr = (sum(recent_runs_window) / len(recent_runs_window)) * 6.0 if recent_runs_window else crr
            
            # Non-terminal row for training
            if current_score < target_runs and wickets_lost < 10 and balls_remaining > 0:
                rows.append({
                    "match_id": match_id,
                    "season": season,
                    "target_runs": target_runs,
                    "score": current_score,
                    "wickets_lost": wickets_lost,
                    "legal_balls_bowled": legal_balls,
                    "balls_remaining": balls_remaining,
                    "runs_required": runs_required,
                    "current_run_rate": round(crr, 2),
                    "required_run_rate": round(rrr, 2),
                    "wickets_remaining": wickets_remaining,
                    "recent_run_rate": round(recent_rr, 2),
                    "chasing_won": chasing_team_won
                })
            else:
                # Terminal reached
                break
                
        if current_score >= target_runs or wickets_lost >= 10:
            break
            
    return rows

def train_and_evaluate():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "ipl_all")
    all_files = glob.glob(os.path.join(data_dir, "*.json"))
    print(f"Extracting features from {len(all_files)} matches...")
    
    all_rows = []
    for fp in all_files:
        try:
            match_rows = extract_features_from_match(fp)
            all_rows.extend(match_rows)
        except Exception:
            continue
            
    df = pd.DataFrame(all_rows)
    print(f"Extracted {len(df)} second-innings delivery states from {df['match_id'].nunique()} matches.")
    
    # Chronological split
    # Map season to standard year
    def clean_season(s):
        s = str(s).split("/")[0]
        try:
            return int(s)
        except:
            return 2015
            
    df["season_year"] = df["season"].apply(clean_season)
    
    train_mask = df["season_year"] <= 2021
    val_mask = df["season_year"] == 2022
    test_mask = df["season_year"] >= 2023
    
    X_train = df.loc[train_mask, FEATURE_COLS]
    y_train = df.loc[train_mask, "chasing_won"]
    
    X_val = df.loc[val_mask, FEATURE_COLS]
    y_val = df.loc[val_mask, "chasing_won"]
    
    X_test = df.loc[test_mask, FEATURE_COLS]
    y_test = df.loc[test_mask, "chasing_won"]
    
    print(f"Train samples: {len(X_train)} (matches: {df.loc[train_mask, 'match_id'].nunique()})")
    print(f"Val samples:   {len(X_val)} (matches: {df.loc[val_mask, 'match_id'].nunique()})")
    print(f"Test samples:  {len(X_test)} (matches: {df.loc[test_mask, 'match_id'].nunique()})")
    
    # Model: Calibrated Logistic Regression + Gradient Boosting Ensemble or Calibrated Classifier
    # Logistic Regression with StandardScaler provides smooth, monotonic, beautifully calibrated win probabilities
    base_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=1000, C=1.0, random_state=42))
    ])
    
    # Calibrate using 5-fold cross-validation on train set
    calibrated_clf = CalibratedClassifierCV(estimator=base_pipe, cv=5, method="sigmoid")
    calibrated_clf.fit(X_train, y_train)
    
    # Evaluation on Test set
    y_test_pred_prob = calibrated_clf.predict_proba(X_test)[:, 1]
    
    brier = brier_score_loss(y_test, y_test_pred_prob)
    logloss = log_loss(y_test, y_test_pred_prob)
    roc_auc = roc_auc_score(y_test, y_test_pred_prob)
    
    prob_true, prob_pred = calibration_curve(y_test, y_test_pred_prob, n_bins=10)
    
    metrics = {
        "brier_score": round(float(brier), 4),
        "log_loss": round(float(logloss), 4),
        "roc_auc": round(float(roc_auc), 4),
        "train_samples": int(len(X_train)),
        "val_samples": int(len(X_val)),
        "test_samples": int(len(X_test)),
        "train_matches": int(df.loc[train_mask, 'match_id'].nunique()),
        "val_matches": int(df.loc[val_mask, 'match_id'].nunique()),
        "test_matches": int(df.loc[test_mask, 'match_id'].nunique()),
        "calibration": {
            "prob_true": [round(float(p), 4) for p in prob_true],
            "prob_pred": [round(float(p), 4) for p in prob_pred]
        }
    }
    
    print("\n--- Actual Measured Model Metrics (Test Set >= 2023) ---")
    print(f"Brier Score: {metrics['brier_score']}")
    print(f"Log Loss:    {metrics['log_loss']}")
    print(f"ROC-AUC:     {metrics['roc_auc']}")
    
    # Save model and artifacts
    model_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend", "data", "model")
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, "win_probability_model.joblib")
    joblib.dump(calibrated_clf, model_path)
    print(f"Saved calibrated model to {model_path}")
    
    schema_path = os.path.join(model_dir, "feature_schema.json")
    with open(schema_path, "w") as f:
        json.dump({"features": FEATURE_COLS}, f, indent=2)
        
    metrics_path = os.path.join(model_dir, "model_metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved metrics to {metrics_path}")

if __name__ == "__main__":
    train_and_evaluate()
