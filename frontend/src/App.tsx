import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService, ReplayData } from './services/api';
import { MatchSummary, TurningPoint, ExplainResponse, DeliveryEvent, BackendStatus } from './types/cricket';
import { Header } from './components/Header';
import { MatchSelector } from './components/MatchSelector';
import { Scoreboard } from './components/Scoreboard';
import { WinProbabilityChart } from './components/WinProbabilityChart';
import { ReplayControls } from './components/ReplayControls';
import { TurningPointCards } from './components/TurningPointCards';
import { ExplanationModal } from './components/ExplanationModal';
import { ModelMetricsModal } from './components/ModelMetricsModal';
import { HelpCircle, AlertTriangle } from 'lucide-react';

export const App: React.FC = () => {
  // State
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('1359487'); // GT vs KKR default
  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [fullMatchAnalysis, setFullMatchAnalysis] = useState<boolean>(false);
  
  // Explanation state
  const [selectedTurningPoint, setSelectedTurningPoint] = useState<TurningPoint | null>(null);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [isExplaining, setIsExplaining] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  
  // Model Metrics Modal
  const [isMetricsOpen, setIsMetricsOpen] = useState<boolean>(false);
  
  // Backend & Loading Status
  const [backendStatus, setBackendStatus] = useState<BackendStatus>(apiService.getBackendStatus());
  const [isLoadingMatch, setIsLoadingMatch] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback timer ref
  const playTimerRef = useRef<number | null>(null);
  // Match switch sequence ref to prevent stale async responses
  const activeMatchRequestId = useRef<string>('');

  // 1. Initial Load: Check backend & fetch matches & subscribe to status
  useEffect(() => {
    const unsubscribe = apiService.onStatusChange(setBackendStatus);

    const initApp = async () => {
      await apiService.checkBackend();
      try {
        const summaries = await apiService.getMatches();
        setMatches(summaries);
        if (summaries.length > 0 && !summaries.some(m => m.match_id === selectedMatchId)) {
          setSelectedMatchId(summaries[0].match_id);
        }
      } catch (err: any) {
        console.error('Failed to load matches:', err);
        setErrorMessage('Failed to load match listings.');
      }
    };

    initApp();
    return () => unsubscribe();
  }, []);

  // 2. Fetch Replay Data when selectedMatchId changes
  useEffect(() => {
    const loadMatchData = async () => {
      setIsLoadingMatch(true);
      setIsPlaying(false);
      setErrorMessage(null);
      const reqId = selectedMatchId;
      activeMatchRequestId.current = reqId;

      try {
        const data = await apiService.getReplay(selectedMatchId);
        // Ensure no race condition with rapid match switching
        if (activeMatchRequestId.current === reqId) {
          setReplayData(data);
          setCurrentDeliveryIndex(0);
          setSelectedTurningPoint(null);
          setExplanation(null);
        }
      } catch (err: any) {
        if (activeMatchRequestId.current === reqId) {
          console.error(`Error loading match ${selectedMatchId}:`, err);
          setErrorMessage(`Could not load replay data for match ${selectedMatchId}`);
        }
      } finally {
        if (activeMatchRequestId.current === reqId) {
          setIsLoadingMatch(false);
        }
      }
    };

    loadMatchData();
  }, [selectedMatchId]);

  // 3. Playback Loop
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(100, Math.round(1000 / playbackSpeed));
      playTimerRef.current = window.setInterval(() => {
        setCurrentDeliveryIndex((prevIdx) => {
          if (!replayData) return prevIdx;
          const nextIdx = prevIdx + 1;
          if (nextIdx >= replayData.deliveries.length) {
            setIsPlaying(false);
            return prevIdx;
          }
          return nextIdx;
        });
      }, intervalMs);
    } else {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    }

    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, replayData]);

  // Handler: Play / Pause
  const handleTogglePlay = useCallback(() => {
    if (!replayData) return;
    if (currentDeliveryIndex >= replayData.deliveries.length - 1) {
      // If at end, restart and play
      setCurrentDeliveryIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  }, [currentDeliveryIndex, replayData]);

  // Handler: Restart
  const handleRestart = useCallback(() => {
    setIsPlaying(false);
    setCurrentDeliveryIndex(0);
  }, []);

  // Handler: Step Back
  const handleStepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentDeliveryIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Handler: Step Forward
  const handleStepForward = useCallback(() => {
    if (!replayData) return;
    setIsPlaying(false);
    setCurrentDeliveryIndex((prev) => Math.min(replayData.deliveries.length - 1, prev + 1));
  }, [replayData]);

  // Handler: Seek (pauses automatic playback to prevent race conditions)
  const handleSeek = useCallback(
    (index: number) => {
      if (!replayData) return;
      setIsPlaying(false);
      const boundedIdx = Math.max(0, Math.min(replayData.deliveries.length - 1, index));
      setCurrentDeliveryIndex(boundedIdx);
    },
    [replayData]
  );

  // Handler: Select Turning Point (Jump to its end delivery)
  const handleSelectTurningPoint = useCallback(
    (tp: TurningPoint) => {
      setIsPlaying(false);
      setSelectedTurningPoint(tp);
      handleSeek(tp.end_delivery_idx);
    },
    [handleSeek]
  );

  // Handler: Explain Turning Point
  const handleExplainTurningPoint = useCallback(
    async (tp: TurningPoint, customPrompt?: string) => {
      handleSelectTurningPoint(tp);
      setIsModalOpen(true);
      setIsExplaining(true);
      try {
        const resp = await apiService.explainTurningPoint(
          selectedMatchId,
          tp.id,
          customPrompt
        );
        setExplanation(resp);
      } catch (err: any) {
        console.error('Failed to get explanation:', err);
      } finally {
        setIsExplaining(false);
      }
    },
    [handleSelectTurningPoint, selectedMatchId]
  );

  const currentDelivery: DeliveryEvent | undefined = replayData?.deliveries[currentDeliveryIndex];

  // Recent deliveries slice (last 6-8 balls)
  const recentDeliveries: DeliveryEvent[] = replayData
    ? replayData.deliveries.slice(Math.max(0, currentDeliveryIndex - 5), currentDeliveryIndex + 1)
    : [];

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* Top Header */}
      <Header
        backendStatus={backendStatus}
        onOpenMetrics={() => setIsMetricsOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Match Selector */}
        <MatchSelector
          matches={matches}
          selectedMatchId={selectedMatchId}
          onSelectMatch={(id) => setSelectedMatchId(id)}
          isLoading={isLoadingMatch}
        />

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-200 text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Loading Spinner */}
        {isLoadingMatch ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 border-3 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-300 font-display">
              Loading second-innings delivery data & ML win probabilities...
            </p>
          </div>
        ) : replayData && currentDelivery ? (
          <>
            {/* Scoreboard */}
            <Scoreboard
              metadata={replayData.metadata}
              currentDelivery={currentDelivery}
              recentDeliveries={recentDeliveries}
              onSeek={handleSeek}
            />

            {/* Interactive Timeline Chart */}
            <WinProbabilityChart
              deliveries={replayData.deliveries}
              currentDeliveryIndex={currentDeliveryIndex}
              turningPoints={replayData.turning_points}
              fullMatchAnalysis={fullMatchAnalysis}
              onToggleFullMatchAnalysis={() => setFullMatchAnalysis((prev) => !prev)}
              onSeek={handleSeek}
              onSelectTurningPoint={(tp) => handleExplainTurningPoint(tp)}
            />

            {/* Replay Controls */}
            <ReplayControls
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onRestart={handleRestart}
              onStepBack={handleStepBack}
              onStepForward={handleStepForward}
              currentDeliveryIndex={currentDeliveryIndex}
              totalDeliveries={replayData.deliveries.length}
              currentDelivery={currentDelivery}
              onSeek={handleSeek}
              playbackSpeed={playbackSpeed}
              onChangeSpeed={(s) => setPlaybackSpeed(s)}
            />

            {/* Turning Point Cards */}
            <TurningPointCards
              turningPoints={replayData.turning_points}
              selectedTurningPointId={selectedTurningPoint?.id || null}
              onSelectTurningPoint={handleSelectTurningPoint}
              onExplainTurningPoint={(tp) => handleExplainTurningPoint(tp)}
            />

            {/* Educational Cricket Context Card */}
            <div className="p-4 rounded-2xl bg-[#0e1422] border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-300">
                <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  <strong>What does win probability represent?</strong> It is the estimated likelihood of the chasing team winning the match from the exact current game state (runs required, wickets in hand, balls left, and recent scoring rate), calibrated across 137,500 historical IPL deliveries.
                </span>
              </div>
              <button
                onClick={() => setIsMetricsOpen(true)}
                className="text-emerald-400 hover:text-emerald-300 underline shrink-0 font-medium cursor-pointer"
              >
                Inspect ML Diagnostics →
              </button>
            </div>
          </>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090d16] py-5 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-semibold text-slate-400">TurningPoint AI</span> — Dream11 FDE Internship Assignment. Built with React 19, FastAPI, scikit-learn & Cricsheet data.
          </div>
          <div>
            Data provided by <a href="https://cricsheet.org" target="_blank" rel="noreferrer" className="text-emerald-400/80 hover:underline">Cricsheet</a> under CC BY-SA 4.0.
          </div>
        </div>
      </footer>

      {/* Explanation Modal */}
      <ExplanationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        turningPoint={selectedTurningPoint}
        explanation={explanation}
        isLoading={isExplaining}
        onAskCustomPrompt={(prompt) => {
          if (selectedTurningPoint) {
            handleExplainTurningPoint(selectedTurningPoint, prompt);
          }
        }}
      />

      {/* Model Performance Modal */}
      <ModelMetricsModal
        isOpen={isMetricsOpen}
        onClose={() => setIsMetricsOpen(false)}
        metrics={apiService.getModelMetrics()}
        attribution={apiService.getAttribution()}
      />
    </div>
  );
};

export default App;
