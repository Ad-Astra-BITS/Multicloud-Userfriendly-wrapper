'use client';

/**
 * AnalyticsCharts Component
 *
 * Charts for displaying cost trends and resource usage distribution.
 * Uses Recharts library for rendering charts.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { monthlyCosts, resourceUsage } from '@/data/mockData';
import { TrendingUp, PieChart as PieIcon, BarChart3 } from 'lucide-react';

// ============================================
// Custom Tooltip Component
// ============================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { month?: string; name?: string };
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-400 text-xs mb-1">{label}</p>
        <p className="text-white font-semibold">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
}

// ============================================
// Monthly Cost Trend Chart
// ============================================

export function MonthlyCostChart() {
  // Calculate trend (compare last two months)
  const lastMonth = monthlyCosts[monthlyCosts.length - 1].cost;
  const previousMonth = monthlyCosts[monthlyCosts.length - 2].cost;
  const trendPercent = ((lastMonth - previousMonth) / previousMonth) * 100;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Monthly Cost Trend</h3>
            <p className="text-xs text-slate-500">Last 7 months</p>
          </div>
        </div>
        <div
          className={`text-sm font-medium ${
            trendPercent < 0 ? 'text-green-400' : 'text-red-400'
          }`}
        >
          {trendPercent > 0 ? '+' : ''}
          {trendPercent.toFixed(1)}% vs last month
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={monthlyCosts}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="month"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCost)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================
// Resource Usage Distribution Chart
// ============================================

export function ResourceDistributionChart() {
  // Calculate total for percentage
  const total = resourceUsage.reduce((sum, item) => sum + item.value, 0);

  // Custom label renderer for pie chart
  const renderLabel = (props: {
    cx?: number;
    cy?: number;
    midAngle?: number;
    innerRadius?: number;
    outerRadius?: number;
    percent?: number;
  }) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
          <PieIcon size={20} className="text-purple-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Resource Distribution</h3>
          <p className="text-xs text-slate-500">Cost by service type</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={resourceUsage}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              innerRadius={40}
              dataKey="value"
              strokeWidth={2}
              stroke="#1e293b"
            >
              {resourceUsage.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value: string) => (
                <span className="text-slate-300 text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with values */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {resourceUsage.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-slate-400">{item.name}</span>
            </div>
            <span className="text-sm font-medium text-white">
              ${item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Resource Cost Bar Chart
// ============================================

export function ResourceCostBarChart() {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
          <BarChart3 size={20} className="text-green-400" />
        </div>
        <div>
          <h3 className="font-semibold text-white">Cost by Service</h3>
          <p className="text-xs text-slate-500">Current month breakdown</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={resourceUsage}
            layout="vertical"
            margin={{ top: 0, right: 20, left: 40, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal />
            <XAxis
              type="number"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                      <p className="text-slate-400 text-xs mb-1">
                        {payload[0].payload.name}
                      </p>
                      <p className="text-white font-semibold">
                        ${Number(payload[0].value).toLocaleString()}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {resourceUsage.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
