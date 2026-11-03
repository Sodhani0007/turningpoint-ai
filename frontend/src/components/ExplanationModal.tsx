import React, { useState } from 'react';
import { ExplainResponse, TurningPoint } from '../types/cricket';
import { X, Sparkles, ShieldCheck, Cpu, ArrowUpRight, ArrowDownRight, Send, ListChecks } from 'lucide-react';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  turningPoint: TurningPoint | null;
  explanation: ExplainResponse | null;
  isLoading: boolean;
  onAskCustomPrompt: (prompt: string) => void;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  turningPoint,
  explanation,
  isLoading,
  onAskCustomPrompt,
}) => {
  const [customQuestion, setCustomQuestion] = useState('');

  if (!isOpen || !turningPoint) return null;

  const isPositive = turningPoint.shift_percentage > 0;
  const shiftText = `${isPositive ? '+' : ''}${turningPoint.shift_percentage}%`;

  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || isLoading) return;
    onAskCustomPrompt(customQuestion.trim());
    setCustomQuestion('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0e1422] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wider font-bold text-slate-400 font-display">
                  Momentum Shift Explanation
                </span>
                <span
                  className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-mono-numbers font-bold border ${
                    isPositive
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {shiftText}
                </span>
                {explanation && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center gap-1">
                    {explanation.source === 'ai_live' ? (
                      <>
                        <Cpu className="w-3 h-3 text-emerald-400" />
                        <span>Live AI Model</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3 text-cyan-400" />
                        <span>Verified Precomputed Analysis</span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {explanation?.headline || turningPoint.over_label}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-8 h-8 border-3 border-emerald-500/30 border-t-emerald-400 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">
                Synthesizing evidence-grounded momentum analysis...
              </p>
            </div>
          ) : explanation ? (
            <>
              {/* Main Grounded Explanation Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-1.5">
                  AI Tactical & Statistical Breakdown
                </div>
                <p className="text-sm sm:text-base leading-relaxed text-slate-200">
                  {explanation.explanation}
                </p>
              </div>

              {/* Key Takeaway */}
              <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 mb-1">
                  Key Takeaway
                </div>
                <p className="text-xs sm:text-sm text-cyan-200 font-medium">
                  {explanation.takeaway}
                </p>
              </div>

              {/* Verified Supporting Match Deliveries */}
              {explanation.verified_evidence?.deliveries && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <ListChecks className="w-3.5 h-3.5 text-emerald-400" />
                      Supporting Delivery Evidence ({explanation.verified_evidence.deliveries.length} balls)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Verified historical data
                    </span>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/90 text-slate-400 font-medium border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Over</th>
                          <th className="py-2 px-3">Matchup</th>
                          <th className="py-2 px-3">Event</th>
                          <th className="py-2 px-3 text-right">Runs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono-numbers">
                        {explanation.verified_evidence.deliveries.map((del) => (
                          <tr key={del.delivery_id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-slate-300">
                              {del.over}
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-300">
                              <span className="text-slate-400">{del.bowler}</span> →{' '}
                              <strong className="text-slate-200">{del.batter}</strong>
                            </td>
                            <td className="py-2 px-3 font-sans">
                              {del.wickets.length > 0 ? (
                                <span className="text-rose-400 font-semibold">
                                  WICKET ({del.wickets[0].kind})
                                </span>
                              ) : del.batter_runs === 6 ? (
                                <span className="text-purple-400 font-bold">SIX</span>
                              ) : del.batter_runs === 4 ? (
                                <span className="text-emerald-400 font-bold">FOUR</span>
                              ) : (
                                <span className="text-slate-400">{del.event_description.split(', ')[1] || 'Run'}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-200">
                              +{del.runs_total}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Confidence notes */}
              {explanation.confidence_notes && (
                <div className="text-[11px] text-slate-400 italic">
                  Note: {explanation.confidence_notes}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Custom Follow-Up Question Input */}
        <form onSubmit={handleSubmitQuestion} className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/70 flex gap-2">
          <input
            type="text"
            placeholder="Ask AI about this moment (e.g. 'Why did the required rate spike?')..."
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
          <button
            type="submit"
            disabled={!customQuestion.trim() || isLoading}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask AI</span>
          </button>
        </form>
      </div>
    </div>
  );
};
