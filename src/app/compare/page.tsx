'use client';

/**
 * Server Comparison Page
 *
 * Compare server specs and pricing across different cloud providers.
 * Includes interactive dropdowns to customize server configuration.
 */

import DashboardLayout from '@/components/DashboardLayout';
import ServerComparisonTable from '@/components/ServerComparisonTable';
import { Server, Info } from 'lucide-react';

export default function ComparePage() {
  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Compare Servers</h1>
        <p className="text-slate-400 mt-1">
          Compare pricing across AWS, Azure, DigitalOcean, and GCP
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Info size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-300">
              Prices are based on on-demand pricing for standard compute
              instances. Actual costs may vary based on region, reserved
              instances, or spot pricing.
            </p>
          </div>
        </div>
      </div>

      {/* Server comparison table */}
      <ServerComparisonTable />

      {/* Additional info section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            provider: 'AWS',
            description: 'Amazon Web Services - Industry leader with extensive global infrastructure',
            color: 'orange',
          },
          {
            provider: 'Azure',
            description: 'Microsoft Azure - Strong enterprise integration and hybrid cloud capabilities',
            color: 'blue',
          },
          {
            provider: 'DigitalOcean',
            description: 'Developer-friendly with simple pricing and easy deployment',
            color: 'cyan',
          },
          {
            provider: 'GCP',
            description: 'Google Cloud Platform - Advanced ML/AI capabilities and networking',
            color: 'red',
          },
        ].map((item) => (
          <div
            key={item.provider}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <Server
                size={16}
                className={`text-${item.color}-400`}
              />
              <h3 className="font-medium text-white">{item.provider}</h3>
            </div>
            <p className="text-xs text-slate-500">{item.description}</p>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
