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
import { Eye, EyeOff, Zap, Flame } from 'lucide-react';

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
      };
    });
  }, [deliveries, currentDeliveryIndex, fullMatchAnalysis]);

  const currentDel = deliveries[currentDeliveryIndex];
  const currentProb = currentDel?.win_probability !== null ? currentDel.win_probability * 100 : 50;

  return (
    <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-2xl relative" data-testid="win-probability-chart-card">
      {/* Top Header of Chart */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-display flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              Win Probability Timeline
            </h3>
            <span className="text-[11px] text-slate-400 font-mono-numbers">
              (Over 0.1 → 20.0)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            ML-estimated win likelihood of the chasing team updated on every legal and illegal delivery
          </p>
        </div>

        {/* Full match analysis toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleFullMatchAnalysis}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              fullMatchAnalysis
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300'
            }`}
            data-testid="toggle-full-timeline-btn"
          >
            {fullMatchAnalysis ? (
              <>
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>Full Timeline Visible</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
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
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onClick={(e: any) => {
              const clickedIdx = e?.activePayload?.[0]?.payload?.idx ?? e?.activeTooltipIndex;
              if (typeof clickedIdx === 'number' && clickedIdx >= 0 && clickedIdx < deliveries.length) {
                onSeek(clickedIdx);
              }
            }}
          >
            <defs>
              <linearGradient id="probGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="display_over"
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              interval={18}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
            />

            {/* 50% Equilibrium Reference Line */}
            <ReferenceLine
              y={50}
              stroke="#334155"
              strokeDasharray="3 3"
              label={{
                value: '50% Balance',
                fill: '#64748b',
                fontSize: 10,
                position: 'insideTopRight',
              }}
            />

            {/* Current Scrub Position Line */}
            {currentDel && (
              <ReferenceLine
                x={currentDel.display_over}
                stroke="#10b981"
                strokeWidth={2}
                label={{
                  value: `${Math.round(currentProb)}%`,
                  fill: '#34d399',
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
              const dotColor = isPositive ? '#10b981' : '#f43f5e';

              return (
                <ReferenceDot
                  key={tp.id}
                  x={tpDel.display_over}
                  y={tp.prob_after * 100}
                  r={5}
                  fill={dotColor}
                  stroke="#ffffff"
                  strokeWidth={1.5}
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

                  return (
                    <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs min-w-[200px]">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                        <span className="font-bold text-slate-200 font-mono-numbers">
                          Over {data.display_over}
                        </span>
                        <span
                          className={`font-black font-mono-numbers ${
                            isChasingFavored ? 'text-emerald-400' : 'text-cyan-400'
                          }`}
                        >
                          {prob !== null ? `${prob}% Win Prob` : 'Future ball (hidden)'}
                        </span>
                      </div>
                      <div className="space-y-1 text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Score:</span>
                          <span className="font-mono-numbers font-semibold text-white">
                            {data.score}/{data.wickets}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Need:</span>
                          <span className="font-mono-numbers text-amber-300">
                            {data.runs_required} runs
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 italic pt-1 truncate max-w-[220px]">
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
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#probGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Turning Point Jump Bar under the Chart */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono-numbers border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 border-slate-800 text-slate-300'
              }`}
              title={`Jump to ${tp.over_label}: ${tp.summary}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span>TP#{idx + 1} ({tp.over_label})</span>
              <span className={isPositive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {isPositive ? '+' : ''}{tp.shift_percentage}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
