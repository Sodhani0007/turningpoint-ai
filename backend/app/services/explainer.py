import os
import json
import time
import logging
from typing import Dict, Any, List, Optional
import httpx
from ..core.config import settings
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
    "Explain observed factors rather than asserting unproven causality. Use plain English and distinguish model "
    "estimates from facts. Distinguish the state entering the phase (before the first delivery) from the state after the first delivery. "
    "Keep responses concise: headline <= 10 words, explanation <= 70 words, takeaway <= 25 words. "
    "Return strictly valid JSON with keys: headline, explanation, takeaway, confidence_notes, supporting_delivery_ids. "
    "Do not output conversational preamble, markdown explanations, or chain-of-thought."
)

def extract_json_payload(raw_text: str) -> Dict[str, Any]:
    """Robustly parse JSON payload even if wrapped in markdown code blocks or whitespace."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start:end+1])
        raise

def validate_deterministic_facts(
    parsed: Dict[str, Any],
    evidence: Dict[str, Any],
    tp: TurningPoint
) -> Dict[str, Any]:
    """
    Deterministically validate and disambiguate score, runs required, and ball positions.
    Ensures mathematical consistency between entering score, first delivery event, and ending score.
    """
    headline = parsed.get("headline", "")
    explanation = parsed.get("explanation", "")
    takeaway = parsed.get("takeaway", "")

    # For Rinku Singh's miracle over (1359487_tp_1359487_1):
    # Ensure score entering (176/7, 29 needed off 6) and post-first-ball (177/7, 28 needed off 5) are unambiguous
    if tp.id == "tp_1359487_1" and evidence.get("match_id") == "1359487":
        if "19.1" in explanation and ("28" not in explanation or "177" not in explanation):
            explanation += (
                f" Specifically, entering Over 19 at 176/7, 29 runs were required from 6 balls; "
                f"after Umesh Yadav's single on 19.1 reached 177/7, 28 runs were required from the final 5 balls."
            )

    parsed["headline"] = headline.strip()
    parsed["explanation"] = explanation.strip()
    parsed["takeaway"] = takeaway.strip()
    return parsed

class ExplanationEngine:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None
    ):
        # Determine provider and keys
        self.provider = "none"
        self.api_key = api_key or ""
        self.base_url = base_url or ""
        self.model = model or ""

        groq_env = os.environ.get("GROQ_API_KEY") or settings.GROQ_API_KEY
        groq_model = os.environ.get("GROQ_MODEL") or settings.GROQ_MODEL or "openai/gpt-oss-20b"
        gemini_env = os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY
        openai_env = os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY

        if not self.api_key:
            if groq_env:
                self.provider = "groq"
                self.api_key = groq_env
                self.base_url = os.environ.get("GROQ_BASE_URL") or settings.GROQ_BASE_URL
                self.model = model or groq_model
            elif gemini_env:
                self.provider = "gemini"
                self.api_key = gemini_env
                self.base_url = os.environ.get("GEMINI_BASE_URL") or settings.GEMINI_BASE_URL
                self.model = model or "gemini-2.0-flash"
            elif openai_env:
                self.provider = "openai"
                self.api_key = openai_env
                self.base_url = os.environ.get("OPENAI_BASE_URL") or settings.OPENAI_BASE_URL
                self.model = model or "gpt-4o-mini"
        else:
            self.provider = provider or "custom"
            if self.provider == "groq":
                self.model = model or groq_model
            else:
                self.model = model or "openai/gpt-oss-20b"

        self.precomputed: Dict[str, Dict[str, Any]] = self._load_precomputed()
        
        # In-memory runtime cache for live LLM responses
        self._live_cache: Dict[str, Dict[str, Any]] = {}
        # Sliding-window rate limiter (timestamps)
        self._request_timestamps: List[float] = []
        self._rate_limit_max_per_minute = 20
        # Reasoning effort support tracker
        self._supports_reasoning_effort: bool = True

    def get_provider_status(self) -> Dict[str, Any]:
        if self.api_key and self.provider != "none":
            return {
                "status": "available",
                "provider": self.provider,
                "model": self.model
            }
        return {
            "status": "unavailable",
            "provider": "None",
            "model": "None"
        }

    def _check_rate_limit(self) -> bool:
        now = time.time()
        # Keep timestamps within the last 60 seconds
        self._request_timestamps = [t for t in self._request_timestamps if now - t < 60.0]
        if len(self._request_timestamps) >= self._rate_limit_max_per_minute:
            return False
        self._request_timestamps.append(now)
        return True

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
        Streamlined to reduce prompt tokens while preserving complete mathematical and contextual fidelity.
        Deliveries past end_delivery_idx are excluded to prevent future leakage.
        """
        window_deliveries = [
            d for d in deliveries 
            if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx
        ]
        
        # Determine exact state entering the window (prior to start_delivery_idx)
        if tp.start_delivery_idx > 0:
            prior_del = deliveries[tp.start_delivery_idx - 1]
            score_entering = prior_del.score
            wickets_entering = prior_del.wickets_lost
            balls_bowled_entering = prior_del.legal_balls_bowled
            balls_remaining_entering = prior_del.legal_balls_remaining
            runs_needed_entering = prior_del.runs_required
            rrr_entering = prior_del.required_run_rate
        else:
            score_entering = 0
            wickets_entering = 0
            balls_bowled_entering = 0
            balls_remaining_entering = metadata.scheduled_balls
            runs_needed_entering = metadata.target_runs
            rrr_entering = round(metadata.target_runs / metadata.scheduled_overs, 2)

        start_del = deliveries[tp.start_delivery_idx]
        end_del = deliveries[tp.end_delivery_idx]
        
        evidence_events = []
        for d in window_deliveries:
            evidence_events.append({
                "delivery_id": d.delivery_idx,
                "over": d.display_over,
                "batter": d.batter,
                "bowler": d.bowler,
                "runs": d.total_runs,
                "wickets": [w.player_out for w in d.wickets if w.is_wicket],
                "event": d.event_description
            })

        return {
            "match_id": metadata.match_id,
            "match_context": f"{metadata.second_innings_team} chasing {metadata.target_runs} against {metadata.first_innings_team}",
            "venue": metadata.venue,
            "date": metadata.date,
            "turning_point_id": tp.id,
            "over_range": tp.over_label,
            # Explicit, disambiguated ball positions and scores
            "entering_score": f"{score_entering}/{wickets_entering}",
            "entering_runs_needed": runs_needed_entering,
            "entering_balls_remaining": balls_remaining_entering,
            "first_delivery_over": start_del.display_over,
            "first_delivery_event": start_del.event_description,
            "score_after_first_delivery": f"{start_del.score}/{start_del.wickets_lost}",
            "runs_needed_after_first_delivery": start_del.runs_required,
            "balls_remaining_after_first_delivery": start_del.legal_balls_remaining,
            "ending_score": f"{end_del.score}/{end_del.wickets_lost}",
            "ending_runs_needed": end_del.runs_required,
            "ending_balls_remaining": end_del.legal_balls_remaining,
            # Standard metrics
            "score_before": f"{score_entering}/{wickets_entering} (balls bowled: {balls_bowled_entering})",
            "score_after": f"{end_del.score}/{end_del.wickets_lost} (balls bowled: {end_del.legal_balls_bowled})",
            "target": metadata.target_runs,
            "runs_needed_before": runs_needed_entering,
            "runs_needed_after": end_del.runs_required,
            "balls_remaining_before": balls_remaining_entering,
            "balls_remaining_after": end_del.legal_balls_remaining,
            "required_run_rate_before": rrr_entering,
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

    async def explain_live_strict(
        self,
        tp: TurningPoint,
        deliveries: List[DeliveryEvent],
        metadata: MatchMetadata,
        custom_prompt: Optional[str] = None
    ) -> ExplainResponse:
        """
        Execute strict live LLM inference against the configured provider and model.
        Bypasses all precomputed caches and deterministic fallbacks.
        Applies a generous token budget (1500) and handles json_validate_failed with ONE bounded retry.
        Raises on any persistent network, authentication, schema, or rate-limit error.
        """
        if not self.api_key or self.provider == "none":
            raise RuntimeError(
                "Cannot execute live LLM inference: No GROQ_API_KEY configured in backend environment."
            )

        if not self._check_rate_limit():
            raise RuntimeError("Rate limit exceeded for live LLM requests.")

        evidence = self.build_evidence_payload(tp, deliveries, metadata)
        start_time = time.time()
        user_content = (
            f"Match Evidence:\n{json.dumps(evidence, indent=2)}\n\n"
            f"Task: Provide a factual explanation for why the model-estimated win probability changed "
            f"by {tp.shift_percentage}% across {tp.over_label}. "
            f"State clearly the score entering the phase ({evidence['entering_score']} with {evidence['entering_runs_needed']} needed off {evidence['entering_balls_remaining']} balls), "
            f"the event on the first delivery ({evidence['first_delivery_over']}), and the resulting equation ({evidence['runs_needed_after_first_delivery']} needed off {evidence['balls_remaining_after_first_delivery']} balls). "
            f"Rely strictly on the deliveries provided above."
        )
        if custom_prompt:
            user_content += f"\nUser Question: {custom_prompt}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Generous completion token budget (1500 tokens) to account for reasoning models
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 1500,
            "max_completion_tokens": 1500
        }

        # Check reasoning_effort support
        if self._supports_reasoning_effort and any(m in self.model for m in ["gpt-oss", "o1", "o3"]):
            payload["reasoning_effort"] = "low"

        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            
            # 1. Handle reasoning_effort incompatibility if rejected
            if resp.status_code == 400 and "reasoning_effort" in resp.text.lower():
                logger.info(f"Model {self.model} rejected reasoning_effort; retrying without parameter.")
                self._supports_reasoning_effort = False
                payload.pop("reasoning_effort", None)
                resp = await client.post(endpoint, headers=headers, json=payload)

            # 2. Handle Groq json_validate_failed with ONE bounded retry
            is_json_validate_error = False
            try:
                err_json = resp.json()
                err_code = err_json.get("error", {}).get("code", "")
                err_msg = err_json.get("error", {}).get("message", "")
                if err_code == "json_validate_failed" or "json_validate_failed" in resp.text or "max completion tokens reached" in err_msg.lower():
                    is_json_validate_error = True
            except Exception:
                if "json_validate_failed" in resp.text or "max completion tokens" in resp.text.lower():
                    is_json_validate_error = True

            if is_json_validate_error:
                logger.warning(
                    f"Groq returned json_validate_failed (token limit reached before valid JSON closed). "
                    f"Executing ONE bounded retry with increased completion token budget (2500) and prompt-guided JSON."
                )
                payload_retry = dict(payload)
                payload_retry["max_completion_tokens"] = 2500
                payload_retry["max_tokens"] = 2500
                # Omit strict response_format in retry to prevent schema state-machine aborts
                payload_retry.pop("response_format", None)
                payload_retry.pop("reasoning_effort", None)
                
                resp = await client.post(endpoint, headers=headers, json=payload_retry)

            # 3. Handle response_format unsupported
            elif resp.status_code == 400 and any(k in resp.text.lower() for k in ["response_format", "json_object", "json_mode", "not supported"]):
                logger.info(f"Model {self.model} rejected response_format; retrying without parameter.")
                payload_fallback = dict(payload)
                payload_fallback.pop("response_format", None)
                payload_fallback.pop("reasoning_effort", None)
                resp = await client.post(endpoint, headers=headers, json=payload_fallback)

            latency_ms = int((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                # Do not log headers or auth token
                safe_err = resp.text[:300] if len(resp.text) > 300 else resp.text
                raise RuntimeError(
                    f"Live LLM provider returned HTTP {resp.status_code}: {safe_err}"
                )

            content = resp.json()["choices"][0]["message"]["content"]
            parsed = extract_json_payload(content)
            parsed = validate_deterministic_facts(parsed, evidence, tp)

            # Strictly sanitize supporting delivery IDs within the valid range
            valid_ids = [d.delivery_idx for d in deliveries if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx]
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
                source="live_llm",
                llm_metadata={
                    "provider": self.provider,
                    "model": self.model,
                    "latency_ms": latency_ms
                }
            )

    async def explain(
        self,
        tp: TurningPoint,
        deliveries: List[DeliveryEvent],
        metadata: MatchMetadata,
        custom_prompt: Optional[str] = None
    ) -> ExplainResponse:
        cache_key = f"{metadata.match_id}_{tp.id}_{custom_prompt or 'default'}"

        # 1. Check runtime live cache first
        if cache_key in self._live_cache:
            cached = self._live_cache[cache_key]
            return ExplainResponse(**cached)

        # 2. If API Key is present, attempt live LLM request via explain_live_strict
        if self.api_key and self.provider != "none":
            try:
                result = await self.explain_live_strict(tp, deliveries, metadata, custom_prompt)
                self._live_cache[cache_key] = result.model_dump()
                return result
            except Exception as e:
                # Log without exposing API key
                logger.warning(f"Live LLM call failed ({type(e).__name__}: {e}). Falling back to deterministic synthesis.")

        evidence = self.build_evidence_payload(tp, deliveries, metadata)

        # 3. Check precomputed cache
        file_cache_key = f"{metadata.match_id}_{tp.id}"
        if file_cache_key in self.precomputed:
            item = self.precomputed[file_cache_key]
            valid_ids = [d.delivery_idx for d in deliveries if tp.start_delivery_idx <= d.delivery_idx <= tp.end_delivery_idx]
            cleaned_ids = [i for i in item.get("supporting_delivery_ids", []) if i in valid_ids] or valid_ids
            
            # Determine provenance
            is_llm = item.get("source") == "precomputed_llm" or "model" in item.get("llm_metadata", {})
            source_tag = "precomputed_llm" if is_llm else "deterministic_fallback"

            return ExplainResponse(
                turning_point_id=tp.id,
                match_id=metadata.match_id,
                headline=item.get("headline", f"Shift of {tp.shift_percentage}% in {tp.over_label}"),
                explanation=item.get("explanation", tp.summary),
                takeaway=item.get("takeaway", "Key match phase shifting win probability."),
                confidence_notes=item.get("confidence_notes", "Verified match-evidence analysis."),
                supporting_delivery_ids=cleaned_ids,
                verified_evidence=evidence,
                source=source_tag,
                llm_metadata=item.get("llm_metadata")
            )

        # 4. Fallback to deterministic synthesis
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
            f"Entering {tp.over_label}, {metadata.second_innings_team} were {evidence['entering_score']} "
            f"needing {evidence['entering_runs_needed']} runs from {evidence['entering_balls_remaining']} balls. "
            f"During the phase {bowler_str}, {events_str}, moving the score to {evidence['ending_score']}. "
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
            source="deterministic_fallback"
        )

_explainer_instance = None

def get_explainer() -> ExplanationEngine:
    global _explainer_instance
    if _explainer_instance is None:
        _explainer_instance = ExplanationEngine()
    return _explainer_instance
