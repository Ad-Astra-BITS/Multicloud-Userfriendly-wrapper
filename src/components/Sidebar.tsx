'use client';

/**
 * Sidebar Component
 *
 * Navigation sidebar. Structure:
 *   - Universal items (always visible): Dashboard, Recommendations, Analytics,
 *     Compare Servers, Kill Switch, Settings.
 *   - AWS section: visible only when AWS is connected (S3 Lifecycle + connect CTA).
 *   - DigitalOcean section: visible only when DO is connected (Droplets, Spaces,
 *     Databases, Billing + connect CTA).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Lightbulb,
  BarChart3,
  Server,
  Power,
  Settings,
  X,
  Database,
  HardDrive,
  DollarSign,
  Plug,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAWS } from '@/context/AWSContext';
import { useDO } from '@/context/DOContext';
import { useGCP } from '@/context/GCPContext';
import { useAzure } from '@/context/AzureContext';

// ── Menu definitions ───────────────────────────────────────────────────────

const universalItems = [
  { name: 'Dashboard',       href: '/',               icon: LayoutDashboard, description: 'Overview & metrics' },
  { name: 'Recommendations', href: '/recommendations', icon: Lightbulb,       description: 'Cost optimization tips' },
  { name: 'Analytics',       href: '/analytics',       icon: BarChart3,       description: 'Usage & cost trends' },
  { name: 'Compare Servers', href: '/compare',         icon: Server,          description: 'Provider comparison' },
  { name: 'Kill Switch',     href: '/kill-switch',     icon: Power,           description: 'Emergency shutdown' },
  { name: 'Settings',        href: '/settings',        icon: Settings,        description: 'Account & preferences' },
];

const awsItems = [
  { name: 'S3 Lifecycle', href: '/s3-lifecycle', icon: Database, description: 'Storage tier management' },
];

const doItems = [
  { name: 'Droplets',   href: '/do-droplets',  icon: Server,    description: 'Virtual machines' },
  { name: 'Spaces',     href: '/do-spaces',    icon: HardDrive, description: 'Object storage' },
  { name: 'Databases',  href: '/do-databases', icon: Database,  description: 'Managed databases' },
  { name: 'DO Billing', href: '/do-billing',   icon: DollarSign,description: 'Invoices & spend' },
];

const gcpItems = [
  { name: 'Compute VMs',   href: '/gcp-instances', icon: Server,    description: 'Compute Engine VMs' },
  { name: 'Cloud Storage', href: '/gcp-storage',   icon: HardDrive, description: 'Storage buckets' },
  { name: 'Cloud SQL',     href: '/gcp-sql',       icon: Database,  description: 'Managed databases' },
  { name: 'GCP Billing',   href: '/gcp-billing',   icon: DollarSign,description: 'Estimated spend' },
];

const azureItems = [
  { name: 'Virtual Machines', href: '/azure-vms',     icon: Server,    description: 'Azure VMs' },
  { name: 'Storage',          href: '/azure-storage',  icon: HardDrive, description: 'Storage accounts' },
  { name: 'SQL Databases',    href: '/azure-sql',      icon: Database,  description: 'Azure SQL DBs' },
  { name: 'Azure Billing',    href: '/azure-billing',  icon: DollarSign,description: 'Estimated spend' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

interface NavItem { name: string; href: string; icon: React.ElementType; description: string }

function NavLink({ item, pathname, onClose, activeClass }: {
  item: NavItem;
  pathname: string;
  onClose: () => void;
  activeClass: string;
}) {
  const isActive = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
        isActive ? `${activeClass} text-white` : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon size={18} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{item.name}</div>
        <div className={`text-xs truncate ${isActive ? 'opacity-80' : 'text-slate-500'}`}>{item.description}</div>
      </div>
      {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1.5">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        {children}
      </span>
    </div>
  );
}

// ── Quick stats (AWS) ─────────────────────────────────────────────────────

interface QuickStats { totalMonthlyCost: number; activeResources: { ec2: number; s3: number; rds: number } }

function useQuickStats(enabled: boolean) {
  const [stats, setStats] = useState<QuickStats | null>(null);
  useEffect(() => {
    if (!enabled) return;
    api.get<QuickStats>('/analytics/summary').then(setStats).catch(() => {});
  }, [enabled]);
  return stats;
}

// ── Main component ─────────────────────────────────────────────────────────

interface SidebarProps { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { isConnected: awsConnected, openConnectModal: openAWSModal } = useAWS();
  const { isConnected: doConnected, openConnectModal: openDOModal } = useDO();
  const { isConnected: gcpConnected, openConnectModal: openGCPModal } = useGCP();
  const { isConnected: azureConnected, openConnectModal: openAzureModal } = useAzure();
  const stats = useQuickStats(awsConnected);

  return (
    <>
      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`
        fixed top-14 left-0 bottom-0 w-64 bg-slate-900 border-r border-slate-700
        transform transition-transform duration-300 ease-in-out z-40
        lg:translate-x-0 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile close */}
        <div className="lg:hidden flex justify-end p-2">
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">

          {/* ── Universal ─────────────────────────────────────── */}
          <SectionLabel>Navigation</SectionLabel>
          {universalItems.map((item) => (
            <NavLink key={item.name} item={item} pathname={pathname} onClose={onClose} activeClass="bg-blue-600 shadow-lg shadow-blue-600/20" />
          ))}

          {/* ── AWS ───────────────────────────────────────────── */}
          <SectionLabel>
            <svg viewBox="0 0 40 24" className="w-4 h-3" fill="none">
              <path d="M11.5 0L0 6v12l11.5 6L23 18V6L11.5 0z" fill="#FF9900" opacity="0.9" />
            </svg>
            Amazon Web Services
          </SectionLabel>

          {awsConnected ? (
            awsItems.map((item) => (
              <NavLink key={item.name} item={item} pathname={pathname} onClose={onClose} activeClass="bg-orange-600/80 shadow-lg shadow-orange-600/20" />
            ))
          ) : (
            <button
              onClick={() => { onClose(); openAWSModal(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-orange-300 hover:bg-slate-800 transition-all duration-200 group"
            >
              <Plug size={16} className="flex-shrink-0 group-hover:text-orange-400" />
              <span className="text-sm">Connect AWS</span>
            </button>
          )}

          {/* ── DigitalOcean ───────────────────────────────────── */}
          <SectionLabel>
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="#0080FF">
              <path d="M12.003 0C5.375 0 0 5.375 0 12.003c0 6.625 5.375 12 12.003 12 6.625 0 12-5.375 12-12C24.003 5.375 18.628 0 12.003 0zm-.006 19.308v-3.24c3.408 0 5.963-3.24 4.66-6.82-.514-1.397-1.65-2.533-3.048-3.047-3.578-1.304-6.82 1.252-6.82 4.66H3.549C3.549 6.12 8.556 1.575 14.38 3.198c2.627.74 4.76 2.87 5.5 5.5 1.623 5.824-2.927 10.83-7.862 10.61z" />
            </svg>
            DigitalOcean
          </SectionLabel>

          {doConnected ? (
            doItems.map((item) => (
              <NavLink key={item.name} item={item} pathname={pathname} onClose={onClose} activeClass="bg-blue-500 shadow-lg shadow-blue-500/20" />
            ))
          ) : (
            <button
              onClick={() => { onClose(); openDOModal(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-blue-300 hover:bg-slate-800 transition-all duration-200 group"
            >
              <Plug size={16} className="flex-shrink-0 group-hover:text-blue-400" />
              <span className="text-sm">Connect DigitalOcean</span>
            </button>
          )}

          {/* ── Google Cloud Platform ──────────────────────────── */}
          <SectionLabel>
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none">
              <path d="M12.72 5.57l2.24-2.24.14-.94a9.94 9.94 0 0 0-8.01 1.6l1.66 1.66.81-.08a4.31 4.31 0 0 1 3.16 0z" fill="#EA4335"/>
              <path d="M19.43 8.09a9.98 9.98 0 0 0-3.01-3.46l-2.24 2.24a6.06 6.06 0 0 1 2.21 2.47l2.24-2.24.8.99z" fill="#4285F4"/>
              <path d="M12 17.93a5.9 5.9 0 0 1-3.57-1.2L6.2 18.97A9.96 9.96 0 0 0 12 21a9.96 9.96 0 0 0 5.8-1.86l-2.24-2.24A5.9 5.9 0 0 1 12 17.93z" fill="#34A853"/>
              <path d="M5.57 12.72A5.9 5.9 0 0 1 6.07 9.6L3.83 7.36A9.96 9.96 0 0 0 2 12c0 2.03.6 3.92 1.63 5.5l2.24-2.24a5.86 5.86 0 0 1-.3-2.54z" fill="#FBBC05"/>
            </svg>
            Google Cloud
          </SectionLabel>

          {gcpConnected ? (
            gcpItems.map((item) => (
              <NavLink key={item.name} item={item} pathname={pathname} onClose={onClose} activeClass="bg-red-500/80 shadow-lg shadow-red-500/20" />
            ))
          ) : (
            <button
              onClick={() => { onClose(); openGCPModal(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-slate-800 transition-all duration-200 group"
            >
              <Plug size={16} className="flex-shrink-0 group-hover:text-red-400" />
              <span className="text-sm">Connect GCP</span>
            </button>
          )}

          {/* ── Microsoft Azure ─────────────────────────────────── */}
          <SectionLabel>
            <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1" fill="#F25022"/>
              <rect x="13" y="1" width="10" height="10" rx="1" fill="#7FBA00"/>
              <rect x="1" y="13" width="10" height="10" rx="1" fill="#00A4EF"/>
              <rect x="13" y="13" width="10" height="10" rx="1" fill="#FFB900"/>
            </svg>
            Microsoft Azure
          </SectionLabel>

          {azureConnected ? (
            azureItems.map((item) => (
              <NavLink key={item.name} item={item} pathname={pathname} onClose={onClose} activeClass="bg-cyan-600/80 shadow-lg shadow-cyan-600/20" />
            ))
          ) : (
            <button
              onClick={() => { onClose(); openAzureModal(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-cyan-300 hover:bg-slate-800 transition-all duration-200 group"
            >
              <Plug size={16} className="flex-shrink-0 group-hover:text-cyan-400" />
              <span className="text-sm">Connect Azure</span>
            </button>
          )}
        </nav>

        {/* Quick stats footer */}
        <div className="p-4 border-t border-slate-700 flex-shrink-0">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Quick Stats</div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">AWS Resources</span>
                {awsConnected && stats ? (
                  <span className="text-white font-medium">
                    {stats.activeResources.ec2 + stats.activeResources.s3 + stats.activeResources.rds}
                  </span>
                ) : awsConnected ? (
                  <span className="w-8 h-3 bg-slate-700 rounded animate-pulse inline-block" />
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">This Month</span>
                {awsConnected && stats ? (
                  <span className="text-green-400 font-medium">${stats.totalMonthlyCost.toFixed(2)}</span>
                ) : awsConnected ? (
                  <span className="w-14 h-3 bg-slate-700 rounded animate-pulse inline-block" />
                ) : (
                  <span className="text-slate-600 text-xs">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
