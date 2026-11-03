import React from 'react';
import { ModelMetrics } from '../types/cricket';
import { X, Cpu, CheckCircle2, Award, GitBranch, LineChart } from 'lucide-react';

interface ModelMetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: ModelMetrics;
  attribution: any;
}

export const ModelMetricsModal: React.FC<ModelMetricsModalProps> = ({
  isOpen,
  onClose,
  metrics,
  attribution,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0e1422] border border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Machine Learning Win-Probability Engine
              </h2>
              <p className="text-xs text-slate-400">
                Trained on official Cricsheet historical IPL deliveries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {/* Key Evaluation Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                ROC-AUC Score
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono-numbers mt-1">
                {metrics.roc_auc}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">High Discriminative Power</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Brier Score
              </div>
              <div className="text-2xl font-black text-cyan-400 font-mono-numbers mt-1">
                {metrics.brier_score}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Mean Squared Prob Error</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Log Loss
              </div>
              <div className="text-2xl font-black text-purple-400 font-mono-numbers mt-1">
                {metrics.log_loss}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Cross-Entropy Loss</div>
            </div>
          </div>

          {/* Chronological Validation Split */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span>Strict Chronological Split (No Data Leakage)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-slate-400 text-[11px] pt-1">
              <div>
                <strong className="text-slate-200 block">Train (≤ 2021):</strong>
                {metrics.train_samples.toLocaleString()} deliveries ({metrics.train_matches} matches)
              </div>
              <div>
                <strong className="text-slate-200 block">Val (2022):</strong>
                {metrics.val_samples.toLocaleString()} deliveries ({metrics.val_matches} matches)
              </div>
              <div>
                <strong className="text-slate-200 block">Test (≥ 2023):</strong>
                {metrics.test_samples.toLocaleString()} deliveries ({metrics.test_matches} matches)
              </div>
            </div>
          </div>

          {/* Model Architecture & Features */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Award className="w-4 h-4 text-cyan-400" />
              <span>Features & Architecture</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Trained using standard-scaled Logistic Regression calibrated with Sigmoid probability calibration (CalibratedClassifierCV). Features strictly exclude future match information:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'target_runs',
                'current_score',
                'wickets_lost',
                'legal_balls_bowled',
                'balls_remaining',
                'runs_required',
                'current_run_rate',
                'required_run_rate',
                'wickets_remaining',
                'recent_scoring_rate_12_balls',
              ].map((f) => (
                <span
                  key={f}
                  className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/80 font-mono-numbers text-[10px] text-emerald-300"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Dataset Attribution */}
          <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800/80 text-[11px] text-slate-400">
            <strong className="text-slate-300 block mb-1">Official Data Attribution:</strong>
            Historical ball-by-ball IPL dataset provided by <a href="https://cricsheet.org" target="_blank" rel="noreferrer" className="text-emerald-400 underline">Cricsheet</a> under the Creative Commons Attribution-ShareAlike 4.0 International license (CC BY-SA 4.0).
          </div>
        </div>
      </div>
    </div>
  );
};
