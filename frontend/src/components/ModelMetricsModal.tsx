import React, { useEffect } from 'react';
import { ModelMetrics } from '../types/cricket';
import { X, Cpu, GitBranch, CheckCircle2 } from 'lucide-react';

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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      data-testid="metrics-modal-backdrop"
    >
      <div
        className="bg-white border border-[#E5E7EB] rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid="metrics-modal-card"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAECF0] flex items-center justify-between bg-[#F9FAFB]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#D92D20]">
              <Cpu className="w-5 h-5 text-[#E31E24]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#17191F] font-display">
                Machine Learning Win-Probability Engine
              </h2>
              <p className="text-xs text-[#667085]">
                Trained on official Cricsheet historical IPL deliveries
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-metrics-modal-btn"
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#17191F] hover:bg-[#F2F4F7] transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-[#344054]">
          {/* Key Evaluation Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">
                ROC-AUC Score
              </div>
              <div className="text-2xl font-black text-[#027A48] font-mono-numbers mt-1" data-testid="metric-roc-auc">
                {metrics.roc_auc}
              </div>
              <div className="text-[10px] text-[#667085] mt-0.5">High Discriminative Power</div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">
                Brier Score
              </div>
              <div className="text-2xl font-black text-[#175CD3] font-mono-numbers mt-1" data-testid="metric-brier-score">
                {metrics.brier_score}
              </div>
              <div className="text-[10px] text-[#667085] mt-0.5">Mean Squared Prob Error</div>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] text-center shadow-xs">
              <div className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">
                Log Loss
              </div>
              <div className="text-2xl font-black text-[#7F56D9] font-mono-numbers mt-1" data-testid="metric-log-loss">
                {metrics.log_loss}
              </div>
              <div className="text-[10px] text-[#667085] mt-0.5">Cross-Entropy Loss</div>
            </div>
          </div>

          {/* Chronological Validation Split */}
          <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#17191F]">
              <GitBranch className="w-4 h-4 text-[#027A48]" />
              <span>Strict Chronological Split (No Data Leakage)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[#667085] text-[11px] pt-1">
              <div>
                <strong className="text-[#17191F] block">Train (≤ 2021):</strong>
                {metrics.train_samples?.toLocaleString()} deliveries ({metrics.train_matches} matches)
              </div>
              <div>
                <strong className="text-[#17191F] block">Val (2022):</strong>
                {metrics.val_samples?.toLocaleString()} deliveries ({metrics.val_matches} matches)
              </div>
              <div>
                <strong className="text-[#17191F] block">Test (≥ 2023):</strong>
                {metrics.test_samples?.toLocaleString()} deliveries ({metrics.test_matches} matches)
              </div>
            </div>
          </div>

          {/* Features and Model Architecture */}
          <div className="p-3.5 rounded-xl bg-[#F9FAFB] border border-[#EAECF0] space-y-2">
            <div className="font-bold text-[#17191F]">
              Feature Engineering & Sigmoid Probability Calibration
            </div>
            <ul className="grid grid-cols-2 gap-2 text-[11px] text-[#475467]">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#027A48] shrink-0" />
                Target Runs & Required Runs
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#027A48] shrink-0" />
                Wickets Fallen & Remaining
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#027A48] shrink-0" />
                Legal Balls Bowled & Left
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#027A48] shrink-0" />
                Current & Required Run Rate
              </li>
            </ul>
            <p className="text-[11px] text-[#667085] pt-1 leading-relaxed">
              Model output is calibrated with 5-fold cross-validated sigmoid regression (Platt scaling) so that predicted 70% win probabilities correspond to teams winning 70% of historical matches in identical situations.
            </p>
          </div>

          {/* Dataset Attribution */}
          {attribution && (
            <div className="p-3 rounded-xl bg-[#F2F4F7] border border-[#EAECF0] text-[11px] text-[#667085]">
              <span className="font-semibold text-[#344054]">Data Attribution:</span> {attribution.source} (License: {attribution.license}). {attribution.disclaimer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
