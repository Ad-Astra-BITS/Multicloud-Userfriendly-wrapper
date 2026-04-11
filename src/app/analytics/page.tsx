'use client';

/**
 * Analytics Page — wired to live API
 */

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { MonthlyCostChart, ResourceDistributionChart, ResourceCostBarChart } from '@/components/AnalyticsCharts';
import { MonthlyCost, ResourceUsage, DashboardSummary } from '@/types';
import { api } from '@/lib/api';
import {
  DollarSign, TrendingDown, TrendingUp, Activity, Calendar, Loader2,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'short' });
}

const SERVICE_COLORS: Record<string, string> = {
  'Amazon EC2': '#3b82f6',
  'Amazon Elastic Compute Cloud': '#3b82f6',
  'Amazon S3': '#10b981',
  'Amazon Simple Storage Service': '#10b981',
  'Amazon RDS': '#f59e0b',
  'Amazon Relational Database Service': '#f59e0b',
  'AWS Lambda': '#8b5cf6',
  'Amazon CloudFront': '#06b6d4',
  'Amazon DynamoDB': '#f97316',
};

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899','#6b7280'];

interface CostRecord { month: string; service: string; cost: number; }

function toResourceUsage(records: CostRecord[]): ResourceUsage[] {
  // Group by service, sum costs, take top 6
  const map = new Map<string, number>();
  for (const r of records) {
    map.set(r.service, (map.get(r.service) ?? 0) + r.cost);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([service, value], i) => ({
      name: service.replace('Amazon ', '').replace('AWS ', '').slice(0, 20),
      value: Math.round(value * 100) / 100,
      color: SERVICE_COLORS[service] ?? PALETTE[i % PALETTE.length],
    }));
}

// ── Summary Stats ─────────────────────────────────────────────────────────────

function SummaryStats({ data, loading }: { data: MonthlyCost[]; summary: DashboardSummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const currentMonth = data[data.length - 1]?.cost ?? 0;
  const previousMonth = data[data.length - 2]?.cost ?? 0;
  const monthlyChange = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0;
  const avgCost = data.length > 0 ? data.reduce((s, m) => s + m.cost, 0) / data.length : 0;
  const highestMonth = data.reduce((max, m) => m.cost > max.cost ? m : max, data[0] ?? { month: '—', cost: 0 });

  const stats = [
    { title: 'Current Month', value: `$${currentMonth.toLocaleString()}`, change: monthlyChange, icon: DollarSign, color: 'blue' },
    { title: 'Monthly Average', value: `$${Math.round(avgCost).toLocaleString()}`, subtitle: `Last ${data.length} months`, icon: Activity, color: 'purple' },
    { title: 'Peak Month', value: highestMonth.month, subtitle: `$${highestMonth.cost.toLocaleString()}`, icon: Calendar, color: 'amber' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/20 text-purple-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400',
    amber: 'from-amber-500/20 to-amber-600/20 text-amber-400',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.title} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[stat.color]} flex items-center justify-center`}>
              <stat.icon size={20} />
            </div>
            {'change' in stat && stat.change !== undefined && (
              <div className={`flex items-center gap-1 text-xs font-medium ${stat.change < 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stat.change < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                {Math.abs(stat.change).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-white">{stat.value}</div>
          <div className="text-sm text-slate-500 mt-1">{stat.subtitle ?? stat.title}</div>
        </div>
      ))}
    </div>
  );
}

// ── Cost Breakdown Table ───────────────────────────────────────────────────────

function CostBreakdownTable({ records, loading }: { records: CostRecord[]; loading: boolean }) {
  const byService = new Map<string, number>();
  for (const r of records) {
    byService.set(r.service, (byService.get(r.service) ?? 0) + r.cost);
  }
  const rows = Array.from(byService.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([service, cost]) => ({ service, cost: Math.round(cost * 100) / 100 }));
  const total = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-4">Cost Breakdown by Service</h3>
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-10 bg-slate-700/30 rounded animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">No cost data available yet. AWS Cost Explorer may take up to 24 hours to populate for new accounts.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                <th className="pb-3 font-medium">Service</th>
                <th className="pb-3 font-medium text-right">Cost</th>
                <th className="pb-3 font-medium text-right">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rows.map((item) => (
                <tr key={item.service} className="text-sm">
                  <td className="py-3 text-white font-medium">{item.service}</td>
                  <td className="py-3 text-right text-white">${item.cost.toLocaleString()}</td>
                  <td className="py-3 text-right text-slate-400">{total > 0 ? ((item.cost / total) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-sm font-semibold border-t border-slate-600">
                <td className="pt-3 text-white">Total</td>
                <td className="pt-3 text-right text-white">${total.toLocaleString()}</td>
                <td className="pt-3 text-right text-slate-400">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [trend, setTrend] = useState<MonthlyCost[]>([]);
  const [distribution, setDistribution] = useState<ResourceUsage[]>([]);
  const [breakdown, setBreakdown] = useState<CostRecord[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ month: string; cost: number }[]>('/analytics/trend?months=6'),
      api.get<CostRecord[]>('/analytics/breakdown?months=6'),
      api.get<DashboardSummary>('/analytics/summary'),
    ]).then(([trendRes, breakdownRes, summaryRes]) => {
      if (trendRes.status === 'fulfilled') {
        setTrend(trendRes.value.map((d) => ({ month: formatMonth(d.month), cost: d.cost })));
      }
      if (breakdownRes.status === 'fulfilled') {
        setBreakdown(breakdownRes.value);
        setDistribution(toResourceUsage(breakdownRes.value));
      }
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      setLoading(false);
    });
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-slate-400 mt-1">Cost trends and resource usage insights</p>
        </div>
        {loading && <Loader2 size={20} className="text-slate-400 animate-spin" />}
      </div>

      <SummaryStats data={trend} summary={summary} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <MonthlyCostChart data={trend} />
        <ResourceDistributionChart data={distribution} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResourceCostBarChart data={distribution} />
        <CostBreakdownTable records={breakdown} loading={loading} />
      </div>
    </DashboardLayout>
  );
}
