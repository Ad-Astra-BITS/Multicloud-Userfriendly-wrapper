'use client';

/**
 * Sidebar Component
 *
 * Navigation sidebar with menu items for all dashboard sections.
 * Supports responsive design with mobile overlay.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Lightbulb,
  BarChart3,
  Server,
  Power,
  Settings,
  X,
  Database,
} from 'lucide-react';

// Navigation menu items configuration
const menuItems = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Overview & metrics',
  },
  {
    name: 'Recommendations',
    href: '/recommendations',
    icon: Lightbulb,
    description: 'Cost optimization tips',
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Usage & cost trends',
  },
  {
    name: 'Compare Servers',
    href: '/compare',
    icon: Server,
    description: 'Provider comparison',
  },
  {
    name: 'S3 Lifecycle',
    href: '/s3-lifecycle',
    icon: Database,
    description: 'Storage tier management',
  },
  {
    name: 'Kill Switch',
    href: '/kill-switch',
    icon: Power,
    description: 'Emergency shutdown',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Account & preferences',
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed top-14 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-700
          transform transition-transform duration-300 ease-in-out z-40
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Mobile close button */}
        <div className="lg:hidden flex justify-end p-2">
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation menu */}
        <nav className="px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            // Check if current path matches this menu item
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200 group
                  ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }
                `}
              >
                {/* Menu icon */}
                <Icon
                  size={20}
                  className={`
                    flex-shrink-0
                    ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}
                  `}
                />

                {/* Menu text */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.name}</div>
                  <div
                    className={`text-xs truncate ${
                      isActive ? 'text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    {item.description}
                  </div>
                </div>

                {/* Active indicator dot */}
                {isActive && (
                  <div className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section: Quick stats */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
              Quick Stats
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Active Resources</span>
                <span className="text-white font-medium">48</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">This Month</span>
                <span className="text-green-400 font-medium">$12,458</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
