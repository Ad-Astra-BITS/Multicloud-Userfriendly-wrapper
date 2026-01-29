'use client';

/**
 * Analytics Page
 *
 * Displays cost trends, resource usage distribution, and other analytics.
 * Uses Recharts for data visualization.
 */

import DashboardLayout from '@/components/DashboardLayout';
import {
  MonthlyCostChart,
  ResourceDistributionChart,
  ResourceCostBarChart,
} from '@/components/AnalyticsCharts';
import { monthlyCosts, resourceUsage, dashboardSummary } from '@/data/mockData';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Activity,
  Calendar,
} from 'lucide-react';

// ============================================
// Summary Stats Cards
// ============================================

function SummaryStats() {
  // Calculate stats from data
  const currentMonth = monthlyCosts[monthlyCosts.length - 1].cost;
  const previousMonth = monthlyCosts[monthlyCosts.length - 2].cost;
  const monthlyChange = ((currentMonth - previousMonth) / previousMonth) * 100;

  const avgCost =
    monthlyCosts.reduce((sum, m) => sum + m.cost, 0) / monthlyCosts.length;

  const highestMonth = monthlyCosts.reduce((max, m) =>
    m.cost > max.cost ? m : max
  );

  const stats = [
    {
      title: 'Current Month',
      value: `$${currentMonth.toLocaleString()}`,
      change: monthlyChange,
      icon: DollarSign,
      color: 'blue',
    },
    {
      title: 'Monthly Average',
      value: `$${Math.round(avgCost).toLocaleString()}`,
      subtitle: 'Last 7 months',
      icon: Activity,
      color: 'purple',
    },
    {
      title: 'Potential Savings',
      value: `$${dashboardSummary.potentialSavings.toLocaleString()}`,
      subtitle: '5 recommendations',
      icon: TrendingDown,
      color: 'green',
    },
    {
      title: 'Peak Month',
      value: highestMonth.month,
      subtitle: `$${highestMonth.cost.toLocaleString()}`,
      icon: Calendar,
      color: 'amber',
    },
  ];

  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/20 text-purple-400',
    green: 'from-green-500/20 to-green-600/20 text-green-400',
    amber: 'from-amber-500/20 to-amber-600/20 text-amber-400',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-lg bg-gradient-to-br ${
                colorClasses[stat.color as keyof typeof colorClasses]
              } flex items-center justify-center`}
            >
              <stat.icon size={20} />
            </div>
            {stat.change !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs font-medium ${
                  stat.change < 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {stat.change < 0 ? (
                  <TrendingDown size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}
                {Math.abs(stat.change).toFixed(1)}%
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-white">{stat.value}</div>
          <div className="text-sm text-slate-500 mt-1">
            {stat.subtitle || stat.title}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Cost Breakdown Table
// ============================================

function CostBreakdownTable() {
  // Extended breakdown data
  const breakdown = [
    { service: 'EC2 Instances', category: 'Compute', cost: 5840, change: -3.2 },
    { service: 'S3 Storage', category: 'Storage', cost: 3245, change: 5.8 },
    { service: 'RDS Databases', category: 'Database', cost: 2156, change: -8.1 },
    { service: 'CloudFront', category: 'CDN', cost: 567, change: 2.4 },
    { service: 'Lambda', category: 'Compute', cost: 412, change: 12.5 },
    { service: 'Other Services', category: 'Misc', cost: 238, change: -1.2 },
  ];

  const total = breakdown.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-4">Cost Breakdown</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
              <th className="pb-3 font-medium">Service</th>
              <th className="pb-3 font-medium">Category</th>
              <th className="pb-3 font-medium text-right">Cost</th>
              <th className="pb-3 font-medium text-right">% of Total</th>
              <th className="pb-3 font-medium text-right">MoM Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {breakdown.map((item) => (
              <tr key={item.service} className="text-sm">
                <td className="py-3 text-white font-medium">{item.service}</td>
                <td className="py-3 text-slate-400">{item.category}</td>
                <td className="py-3 text-right text-white">
                  ${item.cost.toLocaleString()}
                </td>
                <td className="py-3 text-right text-slate-400">
                  {((item.cost / total) * 100).toFixed(1)}%
                </td>
                <td className="py-3 text-right">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      item.change < 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {item.change < 0 ? (
                      <TrendingDown size={12} />
                    ) : (
                      <TrendingUp size={12} />
                    )}
                    {Math.abs(item.change)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-sm font-semibold border-t border-slate-600">
              <td className="pt-3 text-white">Total</td>
              <td className="pt-3"></td>
              <td className="pt-3 text-right text-white">
                ${total.toLocaleString()}
              </td>
              <td className="pt-3 text-right text-slate-400">100%</td>
              <td className="pt-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ============================================
// Main Analytics Page
// ============================================

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-400 mt-1">
          Cost trends and resource usage insights
        </p>
      </div>

      {/* Summary stats */}
      <SummaryStats />

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly cost trend chart */}
        <MonthlyCostChart />

        {/* Resource distribution pie chart */}
        <ResourceDistributionChart />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <ResourceCostBarChart />

        {/* Cost breakdown table */}
        <CostBreakdownTable />
      </div>
    </DashboardLayout>
  );
}
