import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { DeliveryEvent, TurningPoint } from '../types/cricket';
import { Eye, EyeOff, Zap, Flame, Clock } from 'lucide-react';

interface WinProbabilityChartProps {
  deliveries: DeliveryEvent[];
  currentDeliveryIndex: number;
  turningPoints: TurningPoint[];
  fullMatchAnalysis: boolean;
  onToggleFullMatchAnalysis: () => void;
  onSeek: (index: number) => void;
  onSelectTurningPoint: (tp: TurningPoint) => void;
}

export const WinProbabilityChart: React.FC<WinProbabilityChartProps> = ({
  deliveries,
  currentDeliveryIndex,
  turningPoints,
  fullMatchAnalysis,
  onToggleFullMatchAnalysis,
  onSeek,
  onSelectTurningPoint,
}) => {
  // Filter data according to fullMatchAnalysis setting
  const chartData = useMemo(() => {
    return deliveries.map((d, idx) => {
      const isPastOrCurrent = idx <= currentDeliveryIndex;
      const probValue = d.win_probability !== null ? d.win_probability * 100 : 50;

      return {
        idx: d.delivery_idx,
        display_over: d.display_over,
        score: d.score,
        wickets: d.wickets_lost,
        runs_required: d.runs_required,
        batter: d.batter,
        bowler: d.bowler,
        event: d.event_description,
        win_probability: (fullMatchAnalysis || isPastOrCurrent) ? Math.round(probValue * 10) / 10 : null,
        actual_prob: Math.round(probValue * 10) / 10,
        isCurrent: idx === currentDeliveryIndex,
        isPastOrCurrent,
      };
    });
  }, [deliveries, currentDeliveryIndex, fullMatchAnalysis]);

  const currentDel = deliveries[currentDeliveryIndex];
  const currentProb = currentDel?.win_probability !== null ? currentDel.win_probability * 100 : 50;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-sm relative" data-testid="win-probability-chart-card">
      {/* Top Header of Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#17191F] font-display flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#E31E24]" />
              Win Probability Timeline
            </h3>
            <span className="text-[11px] text-[#667085] font-mono-numbers">
              (Over 0.1 → 20.0)
            </span>
          </div>
          <p className="text-xs text-[#667085] mt-0.5">
            ML-estimated win likelihood of the chasing team updated on every legal and illegal delivery
          </p>
        </div>

        {/* Full match analysis toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFullMatchAnalysis}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs min-h-[32px] ${
              fullMatchAnalysis
                ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                : 'bg-[#F9FAFB] border-[#EAECF0] text-[#475467] hover:text-[#17191F] hover:bg-[#F2F4F7]'
            }`}
            data-testid="toggle-full-timeline-btn"
          >
            {fullMatchAnalysis ? (
              <>
                <Eye className="w-3.5 h-3.5 text-[#E31E24]" />
                <span>Full Timeline Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-[#98A2B3]" />
                <span>Hide Future Outcomes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Recharts Chart Container */}
      <div className="h-64 sm:h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
            onClick={(e: any) => {
              const clickedIdx = e?.activePayload?.[0]?.payload?.idx ?? e?.activeTooltipIndex;
              if (typeof clickedIdx === 'number' && clickedIdx >= 0 && clickedIdx < deliveries.length) {
                onSeek(clickedIdx);
              }
            }}
          >
            <defs>
              <linearGradient id="probGradientD11" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E31E24" stopOpacity={0.35} />
                <stop offset="60%" stopColor="#E31E24" stopOpacity={0.10} />
                <stop offset="95%" stopColor="#E31E24" stopOpacity={0.01} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="display_over"
              stroke="#D0D5DD"
              tick={{ fill: '#667085', fontSize: 10, fontFamily: 'monospace' }}
              interval={18}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#D0D5DD"
              tick={{ fill: '#667085', fontSize: 10, fontFamily: 'monospace' }}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
            />

            {/* 50% Equilibrium Reference Line */}
            <ReferenceLine
              y={50}
              stroke="#D0D5DD"
              strokeDasharray="3 3"
              label={{
                value: '50% Balance',
                fill: '#98A2B3',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />

            {/* Current Scrub Position Line */}
            {currentDel && (
              <ReferenceLine
                x={currentDel.display_over}
                stroke="#E31E24"
                strokeWidth={2}
                label={{
                  value: `${Math.round(currentProb)}%`,
                  fill: '#E31E24',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  position: 'top',
                }}
              />
            )}

            {/* Turning Point Dots along the chart */}
            {turningPoints.map((tp) => {
              const tpDel = deliveries[tp.end_delivery_idx];
              if (!tpDel) return null;
              const isPast = tp.end_delivery_idx <= currentDeliveryIndex;
              if (!fullMatchAnalysis && !isPast) return null;

              const isPositive = tp.shift_percentage > 0;
              const dotColor = isPositive ? '#027A48' : '#D92D20';

              return (
                <ReferenceDot
                  key={tp.id}
                  x={tpDel.display_over}
                  y={tp.prob_after * 100}
                  r={5}
                  fill={dotColor}
                  stroke="#ffffff"
                  strokeWidth={2}
                  onClick={() => onSelectTurningPoint(tp)}
                  className="cursor-pointer hover:scale-150 transition-transform"
                />
              );
            })}

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const prob = data.win_probability;
                  const isChasingFavored = prob !== null && prob >= 50;
                  const isFuture = !data.isPastOrCurrent;

                  return (
                    <div className="bg-white/95 border border-[#EAECF0] p-3 rounded-xl shadow-xl backdrop-blur-md text-xs min-w-[220px] max-w-[280px] text-[#17191F]">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#EAECF0] gap-2">
                        <span className="font-bold text-[#17191F] font-mono-numbers flex items-center gap-1.5">
                          Over {data.display_over}
                          {isFuture && (
                            <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-[#F2F4F7] text-[#667085]">
                              Future
                            </span>
                          )}
                        </span>
                        <span
                          className={`font-black font-mono-numbers ${
                            isChasingFavored ? 'text-[#027A48]' : 'text-[#D92D20]'
                          }`}
                        >
                          {prob !== null ? `${prob}% Win Prob` : 'Future ball (hidden)'}
                        </span>
                      </div>
                      <div className="space-y-1 text-[#344054]">
                        <div className="flex justify-between">
                          <span className="text-[#667085]">Score:</span>
                          <span className="font-mono-numbers font-bold text-[#17191F]">
                            {data.score}/{data.wickets}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#667085]">Need:</span>
                          <span className="font-mono-numbers font-bold text-[#B54708]">
                            {data.runs_required} runs
                          </span>
                        </div>
                        <div className="text-[11px] text-[#475467] italic pt-1.5 border-t border-[#EAECF0] mt-1 break-words leading-snug">
                          {data.bowler} → {data.batter}: {data.event}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Area
              type="monotone"
              dataKey="win_probability"
              stroke="#E31E24"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#probGradientD11)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Turning Point Jump Bar under the Chart */}
      <div className="mt-3.5 pt-3.5 border-t border-[#EAECF0] flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1 shrink-0">
          <Flame className="w-3.5 h-3.5 text-[#E31E24]" />
          Turning Points:
        </span>
        {turningPoints.map((tp, idx) => {
          const isSelected = tp.end_delivery_idx === currentDeliveryIndex;
          const isPositive = tp.shift_percentage > 0;
          return (
            <button
              key={tp.id}
              onClick={() => {
                onSeek(tp.end_delivery_idx);
                onSelectTurningPoint(tp);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono-numbers border transition-all cursor-pointer shadow-xs min-h-[32px] whitespace-nowrap ${
                isSelected
                  ? 'bg-[#FEF3F2] border-2 border-[#E31E24] text-[#B42318] font-bold ring-1 ring-[#E31E24]/20'
                  : isPositive
                  ? 'bg-[#ECFDF3]/80 hover:bg-[#ECFDF3] border-[#A6F4C5] text-[#027A48]'
                  : 'bg-[#FEF3F2]/80 hover:bg-[#FEF3F2] border-[#FECDCA] text-[#D92D20]'
              }`}
              title={`Jump to ${tp.over_label}: ${tp.summary}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isPositive ? 'bg-[#027A48]' : 'bg-[#D92D20]'}`} />
              <span className="font-medium text-[#17191F]">TP#{idx + 1} ({tp.over_label})</span>
              <span className={isPositive ? 'text-[#027A48] font-bold' : 'text-[#D92D20] font-bold'}>
                {isPositive ? '+' : ''}{tp.shift_percentage}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
