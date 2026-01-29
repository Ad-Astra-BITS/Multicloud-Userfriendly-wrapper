'use client';

/**
 * Dashboard Page (Home)
 *
 * Main dashboard showing key metrics, resource overview,
 * cost savings suggestions, and recent alerts.
 */

import DashboardLayout from '@/components/DashboardLayout';
import DashboardCards from '@/components/DashboardCards';
import { recommendations } from '@/data/mockData';
import {
  Lightbulb,
  ArrowRight,
  Server,
  Database,
  HardDrive,
} from 'lucide-react';
import Link from 'next/link';

// ============================================
// Cost Savings Suggestions Component
// ============================================

function CostSavingsSuggestions() {
  // Get top 3 recommendations by savings
  const topRecommendations = [...recommendations]
    .sort((a, b) => b.estimatedSavings - a.estimatedSavings)
    .slice(0, 3);

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'EC2':
        return <Server size={16} className="text-blue-400" />;
      case 'S3':
        return <Database size={16} className="text-green-400" />;
      case 'RDS':
        return <HardDrive size={16} className="text-amber-400" />;
      default:
        return <Server size={16} className="text-slate-400" />;
    }
  };

  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-green-500/20 to-emerald-600/20">
            <Lightbulb size={20} className="text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Cost Savings Suggestions</h3>
            <p className="text-xs text-slate-500">Optimize your cloud spend</p>
          </div>
        </div>
        <Link
          href="/recommendations"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
        >
          View All
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* Recommendations list */}
      <div className="space-y-3">
        {topRecommendations.map((rec) => (
          <div
            key={rec.id}
            className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:bg-slate-900 hover:border-slate-600/50 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              {/* Resource type icon */}
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                {getResourceIcon(rec.resourceType)}
              </div>

              <div className="flex-1 min-w-0">
                {/* Header with resource name and priority */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">
                    {rec.resourceName}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      priorityColors[rec.priority]
                    }`}
                  >
                    {rec.priority}
                  </span>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-2">
                  {rec.description}
                </p>

                {/* Footer with tier change and savings */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{rec.currentTier}</span>
                    <ArrowRight size={12} className="text-slate-600" />
                    <span className="text-green-400">{rec.recommendedTier}</span>
                  </div>
                  <span className="text-sm font-semibold text-green-400">
                    Save ${rec.estimatedSavings}/mo
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Quick Actions Component
// ============================================

function QuickActions() {
  const actions = [
    {
      title: 'Compare Servers',
      description: 'Compare prices across providers',
      href: '/compare',
      icon: Server,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'S3 Lifecycle',
      description: 'Manage storage tiers',
      href: '/s3-lifecycle',
      icon: Database,
      color: 'from-green-500 to-emerald-600',
    },
    {
      title: 'View Analytics',
      description: 'Cost trends & insights',
      href: '/analytics',
      icon: HardDrive,
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:bg-slate-900 hover:border-slate-600/50 transition-all group"
          >
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${action.color} flex items-center justify-center mb-3`}
            >
              <action.icon size={20} className="text-white" />
            </div>
            <h4 className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
              {action.title}
            </h4>
            <p className="text-xs text-slate-500 mt-1">{action.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Dashboard Page
// ============================================

export default function DashboardPage() {
  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">
          Welcome back! Here&apos;s your cloud resource overview.
        </p>
      </div>

      {/* Dashboard cards grid */}
      <DashboardCards />

      {/* Bottom section: Suggestions and Quick Actions */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost savings suggestions - spans 2 columns */}
        <div className="lg:col-span-2">
          <CostSavingsSuggestions />
        </div>

        {/* Quick actions */}
        <div>
          <QuickActions />
        </div>
      </div>
    </DashboardLayout>
  );
}
