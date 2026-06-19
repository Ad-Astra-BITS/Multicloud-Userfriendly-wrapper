'use client';

/**
 * GCP Instances Page (/gcp-instances)
 *
 * Lists all Google Cloud Compute Engine VM instances.
 * Shows status, zone, specs, cost, and actions (stop/start/delete).
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useGCP } from '@/context/GCPContext';
import { gcpInstancesApi, GCPInstance } from '@/lib/gcpApi';
import {
  Server, RefreshCw, Cpu, MemoryStick, HardDrive, DollarSign,
  MapPin, Tag, Loader2, WifiOff, Trash2, AlertTriangle, X, Play, Square,
} from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  RUNNING: 'bg-green-500/20 text-green-400',
  STOPPED: 'bg-slate-700 text-slate-400',
  TERMINATED: 'bg-red-500/20 text-red-400',
  PROVISIONING: 'bg-blue-500/20 text-blue-400',
  STAGING: 'bg-yellow-500/20 text-yellow-400',
  SUSPENDED: 'bg-amber-500/20 text-amber-400',
  SUSPENDING: 'bg-amber-500/20 text-amber-400',
  REPAIRING: 'bg-orange-500/20 text-orange-400',
};

// ── Delete Modal ──────────────────────────────────────────────────────────

function DeleteInstanceModal({ instance, onClose, onDeleted }: {
  instance: GCPInstance;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isConfirmed = confirmation === instance.name;

  async function handleDelete() {
    if (!isConfirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await gcpInstancesApi.delete([{ zone: instance.zone, name: instance.name }]);
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
              <h3 className="text-lg font-semibold text-white mb-1">Instance Deleted</h3>
              <p className="text-sm text-slate-400 mb-4">
                <span className="font-mono text-white">{instance.name}</span> has been permanently deleted.
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
                    <h3 className="text-lg font-semibold text-white">Delete Instance</h3>
                    <p className="text-xs text-slate-400">This action is permanent and cannot be undone</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50 mb-4 space-y-1">
                <p className="text-sm font-medium text-white">{instance.name}</p>
                <p className="text-xs text-slate-400">{instance.machineType} · {instance.vcpus} vCPU · {instance.memory >= 1024 ? `${(instance.memory / 1024).toFixed(1)}GB` : `${instance.memory}MB`} RAM · {instance.zone}</p>
              </div>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                <p className="text-xs text-red-300">
                  Deleting this instance will permanently destroy the VM and all associated boot disks. Any data not backed up will be lost.
                </p>
              </div>

              <label className="block text-xs text-slate-400 mb-1.5">
                Type <span className="font-mono text-white">{instance.name}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={instance.name}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 mb-4"
              />

              {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

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
                  {deleting ? 'Deleting…' : 'Delete Instance'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Instance Row ──────────────────────────────────────────────────────────

function InstanceRow({ instance, onDelete, onToggle, toggling }: {
  instance: GCPInstance;
  onDelete: (inst: GCPInstance) => void;
  onToggle: (inst: GCPInstance) => void;
  toggling: string | null;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${instance.status === 'RUNNING' ? 'bg-green-500/20' : 'bg-slate-700/50'}`}>
          <Server size={16} className={instance.status === 'RUNNING' ? 'text-green-400' : 'text-slate-400'} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{instance.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLES[instance.status] ?? 'bg-slate-700 text-slate-400'}`}>
              {instance.status}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={10} /> {instance.zone}
            </span>
            <span className="text-xs text-slate-500 font-mono">{instance.machineType}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Cpu size={12} /> {instance.vcpus} vCPU</span>
        <span className="flex items-center gap-1"><MemoryStick size={12} /> {instance.memory >= 1024 ? `${(instance.memory / 1024).toFixed(1)}GB` : `${instance.memory}MB`} RAM</span>
        <span className="flex items-center gap-1"><HardDrive size={12} /> {instance.diskSizeGb}GB</span>
        <span className="flex items-center gap-1 text-green-400 font-medium">
          <DollarSign size={12} />{instance.price_monthly.toFixed(2)}/mo
        </span>
      </div>

      {instance.labels && Object.keys(instance.labels).length > 0 && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tag size={11} className="text-slate-500" />
          {Object.entries(instance.labels).slice(0, 2).map(([k, v]) => (
            <span key={k} className="text-xs bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-400">{k}={v}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-shrink-0">
        {(instance.status === 'RUNNING' || instance.status === 'STOPPED') && (
          <button
            onClick={() => onToggle(instance)}
            disabled={toggling === instance.name}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              instance.status === 'RUNNING'
                ? 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400'
                : 'bg-green-600/20 hover:bg-green-600/40 text-green-400'
            } disabled:opacity-40`}
          >
            {toggling === instance.name ? (
              <Loader2 size={12} className="animate-spin" />
            ) : instance.status === 'RUNNING' ? (
              <Square size={12} />
            ) : (
              <Play size={12} />
            )}
            {instance.status === 'RUNNING' ? 'Stop' : 'Start'}
          </button>
        )}
        <button
          onClick={() => onDelete(instance)}
          title="Delete Instance"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function GCPInstancesPage() {
  const { isConnected, openConnectModal } = useGCP();
  const [instances, setInstances] = useState<GCPInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GCPInstance | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchInstances = useCallback(async () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await gcpInstancesApi.list();
      setInstances(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  async function handleToggle(instance: GCPInstance) {
    setToggling(instance.name);
    try {
      if (instance.status === 'RUNNING') {
        await gcpInstancesApi.stop(instance.zone, instance.name);
      } else {
        await gcpInstancesApi.start(instance.zone, instance.name);
      }
      await fetchInstances();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setToggling(null);
    }
  }

  const running = instances.filter((i) => i.status === 'RUNNING').length;
  const totalCost = instances
    .filter((i) => i.status === 'RUNNING')
    .reduce((sum, i) => sum + i.price_monthly, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Server className="text-red-400" size={24} />
              Compute Engine Instances
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage your Google Cloud Compute Engine virtual machines
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <div className="flex items-center gap-4 text-sm mr-4">
                <span className="text-slate-400">{running} running</span>
                <span className="text-green-400 font-medium">${totalCost.toFixed(2)}/mo</span>
              </div>
            )}
            <button
              onClick={fetchInstances}
              disabled={loading || !isConnected}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        {!isConnected ? (
          <div className="text-center py-20">
            <WifiOff size={48} className="text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">GCP Not Connected</h2>
            <p className="text-slate-400 text-sm mb-6">Connect your Google Cloud project to view Compute Engine instances.</p>
            <button onClick={openConnectModal} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors">
              Connect GCP
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-red-400" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-20">
            <Server size={48} className="text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No Instances Found</h2>
            <p className="text-slate-400 text-sm">Your GCP project has no Compute Engine instances.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => (
              <InstanceRow
                key={instance.id}
                instance={instance}
                onDelete={setDeleteTarget}
                onToggle={handleToggle}
                toggling={toggling}
              />
            ))}
          </div>
        )}

        {deleteTarget && (
          <DeleteInstanceModal
            instance={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => { setDeleteTarget(null); fetchInstances(); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
