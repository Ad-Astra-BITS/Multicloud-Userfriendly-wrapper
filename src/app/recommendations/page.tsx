'use client';

/**
 * Recommendations Page — wired to live API
 */

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import RecommendationModal from '@/components/RecommendationModal';
import { Recommendation } from '@/types';
import { api } from '@/lib/api';
import {
  Lightbulb, Server, Database, HardDrive,
  Filter, ArrowUpDown, TrendingDown, RefreshCw, Loader2,
} from 'lucide-react';

// ── Backend rec shape ─────────────────────────────────────────────────────────

interface BackendRec {
  id: string;
  resourceId: string;
  title: string;
  description: string;
  currentTier: string;
  recommendedTier: string;
  estimatedSavings: number;
  priority: string;
  status: string;
  createdAt: string;
}

// ── Transform backend → frontend ──────────────────────────────────────────────

function toFrontendRec(r: BackendRec): Recommendation {
  const title = r.title ?? '';
  const colonIdx = title.indexOf(':');
  const prefix = colonIdx > 0 ? title.slice(0, colonIdx).toLowerCase() : '';
  const resourceName = colonIdx > 0 ? title.slice(colonIdx + 2).trim() : title;

  let resourceType: 'EC2' | 'S3' | 'RDS' = 'EC2';
  if (prefix.includes('s3') || prefix.includes('storage')) resourceType = 'S3';
  else if (prefix.includes('rds') || prefix.includes('database')) resourceType = 'RDS';

  return {
    id: r.id,
    resourceName,
    resourceType,
    currentTier: r.currentTier ?? '—',
    recommendedTier: r.recommendedTier ?? '—',
    estimatedSavings: r.estimatedSavings ?? 0,
    description: r.description ?? '',
    priority: (r.priority?.toLowerCase() ?? 'low') as 'high' | 'medium' | 'low',
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterType = 'all' | 'EC2' | 'S3' | 'RDS';
type SortType = 'savings' | 'priority' | 'name';

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('savings');
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.get<BackendRec[]>('/recommendations');
      setRecommendations(data.map(toFrontendRec));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/recommendations/refresh');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const getResourceIcon = (type: string) => {
    if (type === 'EC2') return <Server size={18} className="text-blue-400" />;
    if (type === 'S3') return <Database size={18} className="text-green-400" />;
    if (type === 'RDS') return <HardDrive size={18} className="text-amber-400" />;
    return <Server size={18} className="text-slate-400" />;
  };

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const filtered = recommendations
    .filter((r) => filterType === 'all' || r.resourceType === filterType)
    .filter((r) => !executedIds.has(r.id))
    .sort((a, b) => {
      if (sortBy === 'savings') return b.estimatedSavings - a.estimatedSavings;
      if (sortBy === 'priority') {
        const order: Record<string, number> = { high: 3, medium: 2, low: 1 };
        return (order[b.priority] ?? 0) - (order[a.priority] ?? 0);
      }
      return a.resourceName.localeCompare(b.resourceName);
    });

  const totalSavings = filtered.reduce((s, r) => s + r.estimatedSavings, 0);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recommendations</h1>
          <p className="text-slate-400 mt-1">Review and apply cost optimisation suggestions</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {refreshing ? 'Refreshing…' : 'Refresh from AWS'}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <TrendingDown size={24} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Total Potential Savings</h2>
              <p className="text-sm text-slate-400">{filtered.length} recommendations available</p>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-400">${totalSavings.toFixed(2)}/mo</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">Filter:</span>
          <div className="flex gap-2">
            {(['all', 'EC2', 'S3', 'RDS'] as FilterType[]).map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${filterType === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <ArrowUpDown size={16} className="text-slate-400" />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortType)}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500">
            <option value="savings">Highest Savings</option>
            <option value="priority">Priority</option>
            <option value="name">Resource Name</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map((i) => <div key={i} className="h-48 bg-slate-800/50 border border-slate-700/50 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb size={32} className="text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Recommendations</h3>
          <p className="text-slate-400 mb-4">
            {recommendations.length === 0
              ? 'Click "Refresh from AWS" to analyse your account and generate recommendations.'
              : executedIds.size > 0
              ? "You've applied all recommendations. Great job!"
              : 'No recommendations match your current filter.'}
          </p>
          <button onClick={handleRefresh} disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh from AWS
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((rec) => (
            <div key={rec.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                    {getResourceIcon(rec.resourceType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{rec.resourceName}</h3>
                    <p className="text-xs text-slate-500">{rec.resourceType}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border ${priorityColors[rec.priority]}`}>
                  {rec.priority}
                </span>
              </div>
              <p className="text-sm text-slate-400 mb-4 line-clamp-2">{rec.description}</p>
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg mb-4">
                <div className="text-sm">
                  <span className="text-slate-500">{rec.currentTier}</span>
                  <span className="text-slate-600 mx-2">→</span>
                  <span className="text-green-400">{rec.recommendedTier}</span>
                </div>
                <span className="text-lg font-bold text-green-400">${rec.estimatedSavings}/mo</span>
              </div>
              <button onClick={() => { setSelectedRec(rec); setModalOpen(true); }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors">
                View Recommendation
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedRec && (
        <RecommendationModal
          recommendation={selectedRec}
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedRec(null); }}
          onExecute={(r) => setExecutedIds((prev) => new Set([...prev, r.id]))}
        />
      )}
    </DashboardLayout>
  );
}
