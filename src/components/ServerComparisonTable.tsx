'use client';

/**
 * ServerComparisonTable Component
 *
 * Displays a comparison table of server specs across different cloud providers.
 * Includes dropdowns to change CPU and RAM specs dynamically.
 */

import { useState, useMemo } from 'react';
import { getServerComparisons } from '@/data/mockData';
import { ServerComparison } from '@/types';
import {
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  MapPin,
  ChevronDown,
  Award,
  Check,
} from 'lucide-react';

// ============================================
// Provider logos/colors
// ============================================

const providerStyles: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  AWS: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
  },
  Azure: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  DigitalOcean: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
  },
  GCP: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
};

// ============================================
// Spec Selector Dropdown Component
// ============================================

interface SpecSelectorProps {
  label: string;
  value: number;
  options: number[];
  unit: string;
  icon: React.ReactNode;
  onChange: (value: number) => void;
}

function SpecSelector({
  label,
  value,
  options,
  unit,
  icon,
  onChange,
}: SpecSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white hover:border-slate-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>
            {value} {unit}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center justify-between ${
                  value === option
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span>
                  {option} {unit}
                </span>
                {value === option && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Server Card Component (Mobile View)
// ============================================

interface ServerCardProps {
  server: ServerComparison;
}

function ServerCard({ server }: ServerCardProps) {
  const style = providerStyles[server.provider];

  return (
    <div
      className={`relative bg-slate-800/50 border rounded-xl p-5 ${
        server.isBestChoice
          ? 'border-green-500/50 ring-1 ring-green-500/20'
          : 'border-slate-700/50'
      }`}
    >
      {/* Best choice badge */}
      {server.isBestChoice && (
        <div className="absolute -top-3 left-4 px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
          <Award size={12} />
          Best Value
        </div>
      )}

      {/* Provider header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${style.bg} flex items-center justify-center`}
          >
            <Server size={20} className={style.text} />
          </div>
          <div>
            <h3 className={`font-semibold ${style.text}`}>{server.provider}</h3>
            <p className="text-xs text-slate-500">{server.instanceType}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            ${server.monthlyPrice}
          </div>
          <div className="text-xs text-slate-500">/month</div>
        </div>
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Cpu size={14} className="text-slate-500" />
          <span className="text-slate-400">{server.cpu}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MemoryStick size={14} className="text-slate-500" />
          <span className="text-slate-400">{server.ram}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <HardDrive size={14} className="text-slate-500" />
          <span className="text-slate-400">{server.storage}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin size={14} className="text-slate-500" />
          <span className="text-slate-400">{server.region}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Server Comparison Table Component
// ============================================

export default function ServerComparisonTable() {
  // State for selected specs
  const [selectedCPU, setSelectedCPU] = useState(2);
  const [selectedRAM, setSelectedRAM] = useState(4);

  // CPU and RAM options
  const cpuOptions = [1, 2, 4];
  const ramOptions = [2, 4, 8];

  // Get server comparisons based on selected specs
  const servers = useMemo(
    () => getServerComparisons(selectedCPU, selectedRAM),
    [selectedCPU, selectedRAM]
  );

  // Find the cheapest option
  const cheapestPrice = Math.min(...servers.map((s) => s.monthlyPrice));

  return (
    <div>
      {/* Spec selectors */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mb-6">
        <h3 className="font-semibold text-white mb-4">Select Server Specs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SpecSelector
            label="CPU Cores"
            value={selectedCPU}
            options={cpuOptions}
            unit="vCPU"
            icon={<Cpu size={16} className="text-blue-400" />}
            onChange={setSelectedCPU}
          />
          <SpecSelector
            label="Memory"
            value={selectedRAM}
            options={ramOptions}
            unit="GB RAM"
            icon={<MemoryStick size={16} className="text-green-400" />}
            onChange={setSelectedRAM}
          />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Storage</label>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-400">
              <HardDrive size={16} className="text-amber-400" />
              <span>50 GB SSD</span>
              <span className="ml-auto text-xs text-slate-600">(Fixed)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop table view */}
      <div className="hidden lg:block bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Instance Type
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                CPU
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                RAM
              </th>
              <th className="px-6 py-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                Storage
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Region
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Monthly Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {servers.map((server) => {
              const style = providerStyles[server.provider];
              return (
                <tr
                  key={server.id}
                  className={`hover:bg-slate-800/50 transition-colors ${
                    server.isBestChoice ? 'bg-green-500/5' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center`}
                      >
                        <Server size={16} className={style.text} />
                      </div>
                      <span className={`font-medium ${style.text}`}>
                        {server.provider}
                      </span>
                      {server.isBestChoice && (
                        <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
                          <Award size={10} />
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {server.instanceType}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-300">
                    {server.cpu}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-300">
                    {server.ram}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-300">
                    {server.storage}
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">
                    {server.region}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`text-lg font-bold ${
                        server.isBestChoice ? 'text-green-400' : 'text-white'
                      }`}
                    >
                      ${server.monthlyPrice.toFixed(2)}
                    </span>
                    <span className="text-slate-500 text-sm">/mo</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {servers.map((server) => (
          <ServerCard key={server.id} server={server} />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium text-slate-300">
              Selected Configuration
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              {selectedCPU} vCPU • {selectedRAM} GB RAM • 50 GB SSD
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Best price available</p>
            <p className="text-2xl font-bold text-green-400">
              ${cheapestPrice.toFixed(2)}
              <span className="text-sm font-normal text-slate-500">/mo</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
