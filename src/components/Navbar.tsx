'use client';

/**
 * Navbar Component
 *
 * Top navigation bar for Ad Astra dashboard.
 * Contains the app logo/name and user actions.
 */

import { Bell, Search, User, Menu } from 'lucide-react';
import { dashboardSummary } from '@/data/mockData';

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-4 py-3 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between">
        {/* Left section: Menu button and Logo */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>

          {/* App Logo and Name */}
          <div className="flex items-center gap-3">
            {/* Star icon representing "Ad Astra" (to the stars) */}
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Ad Astra
            </span>
          </div>
        </div>

        {/* Center section: Search bar (hidden on mobile) */}
        <div className="hidden md:flex flex-1 max-w-xl mx-8">
          <div className="relative w-full">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search resources, recommendations..."
              className="w-full bg-slate-800 text-slate-200 placeholder-slate-400 rounded-lg pl-10 pr-4 py-2 text-sm border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>
        </div>

        {/* Right section: Notifications and User profile */}
        <div className="flex items-center gap-2">
          {/* Notification bell with badge */}
          <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <Bell size={20} />
            {/* Alert count badge */}
            {dashboardSummary.alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {dashboardSummary.alertCount}
              </span>
            )}
          </button>

          {/* User profile button */}
          <button className="flex items-center gap-2 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <User size={16} className="text-white" />
            </div>
            <span className="hidden sm:block text-sm text-slate-200">Admin</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
