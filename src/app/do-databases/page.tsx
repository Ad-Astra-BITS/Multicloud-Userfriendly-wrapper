'use client';

/**
 * DO Databases Page (/do-databases)
 *
 * Lists all DigitalOcean managed database clusters (equivalent to RDS).
 * Supports the 2-stage "stop" flow: dry-run config export → confirm destroy.
 */

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useDO } from '@/context/DOContext';
import { doDatabasesApi, DODatabase, DODatabaseStopResult } from '@/lib/doApi';
import {
  Database, RefreshCw, Server, MapPin, DollarSign, Layers,
  Loader2, WifiOff, Zap, AlertTriangle, Check, Info, StopCircle,
} from 'lucide-react';

// ── Status badge ────────────────────────────────────────────────────────────

const DB_STATUS: Record<string, string> = {
  online: 'bg-green-500/20 text-green-400',
  migrating: 'bg-blue-500/20 text-blue-400',
  forking: 'bg-purple-500/20 text-purple-400',
  resizing: 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-500/20 text-red-400',
  unknown: 'bg-slate-700 text-slate-400',
};

const ENGINE_LABELS: Record<string, string> = {
  pg: 'PostgreSQL', mysql: 'MySQL', redis: 'Redis',
  mongodb: 'MongoDB', kafka: 'Kafka', opensearch: 'OpenSearch',
};

// ── Stop Modal ──────────────────────────────────────────────────────────────

function StopModal({ db, onClose, onStopped }: {
  db: DODatabase;
  onClose: () => void;
  onStopped: (id: string) => void;
}) {
  const [stage, setStage] = useState<'info' | 'preview' | 'confirm' | 'done'>('info');
  const [preview, setPreview] = useState<DODatabaseStopResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await doDatabasesApi.stop(db.id, false);
      setPreview(res);
      setStage('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to preview');
    } finally {
      setLoading(false);
    }
  }

  async function handleDestroy() {
    setLoading(true);
    setError(null);
    try {
      await doDatabasesApi.stop(db.id, true);
      setStage('done');
      setTimeout(() => { onStopped(db.id); onClose(); }, 1800);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Destroy failed');
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Stop Database Cluster</h3>
              <p className="text-xs text-slate-400 font-mono">{db.name}</p>
            </div>
          </div>

          {/* Architectural note */}
          {stage === 'info' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-slate-300 flex items-start gap-2">
                <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-300 mb-1">DigitalOcean does not support pausing databases</p>
                  <p>Unlike AWS RDS, DO Managed Databases cannot be paused — the cluster must be
                  <strong className="text-white"> permanently destroyed</strong> to stop billing.
                  Automatic backups are retained per the cluster's backup policy and can be used to recreate the cluster.</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Step 1 will export the cluster configuration (engine, size, region, etc.) so you can recreate
                it later. Step 2 will permanently destroy it.
              </p>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">Cancel</button>
                <button onClick={handlePreview} disabled={loading} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Loading…</> : 'Export Config & Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Config preview */}
          {stage === 'preview' && preview && (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">Cluster configuration saved below. Copy it before proceeding.</p>
              <pre className="text-xs bg-slate-900 border border-slate-700 rounded-xl p-4 overflow-auto max-h-56 text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(preview.snapshot, null, 2)}
              </pre>
              <div className="flex gap-3">
                <button onClick={() => setStage('info')} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">Back</button>
                <button onClick={() => setStage('confirm')} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm transition-colors">
                  Proceed to Destroy
                </button>
              </div>
            </div>
          )}

          {/* Confirm destroy */}
          {stage === 'confirm' && (
            <div className="space-y-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                <strong>Final Warning:</strong> This will permanently destroy the cluster <span className="font-mono">{db.name}</span> and stop billing. This cannot be undone.
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStage('preview')} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm transition-colors">Back</button>
                <button onClick={handleDestroy} disabled={loading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 text-white rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={14} className="animate-spin" /> Destroying…</> : 'Confirm Destroy'}
                </button>
              </div>
            </div>
          )}

          {stage === 'done' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={28} className="text-green-400" />
              </div>
              <p className="text-green-400 font-semibold">Cluster destroyed. Billing stopped.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── DB Row ──────────────────────────────────────────────────────────────────

function DatabaseRow({ db, onStop }: { db: DODatabase; onStop: (db: DODatabase) => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Database size={16} className="text-purple-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{db.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${DB_STATUS[db.status] ?? DB_STATUS.unknown}`}>
              {db.status}
            </span>
            <span className="text-xs text-slate-400 font-medium">{ENGINE_LABELS[db.engine] ?? db.engine} {db.version}</span>
            <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={10} /> {db.region}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Server size={12} /> {db.numNodes} node{db.numNodes !== 1 ? 's' : ''}</span>
        <span className="flex items-center gap-1"><Layers size={12} /> {db.sizeSlug}</span>
        {db.monthlyCost > 0 && (
          <span className="flex items-center gap-1 text-amber-400 font-medium"><DollarSign size={12} />{db.monthlyCost}/mo</span>
        )}
      </div>
      {db.status === 'online' && (
        <button
          onClick={() => onStop(db)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 rounded-lg transition-colors flex-shrink-0"
        >
          <StopCircle size={12} /> Stop / Destroy
        </button>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function DatabasesPage() {
  const { isConnected, openConnectModal } = useDO();
  const [databases, setDatabases] = useState<DODatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<DODatabase | null>(null);

  const totalCost = databases.reduce((s, d) => s + d.monthlyCost, 0);

  const load = useCallback(() => {
    if (!isConnected) { setDatabases([]); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    doDatabasesApi.list()
      .then(setDatabases)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isConnected]);

  useEffect(() => { load(); }, [load]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">DO Databases</h1>
          <p className="text-slate-400 mt-1">DigitalOcean managed database clusters (equivalent to RDS)</p>
        </div>
        <button onClick={load} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm transition-colors disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <WifiOff size={40} className="text-slate-600 mb-4" />
          <p className="text-slate-500 text-sm mb-4">Connect your DigitalOcean account to view databases.</p>
          <button onClick={openConnectModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-colors">
            <Zap size={14} /> Connect DigitalOcean
          </button>
        </div>
      )}

      {isConnected && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Clusters', value: loading ? '…' : String(databases.length), color: 'text-purple-400' },
              { label: 'Online', value: loading ? '…' : String(databases.filter((d) => d.status === 'online').length), color: 'text-green-400' },
              { label: 'Monthly Cost', value: loading ? '…' : `$${totalCost.toFixed(0)}`, color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" /> Loading databases…
            </div>
          )}
          {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
          {!loading && !error && databases.length === 0 && (
            <div className="text-center py-16 text-slate-500">No managed database clusters found.</div>
          )}
          {!loading && !error && databases.length > 0 && (
            <div className="space-y-3">
              {databases.map((db) => (
                <DatabaseRow key={db.id} db={db} onStop={setStopping} />
              ))}
            </div>
          )}
        </>
      )}

      {stopping && (
        <StopModal
          db={stopping}
          onClose={() => setStopping(null)}
          onStopped={(id) => setDatabases((prev) => prev.filter((d) => d.id !== id))}
        />
      )}
    </DashboardLayout>
  );
}
