import { MatchSummary, MatchMetadata, DeliveryEvent, TurningPoint, ExplainResponse, ModelMetrics, BackendStatus } from '../types/cricket';
import precomputedBundle from '../data/precomputed_bundle.json';

const RAW_API_URL = import.meta.env.VITE_API_URL || '';

function buildApiUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '');
  if (!RAW_API_URL) {
    return `/api/${cleanPath}`;
  }
  const cleanBase = RAW_API_URL.replace(/\/+$/, '');
  if (cleanBase.endsWith('/api')) {
    return `${cleanBase}/${cleanPath}`;
  }
  return `${cleanBase}/api/${cleanPath}`;
}

export interface ReplayData {
  metadata: MatchMetadata;
  deliveries: DeliveryEvent[];
  turning_points: TurningPoint[];
}

export function normalizeExplainResponse(data: any): ExplainResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid explanation response: payload is null or not an object');
  }

  const rawEvidence = data.verified_evidence || {};
  const rawDeliveries = Array.isArray(rawEvidence.deliveries) ? rawEvidence.deliveries : [];

  const normalizedDeliveries = rawDeliveries.map((del: any) => {
    const runsTotal = typeof del.runs_total === 'number'
      ? del.runs_total
      : typeof del.runs === 'number'
        ? del.runs
        : 0;

    const batterRuns = typeof del.batter_runs === 'number'
      ? del.batter_runs
      : typeof del.runs === 'number'
        ? del.runs
        : runsTotal;

    const extraRuns = typeof del.extra_runs === 'number'
      ? del.extra_runs
      : Math.max(0, runsTotal - batterRuns);

    // Normalize wickets array safely handling string arrays or object arrays
    let normalizedWickets: Array<{ player: string; kind: string }> = [];
    if (Array.isArray(del.wickets)) {
      normalizedWickets = del.wickets.map((w: any) => {
        if (typeof w === 'string') {
          return { player: w, kind: 'wicket' };
        }
        if (w && typeof w === 'object') {
          return {
            player: String(w.player || w.player_out || 'Batter'),
            kind: String(w.kind || 'wicket'),
          };
        }
        return { player: 'Batter', kind: 'wicket' };
      });
    }

    // Normalized event description
    let eventDesc = '';
    if (typeof del.event_description === 'string' && del.event_description.trim()) {
      eventDesc = del.event_description.trim();
    } else if (typeof del.event === 'string' && del.event.trim()) {
      eventDesc = del.event.trim();
    } else {
      const bowler = del.bowler || 'Bowler';
      const batter = del.batter || 'Batter';
      eventDesc = `${bowler} to ${batter}, ${runsTotal} run${runsTotal === 1 ? '' : 's'}`;
    }

    return {
      delivery_id: Number(del.delivery_id ?? 0),
      over: String(del.over ?? ''),
      batter: String(del.batter ?? 'Batter'),
      bowler: String(del.bowler ?? 'Bowler'),
      runs_total: runsTotal,
      batter_runs: batterRuns,
      extra_runs: extraRuns,
      is_boundary: Boolean(del.is_boundary ?? (batterRuns === 4 || batterRuns === 6)),
      is_dot: Boolean(del.is_dot ?? (runsTotal === 0 && normalizedWickets.length === 0)),
      wickets: normalizedWickets,
      event_description: eventDesc,
    };
  });

  return {
    turning_point_id: String(data.turning_point_id || ''),
    match_id: String(data.match_id || ''),
    headline: String(data.headline || 'Momentum Shift Analysis'),
    explanation: String(data.explanation || 'Momentum shifted significantly during this phase of the chase.'),
    takeaway: String(data.takeaway || 'Crucial sequence impacting win probability.'),
    confidence_notes: data.confidence_notes ? String(data.confidence_notes) : undefined,
    supporting_delivery_ids: Array.isArray(data.supporting_delivery_ids) ? data.supporting_delivery_ids : [],
    verified_evidence: {
      match_id: String(rawEvidence.match_id || data.match_id || ''),
      match_context: String(rawEvidence.match_context || ''),
      venue: String(rawEvidence.venue || ''),
      date: String(rawEvidence.date || ''),
      over_range: String(rawEvidence.over_range || ''),
      score_before: String(rawEvidence.score_before || ''),
      score_after: String(rawEvidence.score_after || ''),
      target: Number(rawEvidence.target ?? 0),
      runs_needed_before: Number(rawEvidence.runs_needed_before ?? 0),
      runs_needed_after: Number(rawEvidence.runs_needed_after ?? 0),
      balls_remaining_before: Number(rawEvidence.balls_remaining_before ?? 0),
      balls_remaining_after: Number(rawEvidence.balls_remaining_after ?? 0),
      required_run_rate_before: Number(rawEvidence.required_run_rate_before ?? 0),
      required_run_rate_after: Number(rawEvidence.required_run_rate_after ?? 0),
      model_win_prob_before: String(rawEvidence.model_win_prob_before || '0%'),
      model_win_prob_after: String(rawEvidence.model_win_prob_after || '0%'),
      win_prob_shift: String(rawEvidence.win_prob_shift || '0%'),
      runs_in_window: Number(rawEvidence.runs_in_window ?? 0),
      wickets_in_window: Number(rawEvidence.wickets_in_window ?? 0),
      batters_involved: Array.isArray(rawEvidence.batters_involved) ? rawEvidence.batters_involved : [],
      bowler_involved: rawEvidence.bowler_involved ? String(rawEvidence.bowler_involved) : null,
      deliveries: normalizedDeliveries,
    },
    source: data.source || 'deterministic_fallback',
    llm_metadata: data.llm_metadata,
    user_question: data.user_question ? String(data.user_question) : undefined,
  };
}

export class CricketApiService {
  private backendStatus: BackendStatus = {
    connected: false,
    isOfflineFallback: true,
    aiProviderStatus: 'unavailable',
    aiProviderName: 'None',
    aiProviderModel: 'None',
  };

  private statusListeners: Array<(status: BackendStatus) => void> = [];

  onStatusChange(listener: (status: BackendStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.backendStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private updateStatus(newStatus: Partial<BackendStatus>) {
    this.backendStatus = { ...this.backendStatus, ...newStatus };
    this.statusListeners.forEach(listener => listener(this.backendStatus));
  }

  getBackendStatus(): BackendStatus {
    return this.backendStatus;
  }

  async checkBackend(): Promise<BackendStatus> {
    try {
      const url = buildApiUrl('health');
      const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
      const contentType = res.headers.get('content-type') || '';
      
      // Ensure response is genuine JSON from FastAPI, NOT an HTML SPA fallback from Vercel!
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data?.status === 'healthy') {
          this.updateStatus({
            connected: true,
            isOfflineFallback: false,
            aiProviderStatus: data.ai_provider_status || 'unavailable',
            aiProviderName: data.ai_provider_name || 'None',
            aiProviderModel: data.ai_provider_model || 'None',
          });
          return this.backendStatus;
        }
      }
    } catch {
      // Fall through to offline
    }

    this.updateStatus({
      connected: false,
      isOfflineFallback: true,
      aiProviderStatus: 'unavailable',
      aiProviderName: 'None',
      aiProviderModel: 'None',
    });
    return this.backendStatus;
  }

  async getMatches(): Promise<MatchSummary[]> {
    if (this.backendStatus.connected) {
      try {
        const url = buildApiUrl('matches');
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Backend /matches failed, switching to offline bundle:', err);
        this.updateStatus({ connected: false, isOfflineFallback: true });
      }
    }
    return precomputedBundle.summaries as MatchSummary[];
  }

  async getReplay(matchId: string): Promise<ReplayData> {
    if (this.backendStatus.connected) {
      try {
        const url = buildApiUrl(`matches/${matchId}/replay`);
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`Backend /replay for ${matchId} failed, switching to offline bundle:`, err);
        this.updateStatus({ connected: false, isOfflineFallback: true });
      }
    }
    const matchData = (precomputedBundle.replays as Record<string, ReplayData>)[matchId];
    if (matchData) {
      return matchData;
    }
    throw new Error(`Match ${matchId} not found in precomputed bundle.`);
  }

  async explainTurningPoint(
    matchId: string,
    turningPointId: string,
    customPrompt?: string
  ): Promise<ExplainResponse> {
    if (this.backendStatus.connected) {
      try {
        const url = buildApiUrl('explain');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: matchId,
            turning_point_id: turningPointId,
            custom_prompt: customPrompt,
          }),
          signal: AbortSignal.timeout(15000),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const raw = await res.json();
          const normalized = normalizeExplainResponse(raw);
          if (customPrompt && !normalized.user_question) {
            normalized.user_question = customPrompt;
          }
          return normalized;
        } else {
          const errText = await res.text();
          throw new Error(`AI service returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
        }
      } catch (err) {
        console.warn('Backend /explain call failed:', err);
        if (customPrompt) {
          // Never silently replace a failed question with the generic turning-point explanation
          throw err;
        }
      }
    }

    if (customPrompt) {
      throw new Error('Ask AI is unavailable in offline fallback mode. Connect to backend API to query the live model.');
    }

    // Fallback to verified precomputed explanations
    const cacheKey = `${matchId}_${turningPointId}`;
    const explanations = precomputedBundle.explanations as Record<string, any>;
    if (explanations[cacheKey]) {
      const exp = explanations[cacheKey];
      return normalizeExplainResponse({
        ...exp,
        source: exp.source || 'precomputed_llm',
      });
    }

    throw new Error(`Explanation for ${turningPointId} not found.`);
  }

  getModelMetrics(): ModelMetrics {
    return precomputedBundle.model_metrics as ModelMetrics;
  }

  getAttribution() {
    return precomputedBundle.attribution;
  }
}

export const apiService = new CricketApiService();
