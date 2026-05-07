'use client';

/**
 * DO Spaces Page (/do-spaces)
 *
 * Lists all DigitalOcean Spaces buckets (equivalent to S3).
 * Supports applying lifecycle expiry rules and deleting Spaces.
 * Requires Spaces key + secret (shown in a notice when absent).
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useDO } from '@/context/DOContext';
import { doSpacesApi, DOSpace } from '@/lib/doApi';
import {
  HardDrive, RefreshCw, MapPin, Calendar, Trash2,
  Clock, Loader2, WifiOff, Zap, AlertTriangle, Check, X, Info,
} from 'lucide-react';

// ── Optimize Modal ──────────────────────────────────────────────────────────

function OptimizeModal({ space, onClose, onDone }: {
  space: DOSpace;
  onClose: () => void;
  onDone: () => void;
}) {
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleApply() {
    setLoading(true);
    setError(null);
    try {
      await doSpacesApi.optimize(space.region, space.name, days);
      setSuccess(true);
      setTimeout(() => { onDone(); onClose(); }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to apply lifecycle rule');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-white mb-1">Optimise Space</h3>
          <p className="text-xs text-slate-400 mb-4 font-mono">{space.name} · {space.region}</p>

          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4 text-xs text-slate-300">
            <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              DO Spaces has no cold-storage tiers (no Glacier equivalent). Instead, we apply an
              <strong className="text-white"> object expiry lifecycle rule</strong> — objects older than the
              specified number of days are automatically deleted to reduce storage costs.
            </span>
          </div>

          <div className="mb-5">
            <label className="block text-sm text-slate-300 mb-1.5">
              Expire objects after <span className="font-semibold text-white">{days}</span> days
            </label>
            <input
              type="range"
              min={7}
              max={365}
              step={7}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>7 days</span><span>1 year</span>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          {success && <p className="text-green-400 text-sm mb-3 flex items-center gap-1"><Check size={14} /> Rule applied!</p>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">Cancel</button>
            <button
              onClick={handleApply}
              disabled={loading || success}
              className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Applying…</> : 'Apply Rule'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Delete Modal ────────────────────────────────────────────────────────────

function DeleteModal({ space, onClose, onDeleted }: {
  space: DOSpace;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      await doSpacesApi.delete(space.region, space.name);
      onDeleted();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete Space');
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Delete Space</h3>
              <p className="text-xs text-slate-400">This is irreversible</p>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            All objects in <span className="font-mono text-white">{space.name}</span> will be permanently deleted, then the Space will be destroyed.
          </p>
          <div className="mb-4">
            <label className="block text-xs text-slate-400 mb-1">
              Type <span className="font-mono text-red-400">{space.name}</span> to confirm
            </label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-red-500"
            />
          </div>
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">Cancel</button>
            <button
              onClick={handleDelete}
              disabled={confirm !== space.name || loading}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : <><Trash2 size={14} /> Delete</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Space Row ───────────────────────────────────────────────────────────────

function SpaceRow({ space, onOptimize, onDelete }: {
  space: DOSpace;
  onOptimize: (s: DOSpace) => void;
  onDelete: (s: DOSpace) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
          <HardDrive size={16} className="text-teal-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white font-mono truncate">{space.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={10} /> {space.region}
            </span>
            {space.creationDate && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Calendar size={10} /> {new Date(space.creationDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onOptimize(space)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 rounded-lg transition-colors"
        >
          <Clock size={12} /> Lifecycle Rule
        </button>
        <button
          onClick={() => onDelete(space)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function SpacesPage() {
  const { isConnected, credentials, openConnectModal } = useDO();
  const [spaces, setSpaces] = useState<DOSpace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState<DOSpace | null>(null);
  const [deleting, setDeleting] = useState<DOSpace | null>(null);

  const hasSpacesKeys = !!credentials?.spacesKey;

  const load = useCallback(() => {
    if (!isConnected) { setSpaces([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    doSpacesApi.list()
      .then(setSpaces)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isConnected]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">DO Spaces</h1>
          <p className="text-slate-400 mt-1">DigitalOcean object storage (equivalent to S3)</p>
        </div>
        <button onClick={load} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <WifiOff size={40} className="text-slate-600 mb-4" />
          <p className="text-slate-500 text-sm mb-4">Connect your DigitalOcean account to view Spaces.</p>
          <button onClick={openConnectModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-colors">
            <Zap size={14} /> Connect DigitalOcean
          </button>
        </div>
      )}

      {isConnected && !hasSpacesKeys && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-300 font-medium">Spaces credentials not configured</p>
            <p className="text-slate-400 mt-0.5">
              Spaces operations require a separate access key + secret from the DO control panel
              (not the PAT). Reconnect your account and provide the Spaces credentials to enable this feature.
            </p>
          </div>
        </div>
      )}

      {isConnected && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Total Spaces</p>
              <p className="text-2xl font-bold text-teal-400 mt-1">{loading ? '…' : spaces.length}</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <p className="text-xs text-slate-500">Regions Active</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">
                {loading ? '…' : new Set(spaces.map((s) => s.region)).size}
              </p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" /> Loading Spaces…
            </div>
          )}
          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
          {!loading && !error && spaces.length === 0 && hasSpacesKeys && (
            <div className="text-center py-16 text-slate-500">No Spaces found.</div>
          )}
          {!loading && !error && spaces.length > 0 && (
            <div className="space-y-3">
              {spaces.map((s) => (
                <SpaceRow
                  key={`${s.region}:${s.name}`}
                  space={s}
                  onOptimize={setOptimizing}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </>
      )}

      {optimizing && (
        <OptimizeModal
          space={optimizing}
          onClose={() => setOptimizing(null)}
          onDone={load}
        />
      )}
      {deleting && (
        <DeleteModal
          space={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => setSpaces((prev) => prev.filter((s) => s.name !== deleting.name))}
        />
      )}
    </DashboardLayout>
  );
}
