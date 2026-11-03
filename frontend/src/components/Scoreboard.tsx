import React from 'react';
import { MatchMetadata, DeliveryEvent } from '../types/cricket';
import { Target, Timer, Flame, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ScoreboardProps {
  metadata: MatchMetadata;
  currentDelivery: DeliveryEvent;
  recentDeliveries: DeliveryEvent[];
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  metadata,
  currentDelivery,
  recentDeliveries,
}) => {
  const isChasingTeamAhead =
    currentDelivery.win_probability !== null && currentDelivery.win_probability >= 0.5;

  const winProbPct =
    currentDelivery.win_probability !== null
      ? (currentDelivery.win_probability * 100).toFixed(1)
      : '--';

  const runsNeeded = currentDelivery.runs_required;
  const ballsRemaining = currentDelivery.legal_balls_remaining;
  const isChaseComplete = currentDelivery.score >= metadata.target_runs;
  const isAllOut = currentDelivery.wickets_lost >= 10;
  const isBallsExhausted = ballsRemaining === 0;

  return (
    <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      {/* Background glow accent based on probability */}
      <div
        className={`absolute -top-24 -right-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 opacity-20 ${
          isChasingTeamAhead ? 'bg-emerald-500' : 'bg-cyan-600'
        }`}
      />

      {/* Match Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-800/80">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {metadata.venue} • {metadata.date}
          </span>
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{metadata.second_innings_team}</span>
            <span className="text-xs font-normal text-slate-400">chasing</span>
            <span className="text-emerald-400 font-mono-numbers">{metadata.target_runs}</span>
            <span className="text-xs font-normal text-slate-400">set by {metadata.first_innings_team} ({metadata.first_innings_total}/{metadata.first_innings_wickets})</span>
          </h2>
        </div>

        {/* Win Probability Broadcast Gauge */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2 shadow-inner">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Model Win Probability
            </div>
            <div className="text-xs text-slate-400 truncate max-w-[140px]">
              {metadata.second_innings_team}
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-2xl font-black font-mono-numbers tracking-tight ${
                isChasingTeamAhead ? 'text-emerald-400' : 'text-cyan-400'
              }`}
            >
              {winProbPct}%
            </span>
            {isChasingTeamAhead ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-cyan-400" />
            )}
          </div>
        </div>
      </div>

      {/* Main Score & Equation Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        {/* Score & Wickets */}
        <div className="col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/70 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Score & Overs</span>
            <span className="text-emerald-400 font-mono-numbers">Target {metadata.target_runs}</span>
          </div>
          <div className="flex items-baseline gap-3 my-1">
            <div className="text-4xl font-black text-white font-mono-numbers tracking-tight">
              {currentDelivery.score}
              <span className="text-2xl font-bold text-slate-400">/{currentDelivery.wickets_lost}</span>
            </div>
            <div className="text-sm font-semibold text-slate-400 font-mono-numbers">
              {currentDelivery.display_over} / {metadata.scheduled_overs} ov
            </div>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>CRR: <strong className="text-slate-200 font-mono-numbers">{currentDelivery.current_run_rate}</strong></span>
            <span>•</span>
            <span>RRR: <strong className={`font-mono-numbers ${currentDelivery.required_run_rate > 15 ? 'text-rose-400' : 'text-amber-400'}`}>{currentDelivery.required_run_rate > 100 ? '---' : currentDelivery.required_run_rate}</strong></span>
          </div>
        </div>

        {/* Runs Needed */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>Need</span>
          </div>
          <div className="text-2xl font-black text-white font-mono-numbers my-0.5">
            {runsNeeded} <span className="text-xs font-normal text-slate-400">runs</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {isChaseComplete ? 'Target Reached!' : `${runsNeeded} to win`}
          </div>
        </div>

        {/* Balls Remaining */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span>Balls Left</span>
          </div>
          <div className="text-2xl font-black text-white font-mono-numbers my-0.5">
            {ballsRemaining} <span className="text-xs font-normal text-slate-400">balls</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {Math.floor(ballsRemaining / 6)}.{ballsRemaining % 6} overs
          </div>
        </div>

        {/* Wickets in Hand */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>In Hand</span>
          </div>
          <div className="text-2xl font-black text-white font-mono-numbers my-0.5">
            {currentDelivery.wickets_remaining} <span className="text-xs font-normal text-slate-400">wkts</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {currentDelivery.wickets_lost} down
          </div>
        </div>

        {/* Current Match Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>Phase</span>
          </div>
          <div className="text-sm font-bold text-slate-200 mt-1">
            {currentDelivery.legal_balls_bowled <= 36
              ? 'Powerplay (0-6)'
              : currentDelivery.legal_balls_bowled <= 90
              ? 'Middle Overs (7-15)'
              : 'Death Overs (16-20)'}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            {isChaseComplete
              ? 'Chase Complete'
              : isAllOut
              ? 'All Out'
              : isBallsExhausted
              ? 'Innings Finished'
              : 'Live Chase'}
          </div>
        </div>
      </div>

      {/* Current Delivery Highlight & Recent Ball Ticker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
        {/* On Strike & Bowling */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Striker:</span>
            <strong className="text-slate-100 font-semibold">{currentDelivery.batter}</strong>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Bowler:</span>
            <strong className="text-slate-100 font-semibold">{currentDelivery.bowler}</strong>
          </div>
          <span className="text-slate-700">|</span>
          <div className="text-slate-300 font-medium italic">
            "{currentDelivery.event_description}"
          </div>
        </div>

        {/* Recent Deliveries Ticker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Recent:</span>
          {recentDeliveries.map((d) => {
            let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
            let label = d.total_runs.toString();

            if (d.wicket_count_delivery > 0) {
              badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
              label = 'W';
            } else if (d.batter_runs === 6) {
              badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold';
              label = '6';
            } else if (d.batter_runs === 4) {
              badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold';
              label = '4';
            } else if (d.is_wide) {
              badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
              label = `${d.total_runs}wd`;
            } else if (d.is_noball) {
              badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
              label = `${d.total_runs}nb`;
            } else if (d.total_runs === 0) {
              badgeColor = 'bg-slate-900 text-slate-500 border-slate-800';
              label = '•';
            }

            return (
              <span
                key={d.delivery_idx}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono-numbers border ${badgeColor}`}
                title={`Over ${d.display_over}: ${d.event_description}`}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
