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
  // Global spacebar and arrow keys shortcuts
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
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onStepBack, onStepForward, onRestart]);

  const speeds = [1, 2, 4];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 shadow-sm" data-testid="replay-controls-card">
      <div className="flex flex-col gap-3.5">
        {/* Seek Slider with Delivery Details */}
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono-numbers font-medium text-[#667085] min-w-[70px]" data-testid="delivery-counter">
            Ball {currentDeliveryIndex + 1}/{totalDeliveries}
          </span>

          <input
            type="range"
            min={0}
            max={Math.max(0, totalDeliveries - 1)}
            value={currentDeliveryIndex}
            onChange={(e) => onSeek(Number(e.target.value))}
            data-testid="replay-seek-slider"
            className="w-full h-2 bg-[#EAECF0] rounded-lg appearance-none cursor-pointer accent-[#E31E24] hover:accent-[#C9161B] transition-all"
          />

          <span className="text-xs font-bold font-mono-numbers text-[#E31E24] min-w-[65px] text-right" data-testid="current-over-label">
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
              data-testid="restart-btn"
              className="p-2 rounded-xl bg-[#F9FAFB] hover:bg-[#F2F4F7] border border-[#EAECF0] hover:border-[#D0D5DD] text-[#344054] transition-colors cursor-pointer shadow-xs"
              title="Restart from ball 0 (R)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Step Backward */}
            <button
              onClick={onStepBack}
              disabled={currentDeliveryIndex === 0}
              data-testid="step-back-btn"
              className="p-2 rounded-xl bg-[#F9FAFB] hover:bg-[#F2F4F7] border border-[#EAECF0] hover:border-[#D0D5DD] text-[#344054] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
              title="Step Backward (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Play / Pause Primary Button */}
            <button
              onClick={onTogglePlay}
              data-testid="play-pause-btn"
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all duration-200 cursor-pointer shadow-sm ${
                isPlaying
                  ? 'bg-[#17191F] hover:bg-[#252830] text-white shadow-md'
                  : 'bg-[#E31E24] hover:bg-[#C9161B] text-white shadow-md shadow-[#E31E24]/20'
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
              data-testid="step-forward-btn"
              className="p-2 rounded-xl bg-[#F9FAFB] hover:bg-[#F2F4F7] border border-[#EAECF0] hover:border-[#D0D5DD] text-[#344054] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
              title="Step Forward (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5 bg-[#F9FAFB] p-1 rounded-xl border border-[#EAECF0]">
            <Gauge className="w-3.5 h-3.5 text-[#667085] ml-1.5 mr-0.5" />
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                data-testid={`speed-btn-${s}x`}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-numbers font-semibold transition-all cursor-pointer ${
                  playbackSpeed === s
                    ? 'bg-white text-[#027A48] border border-emerald-500 shadow-xs'
                    : 'text-[#667085] hover:text-[#17191F]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Quick Shortcuts hint */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-[#667085]">
            <span className="font-medium">Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 bg-[#F2F4F7] rounded text-[#344054] border border-[#D0D5DD] font-mono">
              Space
            </kbd>
            <span>Play/Pause</span>
            <kbd className="px-1.5 py-0.5 bg-[#F2F4F7] rounded text-[#344054] border border-[#D0D5DD] font-mono">
              ← / →
            </kbd>
            <span>Step</span>
            <kbd className="px-1.5 py-0.5 bg-[#F2F4F7] rounded text-[#344054] border border-[#D0D5DD] font-mono">
              R
            </kbd>
            <span>Restart</span>
          </div>
        </div>
      </div>
    </div>
  );
};
