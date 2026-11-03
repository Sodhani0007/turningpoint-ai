import React from 'react';
import { Activity, Cpu, ShieldCheck, Database, Radio } from 'lucide-react';
import { BackendStatus } from '../types/cricket';

interface HeaderProps {
  backendStatus: BackendStatus | null;
  onOpenMetrics: () => void;
}

export const Header: React.FC<HeaderProps> = ({ backendStatus, onOpenMetrics }) => {
  const isConnected = backendStatus?.connected ?? false;
  const isAiLive = backendStatus?.aiProviderStatus === 'available';

  let statusLabel = 'Historical Offline Replay';
  let badgeColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]';

  if (isConnected) {
    if (isAiLive) {
      statusLabel = `Connected API (AI Live: ${backendStatus?.aiProviderModel || 'LLM'})`;
      badgeColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
    } else {
      statusLabel = 'Connected API (AI Provider Unavailable)';
      badgeColor = 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]';
    }
  }

  return (
    <header className="border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-display">
                TurningPoint <span className="text-emerald-400">AI</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                IPL Chase Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Understand the moments that change the game — genuine historical IPL replay & ML momentum
            </p>
          </div>
        </div>

        {/* Status badges & controls */}
        <div className="flex items-center flex-wrap gap-2.5 text-xs">
          {/* Backend / AI Provider status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800"
            data-testid="backend-status-badge"
          >
            <span className={`w-2 h-2 rounded-full ${badgeColor}`} />
            <span className="text-slate-300 font-medium">
              {statusLabel}
            </span>
          </div>

          {/* Model info button */}
          <button
            onClick={onOpenMetrics}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 transition-colors cursor-pointer"
            title="Inspect Model Performance & Calibration"
            data-testid="open-metrics-btn"
          >
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">ML Model (AUC 0.887)</span>
          </button>

          {/* Data attribution badge */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 text-slate-400">
            <Database className="w-3 h-3 text-cyan-400" />
            <span>Cricsheet Official Data</span>
          </div>
        </div>
      </div>
    </header>
  );
};
