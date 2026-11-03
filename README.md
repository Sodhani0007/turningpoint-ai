# TurningPoint AI — Dream11 FDE Assignment

> **"Understand the moments that change the game."**  
> An AI-powered cricket companion that models and explains match momentum shifts using real historical IPL delivery data, a trained win-probability model, and evidence-grounded AI explanations.

---

## 1. Problem Statement & User Persona

In high-stakes T20 cricket, match momentum is fluid and volatile. A single over, a flurry of boundaries, or a sudden double-wicket can cause the game's balance to swing wildly. While conventional broadcast graphics display raw required run rates or black-box probability percentages, fans often wonder:
- *Why did the chasing team's probability collapse so suddenly?*
- *Which specific deliveries caused this swing?*
- *Was it a spike in required rate, dots consumed, or wickets lost?*

### Target User Persona: "The Analytical Cricket Fan"
- **Profile:** Passionate IPL and fantasy sports enthusiast who values deep game strategy over superficial score lines.
- **Pain Point:** Frustrated by black-box win probability meters that jump without contextual, evidence-backed explanations.
- **Goal:** Wants an interactive second-innings replay companion that highlights exactly *when*, *how much*, and *why* momentum shifted.

---

## 2. Product Features

1. **Four Iconic IPL Thrillers with Full Second-Innings Replay:**
   - **GT vs KKR (2023):** The Rinku Singh miracle — 205 chase, Rashid Khan hat-trick, and 5 consecutive sixes in the 20th over.
   - **MI vs CSK (2019 Final):** The 1-run thriller — Malinga's slower yorker on the final ball.
   - **KXIP vs RR (2020):** The Tewatia turnaround — Highest IPL chase (224) at Sharjah with 5 sixes in the 18th over.
   - **CSK vs MI (2021):** Pollard's Delhi blitz — 87* off 34 balls chasing 219 on the final delivery.
2. **Interactive Ball-by-Ball Replay Controls:**
   - Play, pause, restart, step back/forward, seek slider, and speed toggle (1x, 2x, 4x) with keyboard shortcut support (Spacebar, Arrows).
3. **Deterministic Cricket Parser:**
   - Strict legal ball accounting, handling wides, no-balls, byes, leg-byes, non-wicket dismissals (retired hurt), and terminal conditions.
4. **Genuine ML Win-Probability Model:**
   - Trained across **137,500 historical IPL deliveries** (1,195 matches).
   - Fully calibrated using sigmoid probability calibration.
   - Zero future leakage; strict terminal state assignment (100% on target achieved, 0% on failed chase).
5. **Automated Turning-Point Detection:**
   - Evaluates multi-ball window momentum deltas; suppresses heavily overlapping segments.
   - Ranks the top 5 pivotal moments per match with exact over labels and shift percentages.
6. **Evidence-Grounded AI Explanations:**
   - Bounded historical context strictly prohibiting future match leakage.
   - Rejects unsupported evidence IDs.
   - Includes verified precomputed fallbacks so the app works seamlessly offline without requiring an API key.
7. **Production Sports Broadcast Aesthetic:**
   - Dark theme (`#080c14`), electric green and cyan broadcast accents, responsive layout, and Recharts timeline.

---

## 3. Machine Learning Methodology & Measured Metrics

### Architecture
- **Base Estimator:** Standard-scaled Logistic Regression (`C=1.0`, `max_iter=1000`).
- **Calibration:** `CalibratedClassifierCV` using 5-fold cross-validated sigmoid calibration.
- **Feature Set:**
  1. `target_runs` (First innings total + 1)
  2. `score` (Current chasing score)
  3. `wickets_lost` (0 to 10)
  4. `legal_balls_bowled` (0 to 120)
  5. `balls_remaining` (120 - legal_balls_bowled)
  6. `runs_required` (target - score)
  7. `current_run_rate` (score / legal_overs)
  8. `required_run_rate` (runs_required / overs_remaining, capped at 36.0)
  9. `wickets_remaining` (10 - wickets_lost)
  10. `recent_run_rate` (Scoring rate over the trailing 12 legal balls)

### Chronological Train / Val / Test Split
To avoid data leakage across seasons:
- **Training Set (IPL Seasons ≤ 2021):** 96,462 delivery states (839 matches)
- **Validation Set (IPL Season 2022):** 8,619 delivery states (74 matches)
- **Test Set (IPL Seasons ≥ 2023):** 32,419 delivery states (282 matches)

### Actual Measured Evaluation Metrics (Test Set ≥ 2023)
| Metric | Measured Value | Benchmark Interpretation |
| :--- | :--- | :--- |
| **ROC-AUC** | **0.8870** | Strong discriminative ability between winning and losing states |
| **Brier Score** | **0.1436** | Low mean squared probability error (< 0.15 is considered well-calibrated) |
| **Log Loss** | **0.4357** | Well-penalized cross-entropy loss on out-of-sample seasons |

---

## 4. System Architecture

```
turningpoint-ai/
├── backend/
│   ├── app/
│   │   ├── api/routes.py           # FastAPI endpoints (/health, /matches, /replay, /explain)
│   │   ├── core/config.py          # CORS & environment configuration
│   │   ├── models/schemas.py       # Pydantic schemas (Metadata, Delivery, TurningPoint, etc.)
│   │   ├── services/
│   │   │   ├── parser.py           # Deterministic Cricsheet JSON parser & edge-case handler
│   │   │   ├── ml_model.py         # Win-probability model loader & inference engine
│   │   │   ├── turning_points.py   # Multi-window swing detector & overlap suppressor
│   │   │   └── explainer.py        # Evidence payload builder & LLM / precomputed explainer
│   │   └── main.py                 # FastAPI application root
│   ├── data/
│   │   ├── matches/                # Offline curated Cricsheet JSON files
│   │   ├── model/                  # Fitted .joblib model, schema, and metrics
│   │   └── precomputed/            # Build-time precomputed replays & turning points
│   └── tests/                      # Automated Pytest suite (12 passed tests)
├── frontend/
│   ├── src/
│   │   ├── components/             # Broadcast Scoreboard, Chart, Controls, Modals
│   │   ├── data/                   # Precomputed bundle fallback for static deployment
│   │   ├── services/api.ts         # Dual-mode API service (FastAPI live + static fallback)
│   │   ├── types/cricket.ts        # TypeScript interfaces
│   │   ├── App.tsx                 # Single-source-of-truth replay orchestrator
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── Dockerfile                      # Production container spec
├── render.yaml                     # Render deployment blueprint
├── vercel.json                     # Vercel SPA deployment configuration
└── README.md
```

---

## 5. Local Setup Instructions

### Prerequisites
- Node.js ≥ 20.x and npm ≥ 10.x
- Python ≥ 3.12 (compatible with 3.12 - 3.14)

### 1. Backend Setup
```bash
# In repository root:
python -m venv backend_venv

# Activate virtual environment:
# Windows (PowerShell):
.\backend_venv\Scripts\Activate.ps1
# macOS/Linux:
source backend_venv/bin/activate

# Install backend dependencies:
pip install -r backend/requirements.txt

# Run backend test suite:
pytest backend/tests/ -v

# Start FastAPI backend:
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be live at: `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run build   # Type-check and build production bundle
npm run dev     # Start Vite development server
```
Frontend will be live at: `http://localhost:5173`

---

## 6. Deployment Guide

### Frontend Deployment (Vercel)
1. Push this repository to GitHub.
2. Import project into Vercel and select root directory or `frontend/`.
3. Set Build Command: `npm run build`, Output Directory: `dist`.
4. (Optional) Set `VITE_API_URL` to your live backend URL. If omitted, the frontend automatically serves from its precomputed bundle.

### Backend Deployment (Render / Railway / Docker)
- Deploy using the provided `render.yaml` or `Dockerfile`:
```bash
docker build -t turningpoint-ai-backend .
docker run -p 8000:8000 turningpoint-ai-backend
```

---

## 7. 60-Second Demonstration Walkthrough

1. **Launch App (0:00 - 0:10):**
   - The interface opens on **GT vs KKR (2023)**. Notice the match scoreboard: Target 205, live CRR/RRR, and win probability timeline.
2. **Seek to Turning Point #2 (0:10 - 0:25):**
   - Click the **Rank #2 Turning Point Card** (`Over 15.4 - 16.4`).
   - The scrubber jumps instantly to Rashid Khan's hat-trick over.
   - The win probability drops sharply from 62% down to 3.6%.
   - Click **"Explain"** to inspect the 4 wickets and tactical breakdown.
3. **Replay the Final Over Thriller (0:25 - 0:50):**
   - Jump to Over 19.0. KKR needs 29 runs off 6 balls with a win probability under 0.1%.
   - Hit **Play** at **2x Speed**.
   - Watch the ball ticker and probability gauge skyrocket as Rinku Singh hits 5 consecutive sixes off Yash Dayal to cross the target on 19.6 (win prob reaches 100%).
4. **Inspect Model Diagnostics (0:50 - 1:00):**
   - Click **"ML Model (AUC 0.887)"** in the top navigation.
   - View the genuine out-of-sample ROC-AUC (0.8870), Brier score (0.1436), and chronological split.

---

## 8. Historical Replay vs. Future Live Integration

| Dimension | Historical Replay (Current Artifact) | Future Live Integration |
| :--- | :--- | :--- |
| **Ingestion** | Deterministic Cricsheet JSON parser | WebSocket / Kafka push from live sports radar feeds |
| **Latency** | Instantaneous precomputed indexing | Sub-200ms streaming inference per legal delivery |
| **State Tracking** | Complete second-innings state | Stateful match session cache (Redis / In-memory) |
| **Explanations** | Grounded precomputed & optional live LLM | Streaming token LLM with live commentary injection |

---

## 9. Acknowledgements & Data Attribution

- **Cricsheet (cricsheet.org):** Ball-by-ball IPL dataset provided under the **Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0)**.
- **Reference Architecture:** Inspired by open-source cricket analytics work in `ipl-win-probability` and `cricketlogic`.

---

## Dream11 Submission Note (< 200 words)

> **TurningPoint AI** is an AI-powered cricket companion built for the Dream11 FDE Internship Assignment. It transforms raw ball-by-ball match data into explainable momentum intelligence.
> 
> The system features a deterministic Cricsheet parser strictly enforcing cricket laws (extras, illegal balls, and non-wicket dismissals), an ML win-probability model trained on 137,500 historical IPL deliveries achieving an out-of-sample ROC-AUC of 0.8870 and Brier score of 0.1436 across chronological splits, and a non-overlapping turning-point detector.
> 
> When users replay iconic chases—such as Rinku Singh's 5 sixes or the 2019 IPL Final—they can scrub delivery-by-delivery, observe win probabilities evolve, jump to detected turning points, and click "Explain this shift" to receive evidence-grounded AI commentary supported by verified match events without future leakage.
> 
> Built with React 19, TypeScript, Tailwind CSS, Recharts, FastAPI, and scikit-learn, the application provides dual-mode resilience: full live API inference alongside an offline precomputed bundle, ensuring a zero-friction demo requiring no user API keys.
