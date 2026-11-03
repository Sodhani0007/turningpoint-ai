import React from 'react';
import { TurningPoint } from '../types/cricket';
import { ArrowUpRight, ArrowDownRight, Sparkles, Navigation, Flame } from 'lucide-react';

interface TurningPointCardsProps {
  turningPoints: TurningPoint[];
  selectedTurningPointId: string | null;
  onSelectTurningPoint: (tp: TurningPoint) => void;
  onExplainTurningPoint: (tp: TurningPoint) => void;
}

export const TurningPointCards: React.FC<TurningPointCardsProps> = ({
  turningPoints,
  selectedTurningPointId,
  onSelectTurningPoint,
  onExplainTurningPoint,
}) => {
  return (
    <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            Top 5 Pivotal Match Turning Points
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ranked by magnitude of model win-probability shift across non-overlapping key phases
          </p>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-medium hidden sm:inline-block">
          Click any card to jump to moment
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {turningPoints.map((tp, rankIdx) => {
          const isSelected = tp.id === selectedTurningPointId;
          const isPositive = tp.shift_percentage > 0;
          const shiftSign = isPositive ? '+' : '';
          const shiftText = `${shiftSign}${tp.shift_percentage}%`;

          return (
            <div
              key={tp.id}
              onClick={() => onSelectTurningPoint(tp)}
              className={`p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'bg-slate-900 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Rank Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Rank #{rankIdx + 1}
                  </span>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono-numbers font-bold border ${
                      isPositive
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>{shiftText}</span>
                  </div>
                </div>

                {/* Over label */}
                <div className="text-xs font-bold text-slate-200 font-mono-numbers mb-1">
                  {tp.over_label}
                </div>

                {/* Window stats */}
                <div className="text-[11px] text-slate-400 mb-2 flex items-center gap-2">
                  <span className="font-semibold text-slate-300">{tp.runs_in_window} runs</span>
                  <span>•</span>
                  <span className={tp.wickets_in_window > 0 ? 'text-rose-400 font-semibold' : ''}>
                    {tp.wickets_in_window} wkt{tp.wickets_in_window !== 1 ? 's' : ''}
                  </span>
                  <span>•</span>
                  <span>{tp.balls_in_window} balls</span>
                </div>

                {/* Summary */}
                <p className="text-xs text-slate-300 line-clamp-3 mb-3 leading-relaxed">
                  {tp.summary}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTurningPoint(tp);
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Jump</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExplainTurningPoint(tp);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>Explain</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
