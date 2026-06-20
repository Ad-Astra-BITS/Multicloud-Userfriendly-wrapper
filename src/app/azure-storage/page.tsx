'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAzure } from '@/context/AzureContext';
import { azureStorageApi, AzureStorageAccount } from '@/lib/azureApi';
import { HardDrive, RefreshCw, MapPin, Loader2, WifiOff, Trash2, AlertTriangle, X } from 'lucide-react';

function DeleteStorageModal({ account, onClose, onDeleted }: { account: AzureStorageAccount; onClose: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function handleDelete() { if (confirmation !== account.name) return; setDeleting(true); setError(null); try { await azureStorageApi.delete(account.resourceGroup, account.name); setDone(true); } catch (e: unknown) { setError((e as Error).message); setDeleting(false); } }

  return (<><div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={done ? onDeleted : onClose} /><div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
    {done ? (<div className="text-center py-4"><div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3"><HardDrive size={22} className="text-green-400" /></div><h3 className="text-lg font-semibold text-white mb-1">Storage Account Deleted</h3><p className="text-sm text-slate-400 mb-4"><span className="font-mono text-white">{account.name}</span> deleted.</p><button onClick={onDeleted} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm">Close</button></div>) : (<>
      <div className="flex items-start justify-between mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><AlertTriangle size={18} className="text-red-400" /></div><div><h3 className="text-lg font-semibold text-white">Delete Storage Account</h3><p className="text-xs text-slate-400">All data will be permanently lost</p></div></div><button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button></div>
      <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50 mb-4"><p className="text-sm font-medium text-white font-mono">{account.name}</p><p className="text-xs text-slate-400">{account.location} · {account.kind} · {account.skuName}</p></div>
      <label className="block text-xs text-slate-400 mb-1.5">Type <span className="font-mono text-white">{account.name}</span> to confirm</label>
      <input type="text" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={account.name} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 mb-4" />
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm">Cancel</button><button onClick={handleDelete} disabled={confirmation !== account.name || deleting} className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">{deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{deleting ? 'Deleting…' : 'Delete'}</button></div>
    </>)}
  </div></div></>);
}

export default function AzureStoragePage() {
  const { isConnected, openConnectModal } = useAzure();
  const [accounts, setAccounts] = useState<AzureStorageAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AzureStorageAccount | null>(null);

  const fetchAccounts = useCallback(async () => { if (!isConnected) { setLoading(false); return; } setLoading(true); setError(null); try { setAccounts(await azureStorageApi.list()); } catch (e: unknown) { setError((e as Error).message); } finally { setLoading(false); } }, [isConnected]);
  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  return (<DashboardLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"><div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><HardDrive className="text-cyan-400" size={24} /> Azure Storage Accounts</h1><p className="text-sm text-slate-400 mt-1">Manage your Azure Storage Accounts</p></div><div className="flex items-center gap-3">{isConnected && <span className="text-sm text-slate-400 mr-4">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>}<button onClick={fetchAccounts} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div></div>
    {!isConnected ? (<div className="text-center py-20"><WifiOff size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">Azure Not Connected</h2><p className="text-slate-400 text-sm mb-6">Connect your Azure subscription to view storage accounts.</p><button onClick={openConnectModal} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium">Connect Azure</button></div>
    ) : loading ? (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-cyan-400" /></div>
    ) : error ? (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>
    ) : accounts.length === 0 ? (<div className="text-center py-20"><HardDrive size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">No Storage Accounts</h2><p className="text-slate-400 text-sm">No storage accounts found.</p></div>
    ) : (<div className="space-y-3">{accounts.map((a) => (<div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all"><div className="flex items-center gap-3 flex-1 min-w-0"><div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0"><HardDrive size={16} className="text-cyan-400" /></div><div className="min-w-0"><p className="text-sm font-medium text-white font-mono truncate">{a.name}</p><div className="flex items-center gap-2 mt-0.5"><span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={10} /> {a.location}</span><span className="text-xs bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-400">{a.kind}</span><span className="text-xs text-slate-500">{a.skuName}</span>{a.accessTier && <span className="text-xs text-slate-500">{a.accessTier}</span>}<span className="text-xs text-slate-600">{a.resourceGroup}</span></div></div></div><button onClick={() => setDeleteTarget(a)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg flex-shrink-0"><Trash2 size={12} /> Delete</button></div>))}</div>)}
    {deleteTarget && <DeleteStorageModal account={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); fetchAccounts(); }} />}
  </div></DashboardLayout>);
}
