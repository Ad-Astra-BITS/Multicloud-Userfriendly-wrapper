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

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function ConnectionBanner() {
  const { isConnected, credentials, openConnectModal, disconnect } = useAWS();

  if (isConnected && credentials) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 mb-6 bg-green-500/10 border border-green-500/20 rounded-xl text-sm">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
        <span className="text-green-300">
          Connected to AWS account{' '}
          <span className="font-mono font-semibold">{credentials.accountId}</span>
          {' '}({credentials.region})
        </span>
        <button
          onClick={disconnect}
          className="ml-auto text-xs text-slate-400 hover:text-red-400 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl">
      <CloudOff size={16} className="text-amber-400 flex-shrink-0" />
      <span className="text-sm text-amber-200 flex-1">
        No AWS account connected. Connect your account to manage live resources.
      </span>
      <button
        onClick={openConnectModal}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
      >
        <Zap size={12} />
        Connect AWS
      </button>
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
