import React, { useEffect } from 'react';
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Gauge } from 'lucide-react';
import { DeliveryEvent } from '../types/cricket';

interface ReplayControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  currentDeliveryIndex: number;
  totalDeliveries: number;
  currentDelivery: DeliveryEvent;
  onSeek: (index: number) => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
}

export const ReplayControls: React.FC<ReplayControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onRestart,
  onStepBack,
  onStepForward,
  currentDeliveryIndex,
  totalDeliveries,
  currentDelivery,
  onSeek,
  playbackSpeed,
  onChangeSpeed,
}) => {
  // Global spacebar shortcut for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onStepBack();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        onStepForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onStepBack, onStepForward]);

  const speeds = [1, 2, 4];

  return (
    <div className="bg-[#0e1422] border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex flex-col gap-3">
        {/* Seek Slider with Delivery Details */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono-numbers text-slate-400 min-w-[70px]">
            Ball {currentDeliveryIndex + 1}/{totalDeliveries}
          </span>

          <input
            type="range"
            min={0}
            max={Math.max(0, totalDeliveries - 1)}
            value={currentDeliveryIndex}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:accent-emerald-300 transition-all"
          />

          <span className="text-xs font-bold font-mono-numbers text-emerald-400 min-w-[65px] text-right">
            Over {currentDelivery?.display_over}
          </span>
        </div>

        {/* Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Main playback buttons */}
          <div className="flex items-center gap-2">
            {/* Restart */}
            <button
              onClick={onRestart}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Restart from ball 0 (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Step Backward */}
            <button
              onClick={onStepBack}
              disabled={currentDeliveryIndex === 0}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Step Backward (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-xs tracking-wide uppercase transition-all duration-200 cursor-pointer shadow-lg ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25 ring-2 ring-emerald-400/20'
              }`}
              title="Play/Pause (Spacebar)"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>Play Replay</span>
                </>
              )}
            </button>

            {/* Step Forward */}
            <button
              onClick={onStepForward}
              disabled={currentDeliveryIndex >= totalDeliveries - 1}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Step Forward (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <Gauge className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-numbers font-semibold transition-all cursor-pointer ${
                  playbackSpeed === s
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Quick Shortcuts hint */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-400">
            <span>Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700 font-mono">
              Space
            </kbd>
            <span>Play/Pause</span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700 font-mono">
              ← / →
            </kbd>
            <span>Step</span>
          </div>
        </div>
      </div>
    </div>
  );
};
