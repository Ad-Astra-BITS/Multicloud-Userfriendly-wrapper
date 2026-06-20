'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAzure } from '@/context/AzureContext';
import { azureVMsApi, AzureVM } from '@/lib/azureApi';
import { Server, RefreshCw, Cpu, MemoryStick, HardDrive, DollarSign, MapPin, Tag, Loader2, WifiOff, Trash2, AlertTriangle, X, Play, Square } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  Running: 'bg-green-500/20 text-green-400', Deallocated: 'bg-slate-700 text-slate-400',
  Stopped: 'bg-amber-500/20 text-amber-400', Starting: 'bg-blue-500/20 text-blue-400',
  Deallocating: 'bg-amber-500/20 text-amber-400', Unknown: 'bg-slate-700 text-slate-400',
};

function DeleteVMModal({ vm, onClose, onDeleted }: { vm: AzureVM; onClose: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function handleDelete() { if (confirmation !== vm.name) return; setDeleting(true); setError(null); try { await azureVMsApi.delete([{ resourceGroup: vm.resourceGroup, name: vm.name }]); setDone(true); } catch (e: unknown) { setError((e as Error).message); setDeleting(false); } }

  return (<><div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={done ? onDeleted : onClose} /><div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
    {done ? (<div className="text-center py-4"><div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3"><Server size={22} className="text-green-400" /></div><h3 className="text-lg font-semibold text-white mb-1">VM Deleted</h3><p className="text-sm text-slate-400 mb-4"><span className="font-mono text-white">{vm.name}</span> deleted.</p><button onClick={onDeleted} className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm">Close</button></div>) : (<>
      <div className="flex items-start justify-between mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><AlertTriangle size={18} className="text-red-400" /></div><div><h3 className="text-lg font-semibold text-white">Delete VM</h3><p className="text-xs text-slate-400">Permanent and cannot be undone</p></div></div><button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button></div>
      <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/50 mb-4"><p className="text-sm font-medium text-white">{vm.name}</p><p className="text-xs text-slate-400">{vm.vmSize} · {vm.vcpus} vCPU · {vm.location} · {vm.resourceGroup}</p></div>
      <label className="block text-xs text-slate-400 mb-1.5">Type <span className="font-mono text-white">{vm.name}</span> to confirm</label>
      <input type="text" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={vm.name} className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500 mb-4" />
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm">Cancel</button><button onClick={handleDelete} disabled={confirmation !== vm.name || deleting} className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-1.5">{deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}{deleting ? 'Deleting…' : 'Delete'}</button></div>
    </>)}
  </div></div></>);
}

export default function AzureVMsPage() {
  const { isConnected, openConnectModal } = useAzure();
  const [vms, setVms] = useState<AzureVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AzureVM | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchVMs = useCallback(async () => { if (!isConnected) { setLoading(false); return; } setLoading(true); setError(null); try { setVms(await azureVMsApi.list()); } catch (e: unknown) { setError((e as Error).message); } finally { setLoading(false); } }, [isConnected]);
  useEffect(() => { fetchVMs(); }, [fetchVMs]);

  async function handleToggle(vm: AzureVM) { setToggling(vm.name); try { vm.status === 'Running' ? await azureVMsApi.deallocate(vm.resourceGroup, vm.name) : await azureVMsApi.start(vm.resourceGroup, vm.name); await fetchVMs(); } catch (e: unknown) { setError((e as Error).message); } finally { setToggling(null); } }

  const running = vms.filter((v) => v.status === 'Running').length;
  const totalCost = vms.filter((v) => v.status === 'Running').reduce((s, v) => s + v.price_monthly, 0);

  return (<DashboardLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Server className="text-cyan-400" size={24} /> Azure Virtual Machines</h1><p className="text-sm text-slate-400 mt-1">Manage your Azure VMs across all resource groups</p></div>
      <div className="flex items-center gap-3">{isConnected && <div className="flex items-center gap-4 text-sm mr-4"><span className="text-slate-400">{running} running</span><span className="text-green-400 font-medium">${totalCost.toFixed(2)}/mo</span></div>}<button onClick={fetchVMs} disabled={loading || !isConnected} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm disabled:opacity-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
    </div>

    {!isConnected ? (<div className="text-center py-20"><WifiOff size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">Azure Not Connected</h2><p className="text-slate-400 text-sm mb-6">Connect your Azure subscription to view virtual machines.</p><button onClick={openConnectModal} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium">Connect Azure</button></div>
    ) : loading ? (<div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-cyan-400" /></div>
    ) : error ? (<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><p className="text-red-400 text-sm">{error}</p></div>
    ) : vms.length === 0 ? (<div className="text-center py-20"><Server size={48} className="text-slate-600 mx-auto mb-4" /><h2 className="text-lg font-semibold text-white mb-2">No VMs Found</h2><p className="text-slate-400 text-sm">Your subscription has no virtual machines.</p></div>
    ) : (<div className="space-y-3">{vms.map((vm) => (
      <div key={vm.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-all">
        <div className="flex items-center gap-3 flex-1 min-w-0"><div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${vm.status === 'Running' ? 'bg-green-500/20' : 'bg-slate-700/50'}`}><Server size={16} className={vm.status === 'Running' ? 'text-green-400' : 'text-slate-400'} /></div><div className="min-w-0"><p className="text-sm font-medium text-white truncate">{vm.name}</p><div className="flex items-center gap-2 mt-0.5"><span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLES[vm.status] ?? 'bg-slate-700 text-slate-400'}`}>{vm.status}</span><span className="flex items-center gap-1 text-xs text-slate-500"><MapPin size={10} /> {vm.location}</span><span className="text-xs text-slate-500 font-mono">{vm.vmSize}</span><span className="text-xs text-slate-600">{vm.resourceGroup}</span></div></div></div>
        <div className="flex items-center gap-4 flex-shrink-0 text-xs text-slate-400"><span className="flex items-center gap-1"><Cpu size={12} /> {vm.vcpus} vCPU</span><span className="flex items-center gap-1"><MemoryStick size={12} /> {vm.memory >= 1024 ? `${(vm.memory / 1024).toFixed(1)}GB` : `${vm.memory}MB`}</span><span className="flex items-center gap-1"><HardDrive size={12} /> {vm.osDiskSizeGb}GB</span><span className="flex items-center gap-1 text-green-400 font-medium"><DollarSign size={12} />{vm.price_monthly.toFixed(2)}/mo</span></div>
        {vm.tags && Object.keys(vm.tags).length > 0 && <div className="flex items-center gap-1 flex-shrink-0"><Tag size={11} className="text-slate-500" />{Object.entries(vm.tags).slice(0, 2).map(([k, v]) => <span key={k} className="text-xs bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-400">{k}={v}</span>)}</div>}
        <div className="flex items-center gap-2 flex-shrink-0">
          {(vm.status === 'Running' || vm.status === 'Deallocated') && <button onClick={() => handleToggle(vm)} disabled={toggling === vm.name} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${vm.status === 'Running' ? 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400' : 'bg-green-600/20 hover:bg-green-600/40 text-green-400'} disabled:opacity-40`}>{toggling === vm.name ? <Loader2 size={12} className="animate-spin" /> : vm.status === 'Running' ? <Square size={12} /> : <Play size={12} />}{vm.status === 'Running' ? 'Deallocate' : 'Start'}</button>}
          <button onClick={() => setDeleteTarget(vm)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg"><Trash2 size={12} /> Delete</button>
        </div>
      </div>
    ))}</div>)}

    {deleteTarget && <DeleteVMModal vm={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); fetchVMs(); }} />}
  </div></DashboardLayout>);
}
