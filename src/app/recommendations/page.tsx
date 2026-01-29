'use client';

/**
 * Recommendations Page
 *
 * Displays all cost optimization recommendations with filtering and sorting.
 * Users can view details and execute recommendations via modal.
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import RecommendationModal from '@/components/RecommendationModal';
import { recommendations } from '@/data/mockData';
import { Recommendation } from '@/types';
import {
  Lightbulb,
  Server,
  Database,
  HardDrive,
  Filter,
  ArrowUpDown,
  TrendingDown,
} from 'lucide-react';

// ============================================
// Filter and Sort Options
// ============================================

type FilterType = 'all' | 'EC2' | 'S3' | 'RDS';
type SortType = 'savings' | 'priority' | 'name';

export default function RecommendationsPage() {
  // State for modal
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<Recommendation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for filtering and sorting
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('savings');

  // State for executed recommendations
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  // Get resource icon based on type
  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'EC2':
        return <Server size={18} className="text-blue-400" />;
      case 'S3':
        return <Database size={18} className="text-green-400" />;
      case 'RDS':
        return <HardDrive size={18} className="text-amber-400" />;
      default:
        return <Server size={18} className="text-slate-400" />;
    }
  };

  // Priority badge colors
  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  // Filter and sort recommendations
  const filteredRecommendations = recommendations
    .filter((rec) => filterType === 'all' || rec.resourceType === filterType)
    .filter((rec) => !executedIds.has(rec.id))
    .sort((a, b) => {
      switch (sortBy) {
        case 'savings':
          return b.estimatedSavings - a.estimatedSavings;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'name':
          return a.resourceName.localeCompare(b.resourceName);
        default:
          return 0;
      }
    });

  // Calculate total potential savings
  const totalSavings = filteredRecommendations.reduce(
    (sum, rec) => sum + rec.estimatedSavings,
    0
  );

  // Handle recommendation execution
  const handleExecute = (recommendation: Recommendation) => {
    setExecutedIds((prev) => new Set([...prev, recommendation.id]));
  };

  // Open modal with selected recommendation
  const openModal = (recommendation: Recommendation) => {
    setSelectedRecommendation(recommendation);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Recommendations</h1>
        <p className="text-slate-400 mt-1">
          Review and apply cost optimization suggestions
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <TrendingDown size={24} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Total Potential Savings
              </h2>
              <p className="text-sm text-slate-400">
                {filteredRecommendations.length} recommendations available
              </p>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-400">
            ${totalSavings.toFixed(2)}/mo
          </div>
        </div>
      </div>

      {/* Filters and sort controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        {/* Filter by type */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">Filter:</span>
          <div className="flex gap-2">
            {(['all', 'EC2', 'S3', 'RDS'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  filterType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {type === 'all' ? 'All' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Sort options */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <ArrowUpDown size={16} className="text-slate-400" />
          <span className="text-sm text-slate-400">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            className="bg-slate-800 text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="savings">Highest Savings</option>
            <option value="priority">Priority</option>
            <option value="name">Resource Name</option>
          </select>
        </div>
      </div>

      {/* Recommendations list */}
      {filteredRecommendations.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb size={32} className="text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No Recommendations
          </h3>
          <p className="text-slate-400">
            {executedIds.size > 0
              ? "You've applied all recommendations. Great job!"
              : 'No recommendations match your current filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRecommendations.map((rec) => (
            <div
              key={rec.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                    {getResourceIcon(rec.resourceType)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {rec.resourceName}
                    </h3>
                    <p className="text-xs text-slate-500">{rec.resourceType}</p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    priorityColors[rec.priority]
                  }`}
                >
                  {rec.priority}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                {rec.description}
              </p>

              {/* Tier change and savings */}
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg mb-4">
                <div className="text-sm">
                  <span className="text-slate-500">{rec.currentTier}</span>
                  <span className="text-slate-600 mx-2">→</span>
                  <span className="text-green-400">{rec.recommendedTier}</span>
                </div>
                <span className="text-lg font-bold text-green-400">
                  ${rec.estimatedSavings}/mo
                </span>
              </div>

              {/* Action button */}
              <button
                onClick={() => openModal(rec)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
              >
                View Recommendation
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation Modal */}
      {selectedRecommendation && (
        <RecommendationModal
          recommendation={selectedRecommendation}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedRecommendation(null);
          }}
          onExecute={handleExecute}
        />
      )}
    </DashboardLayout>
  );
}
