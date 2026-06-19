'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useGCP } from '@/context/GCPContext';
import { gcpBillingApi, GCPBillingInfo } from '@/lib/gcpApi';
import { DollarSign, RefreshCw, Loader2, WifiOff, TrendingUp, Calendar } from 'lucide-react';

export default function GCPBillingPage() {
  const { isConnected, openConnectModal } = useGCP();
  const [billing, setBilling] = useState<GCPBillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => { if (!isConnected) { setLoading(false); return; } setLoading(true); setError(null); try { setBilling(await gcpBillingApi.estimate()); } catch (e: unknown) { setError((e as Error).message); } finally { setLoading(false); } }, [isConnected]);
  useEffect(() => { fetch(); }, [fetch]);

  return (<DashboardLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><DollarSign className="text-green-400" size={24} /> GCP Billing Estimate</h1><p className="text-sm text-slate-400 mt-1">Estimated spend based on running resources</p></div><button onClick={fetch} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
    {!isConnected ? (<div className="text-center py-20"><WifiOff size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">GCP Not Connected</h2><p className="text-slate-400 text-sm mb-6">Connect to view billing estimates.</p><button onClick={openConnectModal} className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium">Connect GCP</button></div>
    ) : loading ? (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-green-400" /></div>
    ) : error ? (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>
    ) : billing ? (<div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-700/30"><div className="flex items-center gap-2 text-sm text-slate-400 mb-2"><TrendingUp size={14} className="text-green-400" /> Month-to-Date</div><p className="text-3xl font-bold text-white">${billing.monthToDate.toFixed(2)}</p><p className="text-xs text-slate-500 mt-1">Based on running resources</p></div>
        <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-700/30"><div className="flex items-center gap-2 text-sm text-slate-400 mb-2"><Calendar size={14} className="text-blue-400" /> Projected Monthly</div><p className="text-3xl font-bold text-white">${(() => { const d = new Date().getDate(); const m = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(); return ((billing.monthToDate / d) * m).toFixed(2); })()}</p><p className="text-xs text-slate-500 mt-1">Based on current rate</p></div>
      </div>
      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl"><p className="text-xs text-amber-300"><strong>Note:</strong> Estimates from running resource costs. For precise billing, integrate the Cloud Billing API.</p></div>
    </div>) : null}
  </div></DashboardLayout>);
}
