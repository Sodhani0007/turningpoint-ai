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
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#17191F] font-display flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#E31E24]" />
            Top 5 Pivotal Match Turning Points
          </h3>
          <p className="text-xs text-[#667085] mt-0.5">
            Ranked by magnitude of model win-probability shift across non-overlapping key phases
          </p>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#F2F4F7] border border-[#EAECF0] text-[#475467] font-medium hidden sm:inline-block">
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
              className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between cursor-pointer relative overflow-hidden group shadow-xs ${
                isSelected
                  ? 'bg-white border-2 border-[#E31E24] shadow-md ring-2 ring-[#E31E24]/10'
                  : 'bg-[#F9FAFB] hover:bg-white border-[#EAECF0] hover:border-[#D0D5DD] hover:shadow-sm'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-[#E31E24] pointer-events-none" />
              )}

              {/* Card Rank Header */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#667085]">
                    Rank #{rankIdx + 1}
                  </span>
                  <div
                    className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono-numbers font-bold border ${
                      isPositive
                        ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                        : 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]'
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
                <div className="text-xs font-bold text-[#17191F] font-mono-numbers mb-1">
                  {tp.over_label}
                </div>

                {/* Window stats */}
                <div className="text-[11px] text-[#667085] mb-2 flex items-center gap-2">
                  <span className="font-semibold text-[#344054]">{tp.runs_in_window} runs</span>
                  <span>•</span>
                  <span className={tp.wickets_in_window > 0 ? 'text-[#D92D20] font-semibold' : ''}>
                    {tp.wickets_in_window} wkt{tp.wickets_in_window !== 1 ? 's' : ''}
                  </span>
                  <span>•</span>
                  <span>{tp.balls_in_window} balls</span>
                </div>

                {/* Summary */}
                <p className="text-xs text-[#344054] line-clamp-3 mb-3 leading-relaxed">
                  {tp.summary}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2.5 border-t border-[#EAECF0] flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTurningPoint(tp);
                  }}
                  className="flex items-center gap-1 text-[11px] text-[#667085] hover:text-[#17191F] transition-colors cursor-pointer font-medium"
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
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FEF3F2] hover:bg-[#FEE4E2] border border-[#FECDCA] text-[#D92D20] text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3 h-3 text-[#E31E24]" />
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
