import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx
from ..models.schemas import (
    ExplainRequest, ExplainResponse, TurningPoint, DeliveryEvent, MatchMetadata
)

logger = logging.getLogger(__name__)

PRECOMPUTED_EXPLANATIONS_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "precomputed", "explanations.json"
)

SYSTEM_PROMPT = (
    "You are an evidence-grounded cricket analyst helping fans understand match momentum. "
    "Use only the supplied match events and statistics. Never invent a score, wicket, player action or tactical decision. "
    "Explain observed factors rather than asserting unproven causality. Use plain English, be concise, and distinguish model "
    "estimates from facts. If evidence is insufficient, say so. Return structured JSON with keys: headline, explanation, "
    "takeaway, confidence_notes, supporting_delivery_ids."
)

class ExplanationEngine:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GROQ_API_KEY") or os.environ.get("OPENAI_API_KEY")
        self.base_url = base_url or os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
        self.precomputed: Dict[str, Dict[str, Any]] = self._load_precomputed()

    def _load_precomputed(self) -> Dict[str, Dict[str, Any]]:
        if os.path.exists(PRECOMPUTED_EXPLANATIONS_PATH):
            try:
                with open(PRECOMPUTED_EXPLANATIONS_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading precomputed explanations: {e}")
        return {}

    def save_precomputed(self, data: Dict[str, Dict[str, Any]]):
        os.makedirs(os.path.dirname(PRECOMPUTED_EXPLANATIONS_PATH), exist_ok=True)
        with open(PRECOMPUTED_EXPLANATIONS_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        self.precomputed = data

    def build_evidence_payload(
        self,
        tp: TurningPoint,
        deliveries: List[DeliveryEvent],
        metadata: MatchMetadata
    ) -> Dict[str, Any]:
        """
        Build strictly bounded historical evidence.
        Deliveries past end_delivery_idx are excluded to prevent future leakage.
        """
        # Only take deliveries within the turning point window
        window_deliveries = [
            d for d in deliveries 
            if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx
        ]
        
        start_del = deliveries[tp.start_delivery_idx]
        end_del = deliveries[tp.end_delivery_idx]
        
        evidence_events = []
        for d in window_deliveries:
            evidence_events.append({
                "delivery_id": d.delivery_idx,
                "over": d.display_over,
                "batter": d.batter,
                "bowler": d.bowler,
                "runs_total": d.total_runs,
                "batter_runs": d.batter_runs,
                "extra_runs": d.extra_runs,
                "is_boundary": d.is_boundary,
                "is_dot": d.is_dot,
                "wickets": [{"player": w.player_out, "kind": w.kind} for w in d.wickets if w.is_wicket],
                "event_description": d.event_description
            })

        return {
            "match_id": metadata.match_id,
            "match_context": f"{metadata.second_innings_team} chasing {metadata.target_runs} against {metadata.first_innings_team}",
            "venue": metadata.venue,
            "date": metadata.date,
            "turning_point_id": tp.id,
            "over_range": tp.over_label,
            "score_before": f"{start_del.score}/{start_del.wickets_lost} (balls bowled: {start_del.legal_balls_bowled})",
            "score_after": f"{end_del.score}/{end_del.wickets_lost} (balls bowled: {end_del.legal_balls_bowled})",
            "target": metadata.target_runs,
            "runs_needed_before": start_del.runs_required,
            "runs_needed_after": end_del.runs_required,
            "balls_remaining_before": start_del.legal_balls_remaining,
            "balls_remaining_after": end_del.legal_balls_remaining,
            "required_run_rate_before": start_del.required_run_rate,
            "required_run_rate_after": end_del.required_run_rate,
            "model_win_prob_before": f"{round(tp.prob_before * 100, 1)}%",
            "model_win_prob_after": f"{round(tp.prob_after * 100, 1)}%",
            "win_prob_shift": f"{'+' if tp.shift_percentage > 0 else ''}{tp.shift_percentage}%",
            "runs_in_window": tp.runs_in_window,
            "wickets_in_window": tp.wickets_in_window,
            "batters_involved": tp.batters_involved,
            "bowler_involved": tp.bowler_involved,
            "deliveries": evidence_events
        }

    async def explain(
        self,
        tp: TurningPoint,
        deliveries: List[DeliveryEvent],
        metadata: MatchMetadata,
        custom_prompt: Optional[str] = None
    ) -> ExplainResponse:
        evidence = self.build_evidence_payload(tp, deliveries, metadata)
        cache_key = f"{metadata.match_id}_{tp.id}"

        # 1. Check if precomputed explanation exists
        if cache_key in self.precomputed and not self.api_key:
            item = self.precomputed[cache_key]
            # Ensure supporting delivery IDs are valid
            valid_ids = [d.delivery_idx for d in deliveries if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx]
            cleaned_ids = [i for i in item.get("supporting_delivery_ids", []) if i in valid_ids] or valid_ids
            return ExplainResponse(
                turning_point_id=tp.id,
                match_id=metadata.match_id,
                headline=item.get("headline", f"Shift of {tp.shift_percentage}% in {tp.over_label}"),
                explanation=item.get("explanation", tp.summary),
                takeaway=item.get("takeaway", "Key match phase shifting win probability."),
                confidence_notes=item.get("confidence_notes", "Verified precomputed analysis based on verified match deliveries."),
                supporting_delivery_ids=cleaned_ids,
                verified_evidence=evidence,
                source="precomputed"
            )

        # 2. If API Key is present, try live LLM call
        if self.api_key:
            try:
                user_content = (
                    f"Match Evidence:\n{json.dumps(evidence, indent=2)}\n\n"
                    f"Task: Provide a factual explanation for why the model-estimated win probability changed "
                    f"by {tp.shift_percentage}% between {tp.over_label}. Rely strictly on the deliveries provided above."
                )
                if custom_prompt:
                    user_content += f"\nUser Question: {custom_prompt}"

                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "llama-3.3-70b-versatile" if "groq" in self.base_url.lower() else "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_content}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 500
                }

                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{self.base_url.rstrip('/')}/chat/completions",
                        headers=headers,
                        json=payload
                    )
                    if resp.status_code == 200:
                        content = resp.json()["choices"][0]["message"]["content"]
                        parsed = json.loads(content)
                        
                        valid_ids = [d.delivery_idx for d in deliveries if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx]
                        # Reject unsupported evidence IDs
                        raw_ids = parsed.get("supporting_delivery_ids", [])
                        sanitized_ids = [i for i in raw_ids if i in valid_ids]
                        if not sanitized_ids:
                            sanitized_ids = tp.supporting_delivery_ids

                        return ExplainResponse(
                            turning_point_id=tp.id,
                            match_id=metadata.match_id,
                            headline=parsed.get("headline", f"Momentum Swing in {tp.over_label}"),
                            explanation=parsed.get("explanation", tp.summary),
                            takeaway=parsed.get("takeaway", "Decisive phase in the chase."),
                            confidence_notes=parsed.get("confidence_notes", "Grounded in observed delivery events."),
                            supporting_delivery_ids=sanitized_ids,
                            verified_evidence=evidence,
                            source="ai_live"
                        )
                    else:
                        logger.warning(f"Live LLM call returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Live LLM call failed: {e}. Falling back to precomputed.")

        # 3. Fallback to precomputed or deterministic synthesis
        if cache_key in self.precomputed:
            item = self.precomputed[cache_key]
            valid_ids = [d.delivery_idx for d in deliveries if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx]
            cleaned_ids = [i for i in item.get("supporting_delivery_ids", []) if i in valid_ids] or valid_ids
            return ExplainResponse(
                turning_point_id=tp.id,
                match_id=metadata.match_id,
                headline=item.get("headline", f"Shift of {tp.shift_percentage}% in {tp.over_label}"),
                explanation=item.get("explanation", tp.summary),
                takeaway=item.get("takeaway", "Key match phase shifting win probability."),
                confidence_notes="Precomputed analysis verified against historical deliveries.",
                supporting_delivery_ids=cleaned_ids,
                verified_evidence=evidence,
                source="precomputed"
            )

        # Deterministic grounded explanation if neither LLM nor cache available
        return self._generate_deterministic_explanation(tp, evidence, metadata)

    def _generate_deterministic_explanation(
        self,
        tp: TurningPoint,
        evidence: Dict[str, Any],
        metadata: MatchMetadata
    ) -> ExplainResponse:
        direction = "in favor of" if tp.shift_percentage > 0 else "against"
        pct_abs = abs(tp.shift_percentage)
        
        events_summary = []
        if tp.wickets_in_window > 0:
            events_summary.append(f"{tp.wickets_in_window} crucial wicket{'s' if tp.wickets_in_window > 1 else ''} fell")
        if tp.runs_in_window >= 18:
            events_summary.append(f"a flurry of boundaries produced {tp.runs_in_window} runs")
        elif tp.runs_in_window <= 4:
            events_summary.append(f"disciplined bowling conceded just {tp.runs_in_window} run(s)")
        else:
            events_summary.append(f"{tp.runs_in_window} runs were scored")

        events_str = " and ".join(events_summary)
        bowler_str = f"bowled by {tp.bowler_involved}" if tp.bowler_involved else ""
        
        explanation = (
            f"During {tp.over_label} {bowler_str}, {events_str}. "
            f"The required run rate shifted from {evidence['required_run_rate_before']} to {evidence['required_run_rate_after']}, "
            f"causing the win probability model to adjust its estimate by {pct_abs}% {direction} {metadata.second_innings_team}."
        )

        headline = f"{'+' if tp.shift_percentage > 0 else ''}{tp.shift_percentage}% Shift: {tp.over_label}"
        takeaway = f"Wickets and boundary frequency in {tp.over_label} substantially altered the required equation."

        return ExplainResponse(
            turning_point_id=tp.id,
            match_id=metadata.match_id,
            headline=headline,
            explanation=explanation,
            takeaway=takeaway,
            confidence_notes="Deterministic evidence synthesis based strictly on second-innings scorecard events.",
            supporting_delivery_ids=tp.supporting_delivery_ids,
            verified_evidence=evidence,
            source="precomputed"
        )

_explainer_instance = None

def get_explainer() -> ExplanationEngine:
    global _explainer_instance
    if _explainer_instance is None:
        _explainer_instance = ExplanationEngine()
    return _explainer_instance
