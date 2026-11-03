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
          signal: AbortSignal.timeout(9000),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn('Backend /explain call failed, falling back to precomputed explanation:', err);
      }
    }

    // Fallback to verified precomputed explanations
    const cacheKey = `${matchId}_${turningPointId}`;
    const explanations = precomputedBundle.explanations as Record<string, ExplainResponse>;
    if (explanations[cacheKey]) {
      const exp = explanations[cacheKey];
      return {
        ...exp,
        source: (exp.source as any) || 'precomputed_llm',
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
