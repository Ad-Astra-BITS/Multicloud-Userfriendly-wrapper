'use client';

/**
 * GCP Storage Page (/gcp-storage)
 *
 * Lists all Google Cloud Storage buckets in the project.
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useGCP } from '@/context/GCPContext';
import { gcpBucketsApi, GCPBucket } from '@/lib/gcpApi';
import {
  HardDrive, RefreshCw, MapPin, Loader2, WifiOff, Trash2, AlertTriangle, X,
} from 'lucide-react';

// ── Delete Modal ──────────────────────────────────────────────────────────

function DeleteBucketModal({ bucket, onClose, onDeleted }: {
  bucket: GCPBucket;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isConfirmed = confirmation === bucket.name;

  async function handleDelete() {
    if (!isConfirmed) return;
    setDeleting(true);
    setError(null);
    try {
      await gcpBucketsApi.delete(bucket.name);
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
                <HardDrive size={22} className="text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Bucket Deleted</h3>
              <p className="text-sm text-slate-400 mb-4">
                <span className="font-mono text-white">{bucket.name}</span> has been emptied and deleted.
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
                    <h3 className="text-lg font-semibold text-white">Delete Bucket</h3>
                    <p className="text-xs text-slate-400">All objects will be deleted permanently</p>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50 mb-4 space-y-1">
                <p className="text-sm font-medium text-white font-mono">{bucket.name}</p>
                <p className="text-xs text-slate-400">{bucket.location} · {bucket.storageClass}</p>
              </div>

              <label className="block text-xs text-slate-400 mb-1.5">
                Type <span className="font-mono text-white">{bucket.name}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={bucket.name}
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
                  {deleting ? 'Deleting…' : 'Delete Bucket'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function GCPStoragePage() {
  const { isConnected, openConnectModal } = useGCP();
  const [buckets, setBuckets] = useState<GCPBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GCPBucket | null>(null);

  const fetchBuckets = useCallback(async () => {
    if (!isConnected) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await gcpBucketsApi.list();
      setBuckets(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => { fetchBuckets(); }, [fetchBuckets]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <HardDrive className="text-yellow-400" size={24} />
              Cloud Storage Buckets
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage your Google Cloud Storage buckets
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <span className="text-sm text-slate-400 mr-4">{buckets.length} bucket{buckets.length !== 1 ? 's' : ''}</span>
            )}
            <button
              onClick={fetchBuckets}
              disabled={loading || !isConnected}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {!isConnected ? (
          <div className="text-center py-20">
            <WifiOff size={48} className="text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">GCP Not Connected</h2>
            <p className="text-slate-400 text-sm mb-6">Connect your Google Cloud project to view storage buckets.</p>
            <button onClick={openConnectModal} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors">
              Connect GCP
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-yellow-400" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : buckets.length === 0 ? (
          <div className="text-center py-20">
            <HardDrive size={48} className="text-slate-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">No Buckets Found</h2>
            <p className="text-slate-400 text-sm">Your GCP project has no Cloud Storage buckets.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {buckets.map((bucket) => (
              <div
                key={bucket.name}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <HardDrive size={16} className="text-yellow-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white font-mono truncate">{bucket.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <MapPin size={10} /> {bucket.location}
                      </span>
                      <span className="text-xs bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-400">
                        {bucket.storageClass}
                      </span>
                      {bucket.createdAt && (
                        <span className="text-xs text-slate-500">
                          Created {new Date(bucket.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(bucket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors flex-shrink-0"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {deleteTarget && (
          <DeleteBucketModal
            bucket={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={() => { setDeleteTarget(null); fetchBuckets(); }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
