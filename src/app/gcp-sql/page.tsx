'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useGCP } from '@/context/GCPContext';
import { gcpSqlApi, GCPSqlInstance } from '@/lib/gcpApi';
import { Database, RefreshCw, MapPin, DollarSign, Loader2, WifiOff, HardDrive } from 'lucide-react';

const STATE_STYLES: Record<string, string> = { RUNNABLE: 'bg-green-500/20 text-green-400', STOPPED: 'bg-slate-700 text-slate-400', PENDING_CREATE: 'bg-blue-500/20 text-blue-400', MAINTENANCE: 'bg-amber-500/20 text-amber-400', FAILED: 'bg-red-500/20 text-red-400' };

export default function GCPSqlPage() {
  const { isConnected, openConnectModal } = useGCP();
  const [instances, setInstances] = useState<GCPSqlInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => { if (!isConnected) { setLoading(false); return; } setLoading(true); setError(null); try { setInstances(await gcpSqlApi.list()); } catch (e: unknown) { setError((e as Error).message); } finally { setLoading(false); } }, [isConnected]);
  useEffect(() => { fetch(); }, [fetch]);

  const totalCost = instances.reduce((s, i) => s + i.monthlyCost, 0);

  return (<DashboardLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="text-blue-400" size={24} /> Cloud SQL Instances</h1><p className="text-sm text-slate-400 mt-1">View your GCP Cloud SQL databases</p></div><div className="flex items-center gap-3">{isConnected && instances.length > 0 && <div className="flex items-center gap-4 text-sm mr-4"><span className="text-slate-400">{instances.length} instance{instances.length !== 1 ? 's' : ''}</span><span className="text-green-400 font-medium">${totalCost.toFixed(2)}/mo</span></div>}<button onClick={fetch} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div></div>
    {!isConnected ? (<div className="text-center py-20"><WifiOff size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">GCP Not Connected</h2><p className="text-slate-400 text-sm mb-6">Connect to view Cloud SQL instances.</p><button onClick={openConnectModal} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium">Connect GCP</button></div>
    ) : loading ? (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-blue-400" /></div>
    ) : error ? (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>
    ) : instances.length === 0 ? (<div className="text-center py-20"><Database size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">No Cloud SQL Instances</h2><p className="text-slate-400 text-sm">No Cloud SQL instances found.</p></div>
    ) : (<div className="space-y-3">{instances.map((inst) => (<div key={inst.name} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all"><div className="flex items-center gap-3 flex-1 min-w-0"><div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${inst.state === 'RUNNABLE' ? 'bg-green-500/20' : 'bg-slate-700/50'}`}><Database size={16} className={inst.state === 'RUNNABLE' ? 'text-green-400' : 'text-slate-400'} /></div><div className="min-w-0"><p className="text-sm font-medium text-white truncate">{inst.name}</p><div className="flex items-center gap-2 mt-0.5"><span className={`text-xs px-1.5 py-0.5 rounded-full ${STATE_STYLES[inst.state] ?? 'bg-slate-700 text-slate-400'}`}>{inst.state}</span><span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={10} /> {inst.region}</span><span className="text-xs text-slate-500 font-mono">{inst.databaseVersion}</span></div></div></div><div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-400"><span className="font-mono">{inst.tier}</span><span className="flex items-center gap-1"><HardDrive size={12} /> {inst.dataDiskSizeGb}GB</span><span className="flex items-center gap-1 text-green-400 font-medium"><DollarSign size={12} />{inst.monthlyCost.toFixed(2)}/mo</span></div></div>))}</div>)}
  </div></DashboardLayout>);
}
