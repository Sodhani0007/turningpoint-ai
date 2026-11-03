import { MatchSummary, MatchMetadata, DeliveryEvent, TurningPoint, ExplainResponse, ModelMetrics } from '../types/cricket';
import precomputedBundle from '../data/precomputed_bundle.json';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ReplayData {
  metadata: MatchMetadata;
  deliveries: DeliveryEvent[];
  turning_points: TurningPoint[];
}

export class CricketApiService {
  private isBackendAvailable: boolean | null = null;

  async checkBackend(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      this.isBackendAvailable = res.ok;
      return res.ok;
    } catch {
      this.isBackendAvailable = false;
      return false;
    }
  }

  async getMatches(): Promise<MatchSummary[]> {
    if (this.isBackendAvailable !== false) {
      try {
        const res = await fetch(`${API_BASE}/matches`, { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
          this.isBackendAvailable = true;
          return await res.json();
        }
      } catch {
        this.isBackendAvailable = false;
      }
    }
    // Fallback to precomputed bundle
    return precomputedBundle.summaries as MatchSummary[];
  }

  async getReplay(matchId: string): Promise<ReplayData> {
    if (this.isBackendAvailable !== false) {
      try {
        const res = await fetch(`${API_BASE}/matches/${matchId}/replay`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          this.isBackendAvailable = true;
          return await res.json();
        }
      } catch {
        this.isBackendAvailable = false;
      }
    }
    // Fallback
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
    if (this.isBackendAvailable !== false) {
      try {
        const res = await fetch(`${API_BASE}/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: matchId,
            turning_point_id: turningPointId,
            custom_prompt: customPrompt,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          this.isBackendAvailable = true;
          return await res.json();
        }
      } catch {
        this.isBackendAvailable = false;
      }
    }

    // Fallback to verified precomputed explanations
    const cacheKey = `${matchId}_${turningPointId}`;
    const explanations = precomputedBundle.explanations as Record<string, ExplainResponse>;
    if (explanations[cacheKey]) {
      return {
        ...explanations[cacheKey],
        source: 'precomputed',
      };
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
