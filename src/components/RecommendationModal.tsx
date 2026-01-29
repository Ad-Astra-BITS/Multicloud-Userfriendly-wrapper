'use client';

/**
 * RecommendationModal Component
 *
 * Modal popup for viewing and executing cost optimization recommendations.
 * Allows users to select target tier and execute or dismiss the recommendation.
 */

import { useState } from 'react';
import { X, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { Recommendation, S3Tier } from '@/types';

// Available S3 tiers for dropdown selection
const s3Tiers: S3Tier[] = [
  'Standard',
  'Intelligent Tiering',
  'Glacier',
  'Glacier Deep Archive',
];

interface RecommendationModalProps {
  recommendation: Recommendation;
  isOpen: boolean;
  onClose: () => void;
  onExecute: (recommendation: Recommendation, selectedTier: string) => void;
}

export default function RecommendationModal({
  recommendation,
  isOpen,
  onClose,
  onExecute,
}: RecommendationModalProps) {
  // State for tier selection dropdown
  const [selectedTier, setSelectedTier] = useState<string>(
    recommendation.recommendedTier
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Don't render if modal is not open
  if (!isOpen) return null;

  // Handle execute button click
  const handleExecute = async () => {
    setIsExecuting(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsExecuting(false);
    setIsSuccess(true);

    // Call the onExecute callback
    onExecute(recommendation, selectedTier);

    // Auto-close after success
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 2000);
  };

  // Calculate savings based on selected tier
  const getSavingsForTier = (tier: string): number => {
    const savingsMap: Record<string, number> = {
      Standard: 0,
      'Intelligent Tiering': recommendation.estimatedSavings * 0.3,
      Glacier: recommendation.estimatedSavings * 0.7,
      'Glacier Deep Archive': recommendation.estimatedSavings,
    };
    return savingsMap[tier] || recommendation.estimatedSavings;
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Success state */}
          {isSuccess ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Recommendation Applied!
              </h3>
              <p className="text-slate-400">
                The tier change has been scheduled. You&apos;ll save $
                {getSavingsForTier(selectedTier).toFixed(2)}/month.
              </p>
            </div>
          ) : (
            <>
              {/* Modal header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Cost Optimization Recommendation
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {recommendation.resourceType} • {recommendation.resourceName}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-6 space-y-6">
                {/* Recommendation description */}
                <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle size={18} className="text-blue-400" />
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {recommendation.description}
                    </p>
                  </div>
                </div>

                {/* Current tier display */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Current Tier
                  </label>
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-white">
                    {recommendation.currentTier}
                  </div>
                </div>

                {/* Tier selection dropdown */}
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Select Target Tier
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-full p-3 bg-slate-900 rounded-lg border border-slate-700 text-white flex items-center justify-between hover:border-slate-600 transition-colors"
                    >
                      <span>{selectedTier}</span>
                      <ChevronDown
                        size={18}
                        className={`text-slate-400 transition-transform ${
                          isDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown menu */}
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
                        {s3Tiers.map((tier) => (
                          <button
                            key={tier}
                            onClick={() => {
                              setSelectedTier(tier);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-800 transition-colors flex items-center justify-between ${
                              selectedTier === tier
                                ? 'bg-slate-800 text-blue-400'
                                : 'text-slate-300'
                            }`}
                          >
                            <span>{tier}</span>
                            {tier === recommendation.recommendedTier && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                                Recommended
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Estimated savings display */}
                <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                  <span className="text-slate-300 text-sm">
                    Estimated Monthly Savings
                  </span>
                  <span className="text-xl font-bold text-green-400">
                    ${getSavingsForTier(selectedTier).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Modal footer */}
              <div className="flex items-center gap-3 p-6 border-t border-slate-700 bg-slate-900/30">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={handleExecute}
                  disabled={isExecuting || selectedTier === recommendation.currentTier}
                  className="flex-1 px-4 py-3 text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isExecuting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Executing...
                    </>
                  ) : (
                    'Execute Recommendation'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
