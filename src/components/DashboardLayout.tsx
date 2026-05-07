'use client';

/**
 * DashboardLayout Component
 *
 * Main layout wrapper for all dashboard pages.
 * Includes Navbar, Sidebar, and main content area.
 * Handles responsive sidebar toggle state.
 * Shows a banner prompting the user to connect their AWS account if not yet done.
 */

import { useState } from 'react';
import { CloudOff, Zap } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAWS } from '@/context/AWSContext';
import { useDO } from '@/context/DOContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function ConnectionBanner() {
  const { isConnected: awsConnected, credentials: awsCreds, openConnectModal: openAWS, disconnect: disconnectAWS } = useAWS();
  const { isConnected: doConnected, credentials: doCreds, openConnectModal: openDO, disconnect: disconnectDO } = useDO();

  return (
    <div className="space-y-2 mb-6">
      {/* AWS banner */}
      {awsConnected && awsCreds ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-green-300">
            AWS: Account <span className="font-mono font-semibold">{awsCreds.accountId}</span>
            {' '}({awsCreds.region})
          </span>
          <button onClick={disconnectAWS} className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <CloudOff size={14} className="text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-200 flex-1">No AWS account connected.</span>
          <button
            onClick={openAWS}
            className="flex items-center gap-1 px-2.5 py-1 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            <Zap size={11} /> Connect AWS
          </button>
        </div>
      )}

      {/* DO banner */}
      {doConnected && doCreds ? (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <span className="text-blue-300">
            DigitalOcean: <span className="font-mono font-semibold">{doCreds.email ?? doCreds.uuid}</span>
          </span>
          <button onClick={disconnectDO} className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors">
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/60 border border-slate-700/40 rounded-xl">
          <CloudOff size={14} className="text-slate-400 flex-shrink-0" />
          <span className="text-sm text-slate-400 flex-1">No DigitalOcean account connected.</span>
          <button
            onClick={openDO}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            <Zap size={11} /> Connect DO
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top navigation bar */}
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area — pt-14 offsets the fixed navbar */}
      <main className="lg:ml-64 pt-14 min-h-screen">
        <div className="p-6 md:p-8 lg:p-10">
          {/* AWS connection banner lives inside the padded wrapper */}
          <ConnectionBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
