import React from 'react';
import { MatchSummary } from '../types/cricket';
import { Trophy, Calendar, MapPin, Sparkles } from 'lucide-react';

interface MatchSelectorProps {
  matches: MatchSummary[];
  selectedMatchId: string;
  onSelectMatch: (matchId: string) => void;
  isLoading: boolean;
}

export const MatchSelector: React.FC<MatchSelectorProps> = ({
  matches,
  selectedMatchId,
  onSelectMatch,
  isLoading,
}) => {
  return (
    <div className="bg-[#0e1422] border border-slate-800/90 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-300 font-display">
            Select IPL Classic Match
          </h2>
        </div>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          {matches.length} Verified Thrillers
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {matches.map((m) => {
          const isSelected = m.match_id === selectedMatchId;
          return (
            <button
              key={m.match_id}
              onClick={() => onSelectMatch(m.match_id)}
              disabled={isLoading}
              className={`text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/30'
                  : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-emerald-500/20 to-transparent pointer-events-none" />
              )}
              
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span className="flex items-center gap-1 font-mono-numbers">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {m.date}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-medium">
                  {m.turning_points_count} Pivotal Shifts
                </span>
              </div>

              <div className="font-semibold text-sm text-slate-100 line-clamp-1 mb-0.5">
                {m.title}
              </div>

              <div className="text-xs text-slate-400 line-clamp-1 mb-2">
                {m.subtitle}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-medium font-mono-numbers">
                  Target: {m.target}
                </span>
                <span className="text-slate-400 text-[10px] truncate max-w-[130px]" title={m.venue}>
                  {m.venue.split(',')[0]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
