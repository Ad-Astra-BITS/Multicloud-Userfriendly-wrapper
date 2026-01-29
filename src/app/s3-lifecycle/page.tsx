'use client';

/**
 * S3 Lifecycle Page
 *
 * Manage S3 bucket storage tiers for cost optimization.
 * Displays recommendations for moving buckets to cheaper tiers.
 */

import DashboardLayout from '@/components/DashboardLayout';
import S3LifecycleRecommendations from '@/components/S3LifecycleRecommendations';
import { Database, Info } from 'lucide-react';

export default function S3LifecyclePage() {
  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">S3 Lifecycle Management</h1>
        <p className="text-slate-400 mt-1">
          Optimize storage costs by moving data to appropriate tiers
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-300">
              S3 Lifecycle rules automatically transition objects between storage
              classes based on access patterns. Moving infrequently accessed data
              to Glacier can reduce storage costs by up to 90%.
            </p>
          </div>
        </div>
      </div>

      {/* S3 Lifecycle Recommendations */}
      <S3LifecycleRecommendations />
    </DashboardLayout>
  );
}
