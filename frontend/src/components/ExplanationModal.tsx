import React, { useState, useEffect } from 'react';
import { ExplainResponse, TurningPoint } from '../types/cricket';
import { X, Sparkles, ShieldCheck, Cpu, ArrowUpRight, ArrowDownRight, Send, ListChecks, AlertTriangle, HelpCircle } from 'lucide-react';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  turningPoint: TurningPoint | null;
  explanation: ExplainResponse | null;
  isLoading: boolean;
  onAskCustomPrompt: (prompt: string) => void;
  errorMessage?: string | null;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  turningPoint,
  explanation,
  isLoading,
  onAskCustomPrompt,
  errorMessage,
}) => {
  const [customQuestion, setCustomQuestion] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !turningPoint) return null;

  const isPositive = turningPoint.shift_percentage > 0;
  const shiftText = `${isPositive ? '+' : ''}${turningPoint.shift_percentage}%`;

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || isLoading) return;
    onAskCustomPrompt(customQuestion.trim());
    setCustomQuestion('');
  };

  // Determine source label and icon
  const source = explanation?.source;
  const isLive = source === 'live_llm' || source === 'ai_live';
  const isPrecomputedLlm = source === 'precomputed_llm';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="explanation-modal-backdrop"
    >
      <div
        className="bg-white border border-[#E5E7EB] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="explanation-modal-card"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAECF0] flex items-start justify-between gap-3 bg-[#F9FAFB]">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#D92D20] mt-0.5 shadow-xs shrink-0">
              <Sparkles className="w-5 h-5 text-[#E31E24]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-bold text-[#667085] font-display">
                  Momentum Shift Explanation
                </span>
                <span
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono-numbers font-bold border ${
                    isPositive
                      ? 'bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]'
                      : 'bg-[#FEF3F2] text-[#D92D20] border-[#FECDCA]'
                  }`}
                >
                  {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {shiftText}
                </span>

                {explanation && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#F2F4F7] border border-[#EAECF0] text-[#344054] font-medium flex items-center gap-1"
                    data-testid="explanation-source-badge"
                  >
                    {isLive ? (
                      <>
                        <Cpu className="w-3 h-3 text-[#027A48]" />
                        <span>Live AI ({explanation.llm_metadata?.model || 'LLM'})</span>
                      </>
                    ) : isPrecomputedLlm ? (
                      <>
                        <Sparkles className="w-3 h-3 text-[#175CD3]" />
                        <span>Precomputed Grounded AI</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3 text-[#B54708]" />
                        <span>Deterministic Evidence Grounding</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-[#17191F]" data-testid="explanation-headline">
                {explanation?.headline || turningPoint.over_label}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            data-testid="close-explanation-modal-btn"
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#17191F] hover:bg-[#F2F4F7] transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-[#344054]">
          {/* Query Error Alert if custom prompt failed */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-start gap-2.5 shadow-xs" data-testid="qa-error-alert">
              <AlertTriangle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#912018] mb-0.5">Ask AI Query Error</p>
                <p className="text-[#B42318]">{errorMessage}</p>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center" data-testid="explanation-loading-spinner">
              <div className="w-8 h-8 border-3 border-[#E31E24]/20 border-t-[#E31E24] rounded-full animate-spin" />
              <p className="text-sm text-[#475467] font-semibold">
                Synthesizing evidence-grounded answer...
              </p>
            </div>
          ) : explanation ? (
            <>
              {/* If this explanation answered a specific user question, display Question and Answer clearly separated */}
              {explanation.user_question ? (
                <div className="p-4 rounded-xl bg-[#F9FAFB] border-2 border-[#E31E24]/30 shadow-xs space-y-3" data-testid="user-qa-card">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#E31E24] mb-1.5 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      User Question
                    </div>
                    <p className="text-sm font-bold text-[#17191F] bg-white p-3 rounded-lg border border-[#EAECF0] shadow-2xs" data-testid="user-question-text">
                      "{explanation.user_question}"
                    </p>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#175CD3] mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Grounded Answer
                    </div>
                    <p className="text-sm sm:text-base leading-relaxed text-[#17191F] font-medium" data-testid="user-answer-text">
                      {explanation.explanation}
                    </p>
                  </div>
                </div>
              ) : (
                /* Main Grounded Explanation Card (for default turning-point explanation) */
                <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#EAECF0]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#E31E24] mb-1.5">
                    AI Tactical & Statistical Breakdown
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-[#17191F]" data-testid="explanation-text">
                    {explanation.explanation}
                  </p>
                </div>
              )}

              {/* Key Takeaway */}
              <div className="p-3.5 rounded-xl bg-[#EFF8FF] border border-[#B2DDFF]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#175CD3] mb-1">
                  Key Takeaway
                </div>
                <p className="text-xs sm:text-sm text-[#1849A9] font-medium" data-testid="explanation-takeaway">
                  {explanation.takeaway}
                </p>
              </div>

              {/* Verified Supporting Match Deliveries */}
              {explanation.verified_evidence?.deliveries && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#667085] flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-[#027A48]" />
                      Supporting Delivery Evidence ({explanation.verified_evidence.deliveries.length} balls)
                    </span>
                    <span className="text-[11px] text-[#667085]">
                      Verified historical data
                    </span>
                  </div>

                  <div className="border border-[#EAECF0] rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F9FAFB] text-[#475467] font-bold border-b border-[#EAECF0]">
                        <tr>
                          <th className="py-2.5 px-3">Over</th>
                          <th className="py-2.5 px-3">Matchup</th>
                          <th className="py-2.5 px-3">Event</th>
                          <th className="py-2.5 px-3 text-right">Runs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EAECF0] font-mono-numbers">
                        {explanation.verified_evidence.deliveries.map((del) => {
                          const hasWicket = Boolean(del.wickets && del.wickets.length > 0);
                          const wicketKind = hasWicket ? (del.wickets[0]?.kind || 'wicket') : null;
                          const runs = del.runs_total ?? del.batter_runs ?? 0;
                          const isSix = del.batter_runs === 6 || runs === 6;
                          const isFour = del.batter_runs === 4 || runs === 4;

                          let eventLabel = 'Run';
                          if (typeof del.event_description === 'string' && del.event_description.trim()) {
                            const parts = del.event_description.split(', ');
                            eventLabel = parts.length > 1 ? parts[1] : del.event_description;
                          } else {
                            eventLabel = `${runs} run${runs === 1 ? '' : 's'}`;
                          }

                          return (
                            <tr key={del.delivery_id} className="hover:bg-[#F9FAFB] transition-colors">
                              <td className="py-2.5 px-3 font-bold text-[#17191F]">
                                {del.over}
                              </td>
                              <td className="py-2.5 px-3 font-sans text-[#344054]">
                                <span className="text-[#667085]">{del.bowler}</span> →{' '}
                                <strong className="text-[#17191F] font-bold">{del.batter}</strong>
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                {hasWicket ? (
                                  <span className="text-[#B42318] bg-[#FEF3F2] font-bold px-2 py-0.5 rounded border border-[#FECDCA]">
                                    WICKET ({wicketKind})
                                  </span>
                                ) : isSix ? (
                                  <span className="text-[#6941C6] bg-[#F9F5FF] font-black px-2 py-0.5 rounded border border-[#E9D7FE]">
                                    SIX
                                  </span>
                                ) : isFour ? (
                                  <span className="text-[#027A48] bg-[#ECFDF3] font-black px-2 py-0.5 rounded border border-[#A6F4C5]">
                                    FOUR
                                  </span>
                                ) : (
                                  <span className="text-[#667085] font-medium">{eventLabel}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-[#17191F]">
                                +{runs}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Confidence notes */}
              {explanation.confidence_notes && (
                <div className="text-[11px] text-[#667085] italic">
                  Note: {explanation.confidence_notes}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Custom Follow-Up Question Input */}
        <form onSubmit={handleSubmitQuestion} className="p-3 sm:p-4 border-t border-[#EAECF0] bg-[#F9FAFB] flex gap-2">
          <input
            type="text"
            placeholder="Ask AI about this moment (e.g. 'Why did the required rate spike?')..."
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            disabled={isLoading}
            data-testid="custom-prompt-input"
            className="flex-1 bg-white border border-[#D0D5DD] rounded-xl px-3.5 py-2.5 text-xs text-[#17191F] placeholder-[#98A2B3] focus:outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24] shadow-2xs"
          />
          <button
            type="submit"
            disabled={!customQuestion.trim() || isLoading}
            data-testid="submit-custom-prompt-btn"
            className="px-4 py-2.5 rounded-xl bg-[#E31E24] hover:bg-[#C9161B] text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm shadow-[#E31E24]/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        </form>
      </div>
    </div>
  );
};
