'use client';

/**
 * DO Droplets Page (/do-droplets)
 *
 * Lists all DigitalOcean Droplets (equivalent to EC2 Instances).
 * Shows status, region, specs, cost, and live CPU/memory via the Monitoring API.
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useDO } from '@/context/DOContext';
import { doDropletsApi, DODroplet, DODropletMetrics } from '@/lib/doApi';
import {
  Server, RefreshCw, Cpu, MemoryStick, HardDrive, DollarSign,
  MapPin, Tag, Activity, Loader2, WifiOff, Zap, Trash2, AlertTriangle, X,
} from 'lucide-react';

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  off: 'bg-slate-700 text-slate-400',
  archive: 'bg-amber-500/20 text-amber-400',
};

// ── Delete Modal ──────────────────────────────────────────────────────────

function DeleteDropletModal({ droplet, onClose, onDeleted }: {
  droplet: DODroplet;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isConfirmed = confirmation === droplet.name;

  async function handleDelete() {
    if (!isConfirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await doDropletsApi.terminate([droplet.id]);
      setDone(true);
    } catch (e: unknown) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={done ? onDeleted : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          {done ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                <Server size={22} className="text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Droplet Deleted</h3>
              <p className="text-sm text-slate-400 mb-4">
                <span className="font-mono text-white">{droplet.name}</span> has been permanently deleted.
              </p>
              <button onClick={onDeleted} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Delete Droplet</h3>
                    <p className="text-xs text-slate-400">This action is permanent and cannot be undone</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50 mb-4 space-y-1">
                <p className="text-sm font-medium text-white">{droplet.name}</p>
                <p className="text-xs text-slate-400">{droplet.vcpus} vCPU · {droplet.memory >= 1024 ? `${droplet.memory / 1024}GB` : `${droplet.memory}MB`} RAM · {droplet.disk}GB disk · {droplet.region}</p>
              </div>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                <p className="text-xs text-red-300">
                  Deleting this Droplet will permanently destroy the VM and all associated storage. Any data not backed up will be lost.
                </p>
              </div>

              <label className="block text-xs text-slate-400 mb-1.5">
                Type <span className="font-mono text-white">{droplet.name}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={droplet.name}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 mb-4"
              />

              {error && (
                <p className="text-red-400 text-xs mb-3">{error}</p>
              )}

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!isConfirmed || deleting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {deleting ? 'Deleting…' : 'Delete Droplet'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Droplet Row ────────────────────────────────────────────────────────────

function DropletRow({ droplet, onMetrics, onDelete }: {
  droplet: DODroplet;
  onMetrics: (id: number) => void;
  onDelete: (droplet: DODroplet) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
      {/* Status + Name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${droplet.status === 'active' ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
          <Server size={16} className={droplet.status === 'active' ? 'text-green-400' : 'text-slate-400'} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{droplet.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLES[droplet.status] ?? 'bg-slate-700 text-slate-400'}`}>
              {droplet.status}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={10} /> {droplet.region}
            </span>
            {droplet.ip_address && (
              <span className="text-xs font-mono text-slate-500">{droplet.ip_address}</span>
            )}
          </div>
        </div>
      </div>

      {/* Specs */}
      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Cpu size={12} /> {droplet.vcpus} vCPU</span>
        <span className="flex items-center gap-1"><MemoryStick size={12} /> {droplet.memory >= 1024 ? `${droplet.memory / 1024}GB` : `${droplet.memory}MB`} RAM</span>
        <span className="flex items-center gap-1"><HardDrive size={12} /> {droplet.disk}GB</span>
        <span className="flex items-center gap-1 text-green-400 font-medium">
          <DollarSign size={12} />{droplet.price_monthly}/mo
        </span>
      </div>

      {/* Tags */}
      {droplet.tags && droplet.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tag size={11} className="text-slate-500" />
          {droplet.tags.slice(0, 2).map((t) => (
            <span key={t} className="text-xs bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-400">{t}</span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {droplet.status === 'active' && (
          <button
            onClick={() => onMetrics(droplet.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-lg transition-colors"
          >
            <Activity size={12} /> Live Metrics
          </button>
        )}
        <button
          onClick={() => onDelete(droplet)}
          title="Delete Droplet"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Metrics Modal ──────────────────────────────────────────────────────────

function MetricsModal({ dropletId, onClose }: { dropletId: number; onClose: () => void }) {
  const [metrics, setMetrics] = useState<DODropletMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    doDropletsApi.metrics(dropletId)
      .then(setMetrics)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dropletId]);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-white mb-1">Live Metrics</h3>
          <p className="text-xs text-slate-400 mb-5">Droplet #{dropletId} · Last 60 minutes average</p>
          {loading && <div className="flex justify-center py-8"><Loader2 size={28} className="animate-spin text-blue-400" /></div>}
          {error && <p className="text-red-400 text-sm text-center py-4">{error}</p>}
          {metrics && (
            <div className="space-y-4">
              {[
                { label: 'CPU Utilisation', value: metrics.cpuPercent, color: metrics.cpuPercent > 80 ? 'bg-red-500' : metrics.cpuPercent > 50 ? 'bg-amber-500' : 'bg-green-500' },
                { label: 'Memory Utilisation', value: metrics.memoryPercent, color: metrics.memoryPercent > 90 ? 'bg-red-500' : metrics.memoryPercent > 70 ? 'bg-amber-500' : 'bg-blue-500' },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{m.label}</span>
                    <span className="font-mono text-white font-semibold">{m.value.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${m.color}`} style={{ width: `${Math.min(m.value, 100)}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500 text-center mt-2">
                Updated {new Date(metrics.timestamp).toLocaleTimeString()}
              </p>
              <p className="text-xs text-slate-600 text-center">
                Requires DO Monitoring Agent (do-agent) installed on Droplet
              </p>
            </div>
          )}
          <button onClick={onClose} className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">Close</button>
        </div>
      </div>
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function DropletsPage() {
  const { isConnected, openConnectModal } = useDO();
  const [droplets, setDroplets] = useState<DODroplet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metricsDropletId, setMetricsDropletId] = useState<number | null>(null);
  const [deletingDroplet, setDeletingDroplet] = useState<DODroplet | null>(null);

  const totalCost = droplets.reduce((s, d) => s + d.price_monthly, 0);
  const activeCount = droplets.filter((d) => d.status === 'active').length;

  const load = useCallback(() => {
    if (!isConnected) { setDroplets([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    doDropletsApi.list()
      .then(setDroplets)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isConnected]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#0080FF">
                <path d="M12.003 0C5.375 0 0 5.375 0 12.003c0 6.625 5.375 12 12.003 12 6.625 0 12-5.375 12-12C24.003 5.375 18.628 0 12.003 0zm-.006 19.308v-3.24c3.408 0 5.963-3.24 4.66-6.82-.514-1.397-1.65-2.533-3.048-3.047-3.578-1.304-6.82 1.252-6.82 4.66H3.549C3.549 6.12 8.556 1.575 14.38 3.198c2.627.74 4.76 2.87 5.5 5.5 1.623 5.824-2.927 10.83-7.862 10.61z" />
                <path d="M12 15.88v3.237H8.764V15.88H12zM8.764 18.244H6.39v-2.375h2.375v2.375zM6.39 15.87H4.41v-1.98h1.98v1.98z" />
              </svg>
            </div>
            DO Droplets
          </h1>
          <p className="text-slate-400 mt-1">DigitalOcean virtual machines (equivalent to EC2)</p>
        </div>
        <button onClick={load} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Not connected */}
      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <WifiOff size={40} className="text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-400 mb-2">No DigitalOcean Account Connected</h2>
          <p className="text-slate-500 text-sm mb-4">Connect your DO account to view Droplets.</p>
          <button onClick={openConnectModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-colors">
            <Zap size={14} /> Connect DigitalOcean
          </button>
        </div>
      )}

      {isConnected && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Droplets', value: loading ? '…' : String(droplets.length), color: 'text-blue-400' },
              { label: 'Active', value: loading ? '…' : String(activeCount), color: 'text-green-400' },
              { label: 'Off / Archived', value: loading ? '…' : String(droplets.length - activeCount), color: 'text-slate-400' },
              { label: 'Monthly Cost', value: loading ? '…' : `$${totalCost.toFixed(2)}`, color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Droplet list */}
          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" /> Loading Droplets…
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && droplets.length === 0 && (
            <div className="text-center py-16 text-slate-500">No Droplets found in this account.</div>
          )}
          {!loading && !error && droplets.length > 0 && (
            <div className="space-y-3">
              {droplets.map((d) => (
                <DropletRow key={d.id} droplet={d} onMetrics={setMetricsDropletId} onDelete={setDeletingDroplet} />
              ))}
            </div>
          )}
        </>
      )}

      {metricsDropletId !== null && (
        <MetricsModal dropletId={metricsDropletId} onClose={() => setMetricsDropletId(null)} />
      )}
      {deletingDroplet !== null && (
        <DeleteDropletModal
          droplet={deletingDroplet}
          onClose={() => setDeletingDroplet(null)}
          onDeleted={() => { setDeletingDroplet(null); load(); }}
        />
      )}
    </DashboardLayout>
  );
}
