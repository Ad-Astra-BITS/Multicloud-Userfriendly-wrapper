'use client';

/**
 * DashboardCards Component
 *
 * Displays key metrics and statistics cards on the dashboard.
 * Includes: Total Cost, Active Resources, Potential Savings, and Alerts.
 */

import {
  DollarSign,
  Server,
  TrendingDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Database,
  HardDrive,
} from 'lucide-react';
import { dashboardSummary, alerts } from '@/data/mockData';

// ============================================
// Stat Card Component
// ============================================

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  accentColor: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor,
}: StatCardProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
      <div className="flex items-start justify-between">
        {/* Icon with accent color */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${accentColor}`}
        >
          {icon}
        </div>

        {/* Trend indicator */}
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend.isPositive ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend.isPositive ? (
              <ArrowDown size={16} />
            ) : (
              <ArrowUp size={16} />
            )}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>

      {/* Value and title */}
      <div className="mt-4">
        <h3 className="text-3xl font-bold text-white">{value}</h3>
        <p className="text-slate-400 text-sm mt-1">{title}</p>
        {subtitle && (
          <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Resource Count Card Component
// ============================================

function ResourceCountCard() {
  const { activeResources } = dashboardSummary;
  const total = activeResources.ec2 + activeResources.s3 + activeResources.rds;

  const resources = [
    {
      name: 'EC2',
      count: activeResources.ec2,
      icon: Server,
      color: 'text-blue-400',
    },
    {
      name: 'S3',
      count: activeResources.s3,
      icon: Database,
      color: 'text-green-400',
    },
    {
      name: 'RDS',
      count: activeResources.rds,
      icon: HardDrive,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-purple-600/20">
          <Server size={24} className="text-purple-400" />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          AWS Resources
        </span>
      </div>

      <div className="mt-4">
        <h3 className="text-3xl font-bold text-white">{total}</h3>
        <p className="text-slate-400 text-sm mt-1">Active Resources</p>
      </div>

      {/* Resource breakdown */}
      <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-3 gap-2">
        {resources.map((resource) => (
          <div key={resource.name} className="text-center">
            <div
              className={`text-lg font-semibold ${resource.color}`}
            >
              {resource.count}
            </div>
            <div className="text-xs text-slate-500">{resource.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Alerts Card Component
// ============================================

function AlertsCard() {
  // Get the top 3 most recent alerts
  const recentAlerts = alerts.slice(0, 3);

  const severityColors = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all duration-300 lg:col-span-2">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500/20 to-red-600/20">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Recent Alerts</h3>
            <p className="text-xs text-slate-500">Unused resources detected</p>
          </div>
        </div>
        <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
          View All
        </button>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {recentAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:bg-slate-900 transition-colors"
          >
            {/* Severity indicator */}
            <div
              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                severityColors[alert.severity]
              }`}
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-white truncate">
                {alert.title}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                {alert.description}
              </p>
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0">
              {alert.timestamp}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Dashboard Cards Component
// ============================================

export default function DashboardCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
      {/* Total Monthly Cost Card */}
      <StatCard
        title="Total Monthly Cost"
        value={`$${dashboardSummary.totalMonthlyCost.toLocaleString()}`}
        subtitle="vs. last month"
        icon={<DollarSign size={24} className="text-blue-400" />}
        trend={{
          value: Math.abs(dashboardSummary.costChange),
          isPositive: dashboardSummary.costChange < 0,
        }}
        accentColor="bg-gradient-to-br from-blue-500/20 to-blue-600/20"
      />

      {/* Active Resources Card */}
      <ResourceCountCard />

      {/* Potential Savings Card */}
      <StatCard
        title="Potential Savings"
        value={`$${dashboardSummary.potentialSavings.toLocaleString()}`}
        subtitle="5 recommendations available"
        icon={<TrendingDown size={24} className="text-green-400" />}
        accentColor="bg-gradient-to-br from-green-500/20 to-green-600/20"
      />

      {/* Alert Count Card */}
      <StatCard
        title="Active Alerts"
        value={dashboardSummary.alertCount.toString()}
        subtitle="2 critical, 2 warning, 1 info"
        icon={<AlertTriangle size={24} className="text-amber-400" />}
        accentColor="bg-gradient-to-br from-amber-500/20 to-amber-600/20"
      />

      {/* Alerts Card - spans 2 columns on large screens */}
      <AlertsCard />
    </div>
  );
}
