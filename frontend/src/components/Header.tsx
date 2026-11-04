import React from 'react';
import { Activity, Cpu, Database } from 'lucide-react';
import { BackendStatus } from '../types/cricket';

interface HeaderProps {
  backendStatus: BackendStatus | null;
  onOpenMetrics: () => void;
}

export const Header: React.FC<HeaderProps> = ({ backendStatus, onOpenMetrics }) => {
  const isConnected = backendStatus?.connected ?? false;
  const isAiLive = backendStatus?.aiProviderStatus === 'available';

  let statusLabel = 'Historical Offline Replay';
  let badgeDotColor = 'bg-amber-400';

  if (isConnected) {
    if (isAiLive) {
      statusLabel = `Connected API (AI Live: ${backendStatus?.aiProviderModel || 'LLM'})`;
      badgeDotColor = 'bg-emerald-400';
    } else {
      statusLabel = 'Connected API (AI Provider Unavailable)';
      badgeDotColor = 'bg-cyan-400';
    }
  }

  return (
    <header className="border-b border-[#252830] bg-[#17191F] text-white sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#E31E24] text-white shadow-md shadow-[#E31E24]/20 shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white font-display">
                TurningPoint <span className="text-[#E31E24]">AI</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                IPL Chase Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-normal">
              Understand the moments that change the game — genuine historical IPL replay & ML momentum
            </p>
          </div>
        </div>

        {/* Status badges & controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Backend / AI Provider status */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#252830]/90 border border-[#323644] text-slate-300 text-xs font-medium"
            data-testid="backend-status-badge"
          >
            <span className={`w-2 h-2 rounded-full ${badgeDotColor} shrink-0`} />
            <span className="truncate max-w-[240px] sm:max-w-none">{statusLabel}</span>
          </div>

          {/* Model info button */}
          <button
            onClick={onOpenMetrics}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
            title="Inspect Model Performance & Calibration"
            data-testid="open-metrics-btn"
          >
            <Cpu className="w-3.5 h-3.5 text-[#E31E24]" />
            <span>ML Model (AUC 0.887)</span>
          </button>

          {/* Data attribution badge */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 px-2 py-1">
            <Database className="w-3 h-3 text-slate-400" />
            <span>Cricsheet Official Data</span>
          </div>
        </div>
      </div>
    </header>
  );
};
