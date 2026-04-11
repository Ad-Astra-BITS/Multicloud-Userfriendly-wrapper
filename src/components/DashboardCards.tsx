'use client';

/**
 * DashboardCards Component — wired to live API
 * Fetches /api/analytics/summary and /api/resources/alerts from the backend.
 */

import { useEffect, useState } from 'react';
import {
  DollarSign,
  Server,
  TrendingDown,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { DashboardSummary } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Types from backend ────────────────────────────────────────────────────────

interface BackendAlert {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  resolved: boolean;
  createdAt: string;
  resourceId?: string;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  accentColor: string;
  loading?: boolean;
}

function StatCard({ title, value, subtitle, icon, trend, accentColor, loading }: StatCardProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accentColor}`}>
          {icon}
        </div>
        {trend && !loading && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.isPositive ? <ArrowDown size={16} /> : <ArrowUp size={16} />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-24 bg-slate-700/50 rounded-lg animate-pulse" />
        ) : (
          <h3 className="text-3xl font-bold text-white">{value}</h3>
        )}
        <p className="text-slate-400 text-sm mt-1">{title}</p>
        {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Resource Count Card ───────────────────────────────────────────────────────

function ResourceCountCard({ summary, loading }: { summary: DashboardSummary | null; loading: boolean }) {
  const total = summary
    ? summary.activeResources.ec2 + summary.activeResources.s3 + summary.activeResources.rds
    : 0;

  const resources = [
    { name: 'EC2', count: summary?.activeResources.ec2 ?? 0, icon: Server, color: 'text-blue-400' },
    { name: 'S3',  count: summary?.activeResources.s3  ?? 0, icon: Database, color: 'text-green-400' },
    { name: 'RDS', count: summary?.activeResources.rds ?? 0, icon: HardDrive, color: 'text-amber-400' },
  ];

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-purple-600/20">
          <Server size={24} className="text-purple-400" />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">AWS Resources</span>
      </div>
      <div className="mt-4">
        {loading ? (
          <div className="h-9 w-16 bg-slate-700/50 rounded-lg animate-pulse" />
        ) : (
          <h3 className="text-3xl font-bold text-white">{total}</h3>
        )}
        <p className="text-slate-400 text-sm mt-1">Active Resources</p>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-3 gap-2">
        {resources.map((r) => (
          <div key={r.name} className="text-center">
            {loading ? (
              <div className="h-6 w-8 bg-slate-700/50 rounded mx-auto animate-pulse" />
            ) : (
              <div className={`text-lg font-semibold ${r.color}`}>{r.count}</div>
            )}
            <div className="text-xs text-slate-500">{r.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alerts Card ───────────────────────────────────────────────────────────────

function AlertsCard({ alerts, loading }: { alerts: BackendAlert[]; loading: boolean }) {
  const severityColors: Record<string, string> = {
    CRITICAL: 'bg-red-500',
    WARNING: 'bg-amber-500',
    INFO: 'bg-blue-500',
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
            <p className="text-xs text-slate-500">Unresolved issues detected</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-slate-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No unresolved alerts — your account looks healthy!
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:bg-slate-900 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${severityColors[alert.severity] ?? 'bg-slate-500'}`} />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">{alert.title}</h4>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{alert.description}</p>
              </div>
              <span className="text-xs text-slate-500 flex-shrink-0">{timeAgo(alert.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function DashboardCards() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<BackendAlert[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<DashboardSummary>('/analytics/summary')
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingSummary(false));

    api.get<BackendAlert[]>('/resources/alerts')
      .then(setAlerts)
      .catch(() => setAlerts([]))
      .finally(() => setLoadingAlerts(false));
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
          <RefreshCw size={14} />
          {error} — check that your AWS credentials have Cost Explorer access.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard
          title="Total Monthly Cost"
          value={summary ? `$${summary.totalMonthlyCost.toLocaleString()}` : '$0'}
          subtitle="vs. last month"
          icon={<DollarSign size={24} className="text-blue-400" />}
          trend={summary ? { value: Math.abs(summary.costChange), isPositive: summary.costChange < 0 } : undefined}
          accentColor="bg-gradient-to-br from-blue-500/20 to-blue-600/20"
          loading={loadingSummary}
        />

        <ResourceCountCard summary={summary} loading={loadingSummary} />

        <StatCard
          title="Potential Savings"
          value={summary ? `$${summary.potentialSavings.toLocaleString()}` : '$0'}
          subtitle="from pending recommendations"
          icon={<TrendingDown size={24} className="text-green-400" />}
          accentColor="bg-gradient-to-br from-green-500/20 to-green-600/20"
          loading={loadingSummary}
        />

        <StatCard
          title="Active Alerts"
          value={summary ? summary.alertCount.toString() : '0'}
          subtitle="unresolved issues"
          icon={<AlertTriangle size={24} className="text-amber-400" />}
          accentColor="bg-gradient-to-br from-amber-500/20 to-amber-600/20"
          loading={loadingSummary}
        />

        <AlertsCard alerts={alerts} loading={loadingAlerts} />
      </div>
    </div>
  );
}
