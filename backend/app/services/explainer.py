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
    "Explain observed factors rather than asserting unproven causality. Use plain English, be concise, and distinguish model "
    "estimates from facts. If evidence is insufficient, say so. Return structured JSON with keys: headline, explanation, "
    "takeaway, confidence_notes, supporting_delivery_ids."
)

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
        gemini_env = os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY
        openai_env = os.environ.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY

        if not self.api_key:
            if groq_env:
                self.provider = "groq"
                self.api_key = groq_env
                self.base_url = os.environ.get("GROQ_BASE_URL") or settings.GROQ_BASE_URL
                self.model = "llama-3.3-70b-versatile"
            elif gemini_env:
                self.provider = "gemini"
                self.api_key = gemini_env
                self.base_url = os.environ.get("GEMINI_BASE_URL") or settings.GEMINI_BASE_URL
                self.model = "gemini-2.0-flash"
            elif openai_env:
                self.provider = "openai"
                self.api_key = openai_env
                self.base_url = os.environ.get("OPENAI_BASE_URL") or settings.OPENAI_BASE_URL
                self.model = "gpt-4o-mini"
        else:
            self.provider = provider or "custom"
            self.model = model or "llama-3.3-70b-versatile"

        self.precomputed: Dict[str, Dict[str, Any]] = self._load_precomputed()
        
        # In-memory runtime cache for live LLM responses
        self._live_cache: Dict[str, Dict[str, Any]] = {}
        # Sliding-window rate limiter (timestamps)
        self._request_timestamps: List[float] = []
        self._rate_limit_max_per_minute = 20

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
        Deliveries past end_delivery_idx are excluded to prevent future leakage.
        """
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

    async def explain_live_strict(
        self,
        tp: TurningPoint,
        deliveries: List[DeliveryEvent],
        metadata: MatchMetadata,
        custom_prompt: Optional[str] = None
    ) -> ExplainResponse:
        """
        Execute strict live LLM inference against the configured provider.
        Bypasses all precomputed caches and deterministic fallbacks.
        Raises on any network, authentication, schema, or rate-limit error.
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
            f"by {tp.shift_percentage}% between {tp.over_label}. Rely strictly on the deliveries provided above."
        )
        if custom_prompt:
            user_content += f"\nUser Question: {custom_prompt}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
            "max_tokens": 500
        }

        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            latency_ms = int((time.time() - start_time) * 1000)

            if resp.status_code != 200:
                raise RuntimeError(
                    f"Live LLM provider returned HTTP {resp.status_code}: {resp.text}"
                )

            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)

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
                logger.warning(f"Live LLM call failed ({e}). Falling back to precomputed / deterministic.")

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
            source="deterministic_fallback"
        )

_explainer_instance = None

def get_explainer() -> ExplanationEngine:
    global _explainer_instance
    if _explainer_instance is None:
        _explainer_instance = ExplanationEngine()
    return _explainer_instance
