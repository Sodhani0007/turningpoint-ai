import React from 'react';
import { MatchMetadata, DeliveryEvent } from '../types/cricket';
import { Target, Timer, Flame, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ScoreboardProps {
  metadata: MatchMetadata;
  currentDelivery: DeliveryEvent;
  recentDeliveries: DeliveryEvent[];
  onSeek?: (index: number) => void;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  metadata,
  currentDelivery,
  recentDeliveries,
  onSeek,
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
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden" data-testid="scoreboard-card">
      {/* Match Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#EAECF0]">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#667085]">
            {metadata.venue} • {metadata.date}
          </span>
          <h2 className="text-base sm:text-lg font-bold text-[#17191F] flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[#17191F]">{metadata.second_innings_team}</span>
            <span className="text-xs font-medium text-[#667085]">chasing</span>
            <span className="text-[#027A48] font-mono-numbers font-black bg-[#ECFDF3] px-2 py-0.5 rounded">
              {metadata.target_runs}
            </span>
            <span className="text-xs font-normal text-[#667085]">
              set by {metadata.first_innings_team} ({metadata.first_innings_total}/{metadata.first_innings_wickets})
            </span>
          </h2>
        </div>

        {/* Win Probability Broadcast Gauge */}
        <div className="flex items-center gap-3 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl px-4 py-2.5 shadow-xs">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#667085]">
              Model Win Probability
            </div>
            <div className="text-xs text-[#344054] font-semibold truncate max-w-[140px]">
              {metadata.second_innings_team}
            </div>
          </div>
          <div className="flex items-baseline gap-1 pl-2 border-l border-[#EAECF0]">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono-numbers tracking-tight ${
                isChasingTeamAhead ? 'text-[#027A48]' : 'text-[#D92D20]'
              }`}
              data-testid="win-probability-value"
            >
              {winProbPct}%
            </span>
            {isChasingTeamAhead ? (
              <ArrowUpRight className="w-5 h-5 text-[#027A48]" />
            ) : (
              <ArrowDownRight className="w-5 h-5 text-[#D92D20]" />
            )}
          </div>
        </div>
      </div>

      {/* Main Score & Equation Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        {/* Score & Wickets */}
        <div className="col-span-2 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-bold text-[#667085] uppercase tracking-wider flex items-center justify-between">
            <span>Score & Overs</span>
            <span className="text-[#027A48] font-bold font-mono-numbers bg-[#ECFDF3] px-1.5 py-0.5 rounded">
              Target {metadata.target_runs}
            </span>
          </div>
          <div className="flex items-baseline gap-3 my-1">
            <div className="text-4xl font-black text-[#17191F] font-mono-numbers tracking-tight" data-testid="scoreboard-runs">
              {currentDelivery.score}
              <span className="text-2xl font-bold text-[#667085]">/{currentDelivery.wickets_lost}</span>
            </div>
            <div className="text-sm font-semibold text-[#667085] font-mono-numbers" data-testid="scoreboard-overs">
              {currentDelivery.display_over} / {metadata.scheduled_overs} ov
            </div>
          </div>
          <div className="text-xs text-[#667085] flex items-center gap-2">
            <span>
              CRR: <strong className="text-[#17191F] font-mono-numbers">{currentDelivery.current_run_rate}</strong>
            </span>
            <span>•</span>
            <span>
              RRR: <strong className={`font-mono-numbers font-bold ${currentDelivery.required_run_rate > 12 ? 'text-[#D92D20]' : 'text-[#B54708]'}`}>
                {currentDelivery.required_run_rate > 100 ? '---' : currentDelivery.required_run_rate}
              </strong>
            </span>
          </div>
        </div>

        {/* Runs Needed */}
        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-bold text-[#667085] uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#175CD3]" />
            <span>Need</span>
          </div>
          <div className="text-2xl font-black text-[#17191F] font-mono-numbers my-0.5" data-testid="runs-needed-value">
            {runsNeeded} <span className="text-xs font-normal text-[#667085]">runs</span>
          </div>
          <div className="text-[11px] text-[#667085] font-medium">
            {isChaseComplete ? 'Target Reached!' : `${runsNeeded} to win`}
          </div>
        </div>

        {/* Balls Remaining */}
        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-bold text-[#667085] uppercase tracking-wider flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-[#B54708]" />
            <span>Balls Left</span>
          </div>
          <div className="text-2xl font-black text-[#17191F] font-mono-numbers my-0.5" data-testid="balls-remaining-value">
            {ballsRemaining} <span className="text-xs font-normal text-[#667085]">balls</span>
          </div>
          <div className="text-[11px] text-[#667085] font-medium font-mono-numbers">
            {Math.floor(ballsRemaining / 6)}.{ballsRemaining % 6} overs
          </div>
        </div>

        {/* Wickets in Hand */}
        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-bold text-[#667085] uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#027A48]" />
            <span>In Hand</span>
          </div>
          <div className="text-2xl font-black text-[#17191F] font-mono-numbers my-0.5">
            {currentDelivery.wickets_remaining} <span className="text-xs font-normal text-[#667085]">wkts</span>
          </div>
          <div className="text-[11px] text-[#667085] font-medium">
            {currentDelivery.wickets_lost} down
          </div>
        </div>

        {/* Current Match Status */}
        <div className="bg-[#F9FAFB] border border-[#EAECF0] rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
          <div className="text-[11px] font-bold text-[#667085] uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#E31E24]" />
            <span>Phase</span>
          </div>
          <div className="text-xs sm:text-sm font-bold text-[#17191F] mt-1">
            {currentDelivery.legal_balls_bowled <= 36
              ? 'Powerplay (0-6)'
              : currentDelivery.legal_balls_bowled <= 90
              ? 'Middle Overs (7-15)'
              : 'Death Overs (16-20)'}
          </div>
          <div className="text-[11px] text-[#667085] truncate font-medium">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0]">
        {/* On Strike & Bowling */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#027A48] animate-pulse" />
            <span className="text-[#667085]">Striker:</span>
            <strong className="text-[#17191F] font-bold">{currentDelivery.batter}</strong>
          </div>
          <span className="text-[#D0D5DD]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[#667085]">Bowler:</span>
            <strong className="text-[#17191F] font-bold">{currentDelivery.bowler}</strong>
          </div>
          <span className="text-[#D0D5DD]">|</span>
          <div className="text-[#344054] font-medium italic">
            "{currentDelivery.event_description}"
          </div>
        </div>

        {/* Recent Deliveries Ticker */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-bold text-[#667085] mr-1">Recent:</span>
          {recentDeliveries.map((d) => {
            let badgeStyle = 'bg-white text-[#344054] border-[#D0D5DD] hover:border-[#98A2B3]';
            let label = d.total_runs.toString();

            if (d.wicket_count_delivery > 0) {
              badgeStyle = 'bg-[#FEF3F2] text-[#B42318] border-[#FECDCA] font-bold hover:bg-[#FEE4E2]';
              label = 'W';
            } else if (d.batter_runs === 6) {
              badgeStyle = 'bg-[#F9F5FF] text-[#6941C6] border-[#E9D7FE] font-bold hover:bg-[#F4EBFF]';
              label = '6';
            } else if (d.batter_runs === 4) {
              badgeStyle = 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5] font-bold hover:bg-[#D1FADF]';
              label = '4';
            } else if (d.is_wide) {
              badgeStyle = 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89] hover:bg-[#FEF0C7]';
              label = `${d.total_runs}wd`;
            } else if (d.is_noball) {
              badgeStyle = 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89] hover:bg-[#FEF0C7]';
              label = `${d.total_runs}nb`;
            } else if (d.total_runs === 0) {
              badgeStyle = 'bg-white text-[#98A2B3] border-[#EAECF0] hover:border-[#D0D5DD]';
              label = '•';
            }

            const isCurrent = d.delivery_idx === currentDelivery.delivery_idx;

            return (
              <button
                key={d.delivery_idx}
                type="button"
                onClick={() => onSeek?.(d.delivery_idx)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono-numbers border transition-all cursor-pointer shadow-2xs ${badgeStyle} ${
                  isCurrent ? 'ring-2 ring-[#E31E24] shadow-xs scale-105' : ''
                }`}
                title={`Click to jump to Over ${d.display_over}: ${d.event_description}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
