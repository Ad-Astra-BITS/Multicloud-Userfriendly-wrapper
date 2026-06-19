'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAzure } from '@/context/AzureContext';
import { azureSqlApi, AzureSqlDatabase } from '@/lib/azureApi';
import { Database, RefreshCw, MapPin, DollarSign, Loader2, WifiOff, HardDrive, Server } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = { Online: 'bg-green-500/20 text-green-400', Paused: 'bg-slate-700 text-slate-400', Creating: 'bg-blue-500/20 text-blue-400', Scaling: 'bg-amber-500/20 text-amber-400', Disabled: 'bg-red-500/20 text-red-400' };

export default function AzureSqlPage() {
  const { isConnected, openConnectModal } = useAzure();
  const [databases, setDatabases] = useState<AzureSqlDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDbs = useCallback(async () => { if (!isConnected) { setLoading(false); return; } setLoading(true); setError(null); try { setDatabases(await azureSqlApi.list()); } catch (e: unknown) { setError((e as Error).message); } finally { setLoading(false); } }, [isConnected]);
  useEffect(() => { fetchDbs(); }, [fetchDbs]);

  const totalCost = databases.reduce((s, d) => s + d.monthlyCost, 0);

  return (<DashboardLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Database className="text-cyan-400" size={24} /> Azure SQL Databases</h1><p className="text-sm text-slate-400 mt-1">View your Azure SQL databases across all servers</p></div><div className="flex items-center gap-3">{isConnected && databases.length > 0 && <div className="flex items-center gap-4 text-sm mr-4"><span className="text-slate-400">{databases.length} database{databases.length !== 1 ? 's' : ''}</span><span className="text-green-400 font-medium">${totalCost.toFixed(2)}/mo</span></div>}<button onClick={fetchDbs} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div></div>
    {!isConnected ? (<div className="text-center py-20"><WifiOff size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">Azure Not Connected</h2><p className="text-slate-400 text-sm mb-6">Connect to view SQL databases.</p><button onClick={openConnectModal} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium">Connect Azure</button></div>
    ) : loading ? (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-cyan-400" /></div>
    ) : error ? (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>
    ) : databases.length === 0 ? (<div className="text-center py-20"><Database size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">No SQL Databases</h2><p className="text-slate-400 text-sm">No SQL databases found.</p></div>
    ) : (<div className="space-y-3">{databases.map((db) => (<div key={db.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all"><div className="flex items-center gap-3 flex-1 min-w-0"><div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${db.status === 'Online' ? 'bg-green-500/20' : 'bg-slate-700/50'}`}><Database size={16} className={db.status === 'Online' ? 'text-green-400' : 'text-slate-400'} /></div><div className="min-w-0"><p className="text-sm font-medium text-white truncate">{db.name}</p><div className="flex items-center gap-2 mt-0.5"><span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLES[db.status] ?? 'bg-slate-700 text-slate-400'}`}>{db.status}</span><span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={10} /> {db.location}</span><span className="flex items-center gap-1 text-xs text-slate-500"><Server size={10} /> {db.serverName}</span></div></div></div><div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-400"><span className="font-mono">{db.sku}</span><span className="flex items-center gap-1"><HardDrive size={12} /> {db.maxSizeGb}GB</span><span className="flex items-center gap-1 text-green-400 font-medium"><DollarSign size={12} />{db.monthlyCost.toFixed(2)}/mo</span></div></div>))}</div>)}
  </div></DashboardLayout>);
}
