import React from 'react';
import { MatchSummary } from '../types/cricket';
import { Trophy, Calendar, Sparkles } from 'lucide-react';

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
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h2 className="text-xs sm:text-sm font-bold tracking-wide uppercase text-[#17191F] font-display">
            Select IPL Classic Match
          </h2>
        </div>
        <span className="text-xs text-[#667085] flex items-center gap-1 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-[#E31E24]" />
          {matches.length} Verified Thrillers
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {matches.map((m) => {
          const isSelected = m.match_id === selectedMatchId;
          return (
            <button
              key={m.match_id}
              onClick={() => onSelectMatch(m.match_id)}
              disabled={isLoading}
              data-testid={`match-card-${m.match_id}`}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-2 border-[#E31E24] shadow-md ring-2 ring-[#E31E24]/10'
                  : 'bg-[#F9FAFB] hover:bg-white border-[#EAECF0] hover:border-[#D0D5DD] shadow-xs hover:shadow-sm'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-2 h-full bg-[#E31E24] pointer-events-none" />
              )}
              
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#667085] mb-2">
                  <span className="flex items-center gap-1 font-mono-numbers">
                    <Calendar className="w-3 h-3 text-[#98A2B3]" />
                    {m.date}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isSelected
                        ? 'bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]'
                        : 'bg-[#F2F4F7] text-[#344054]'
                    }`}
                  >
                    {m.turning_points_count} Pivotal Shifts
                  </span>
                </div>

                <div className="font-bold text-sm text-[#17191F] line-clamp-1 mb-0.5">
                  {m.title}
                </div>

                <div className="text-xs text-[#667085] line-clamp-1 mb-3">
                  {m.subtitle}
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#EAECF0] flex items-center justify-between text-[11px]">
                <span className="text-[#027A48] font-bold font-mono-numbers bg-[#ECFDF3] px-2 py-0.5 rounded">
                  Target: {m.target}
                </span>
                <span className="text-[#667085] text-[11px] truncate max-w-[130px]" title={m.venue}>
                  {m.venue ? m.venue.split(',')[0] : 'IPL Venue'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
