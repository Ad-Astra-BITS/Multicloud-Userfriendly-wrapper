'use client';

/**
 * S3LifecycleRecommendations Component
 *
 * Displays a list of S3 bucket storage tier recommendations.
 * Users can apply changes to optimize storage costs.
 */

import { useState } from 'react';
import { s3Buckets } from '@/data/mockData';
import { S3Bucket, S3Tier } from '@/types';
import {
  Database,
  Clock,
  HardDrive,
  ArrowRight,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';

// ============================================
// Tier Badge Component
// ============================================

interface TierBadgeProps {
  tier: S3Tier;
  variant?: 'current' | 'recommended';
}

function TierBadge({ tier, variant = 'current' }: TierBadgeProps) {
  const tierColors: Record<S3Tier, { bg: string; text: string }> = {
    Standard: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    'Intelligent Tiering': { bg: 'bg-purple-500/20', text: 'text-purple-400' },
    Glacier: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
    'Glacier Deep Archive': { bg: 'bg-green-500/20', text: 'text-green-400' },
  };

  const colors = tierColors[tier];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {tier}
    </span>
  );
}

// ============================================
// S3 Bucket Card Component
// ============================================

interface BucketCardProps {
  bucket: S3Bucket;
  onApply: (bucket: S3Bucket) => void;
  isApplied: boolean;
}

function BucketCard({ bucket, onApply, isApplied }: BucketCardProps) {
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsApplying(false);
    onApply(bucket);
  };

  if (isApplied) {
    return (
      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3 text-green-400">
          <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
            <Check size={20} />
          </div>
          <div>
            <h3 className="font-medium">{bucket.name}</h3>
            <p className="text-sm text-green-400/70">
              Tier change applied successfully
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
            <Database size={20} className="text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{bucket.name}</h3>
            <p className="text-xs text-slate-500">S3 Bucket</p>
          </div>
        </div>
        <span className="text-lg font-bold text-green-400">
          ${bucket.estimatedSavings}/mo
        </span>
      </div>

      {/* Bucket details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <HardDrive size={14} className="text-slate-500" />
          <span className="text-slate-400">{bucket.size}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock size={14} className="text-slate-500" />
          <span className="text-slate-400">{bucket.lastAccessed}</span>
        </div>
      </div>

      {/* Tier change visualization */}
      <div className="flex items-center gap-3 p-4 bg-slate-900/50 rounded-lg mb-4">
        <TierBadge tier={bucket.currentTier} />
        <ArrowRight size={16} className="text-slate-600" />
        <TierBadge tier={bucket.recommendedTier} variant="recommended" />
      </div>

      {/* Apply button */}
      <button
        onClick={handleApply}
        disabled={isApplying}
        className="w-full py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isApplying ? (
          <>
            <RefreshCw size={16} className="animate-spin" />
            Applying...
          </>
        ) : (
          <>
            <Check size={16} />
            Apply Change
          </>
        )}
      </button>
    </div>
  );
}

// ============================================
// Main S3 Lifecycle Recommendations Component
// ============================================

export default function S3LifecycleRecommendations() {
  const [appliedBuckets, setAppliedBuckets] = useState<Set<string>>(new Set());

  // Calculate total potential savings
  const totalSavings = s3Buckets
    .filter((b) => !appliedBuckets.has(b.id))
    .reduce((sum, b) => sum + b.estimatedSavings, 0);

  const appliedSavings = s3Buckets
    .filter((b) => appliedBuckets.has(b.id))
    .reduce((sum, b) => sum + b.estimatedSavings, 0);

  // Handle apply action
  const handleApply = (bucket: S3Bucket) => {
    setAppliedBuckets((prev) => new Set([...prev, bucket.id]));
  };

  // Handle apply all action
  const handleApplyAll = async () => {
    for (const bucket of s3Buckets) {
      if (!appliedBuckets.has(bucket.id)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        setAppliedBuckets((prev) => new Set([...prev, bucket.id]));
      }
    }
  };

  return (
    <div>
      {/* Summary card */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">
              S3 Storage Optimization
            </h2>
            <p className="text-sm text-slate-400">
              {s3Buckets.length - appliedBuckets.size} buckets can be optimized
              {appliedBuckets.size > 0 &&
                ` • ${appliedBuckets.size} changes applied`}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">Potential Savings</p>
              <p className="text-2xl font-bold text-green-400">
                ${totalSavings.toFixed(2)}/mo
              </p>
            </div>
            {totalSavings > 0 && (
              <button
                onClick={handleApplyAll}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apply All
              </button>
            )}
          </div>
        </div>

        {/* Progress bar for applied savings */}
        {appliedSavings > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Applied savings</span>
              <span>${appliedSavings.toFixed(2)}/mo saved</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    (appliedSavings / (appliedSavings + totalSavings)) * 100
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tier legend */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-medium text-slate-400 mb-3">
          Storage Tiers
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <TierBadge tier="Standard" />
            <span className="text-xs text-slate-500">Frequent access</span>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge tier="Intelligent Tiering" />
            <span className="text-xs text-slate-500">Variable access</span>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge tier="Glacier" />
            <span className="text-xs text-slate-500">Infrequent access</span>
          </div>
          <div className="flex items-center gap-2">
            <TierBadge tier="Glacier Deep Archive" />
            <span className="text-xs text-slate-500">Rarely accessed</span>
          </div>
        </div>
      </div>

      {/* Bucket cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {s3Buckets.map((bucket) => (
          <BucketCard
            key={bucket.id}
            bucket={bucket}
            onApply={handleApply}
            isApplied={appliedBuckets.has(bucket.id)}
          />
        ))}
      </div>
    </div>
  );
}
