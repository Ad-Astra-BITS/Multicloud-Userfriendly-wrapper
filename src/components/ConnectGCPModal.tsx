'use client';

import { useState } from 'react';
import { X, Key, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ExternalLink, Shield, FileJson } from 'lucide-react';
import { useGCP } from '@/context/GCPContext';
import { validateGCPCredentials } from '@/lib/gcpApi';

export default function ConnectGCPModal() {
  const { connectModalOpen, closeConnectModal, connect } = useGCP();
  const [projectId, setProjectId] = useState('');
  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ projectId: string } | null>(null);

  if (!connectModalOpen) return null;

  function resetForm() { setProjectId(''); setServiceAccountJson(''); setShowJson(false); setError(null); setSuccess(null); }
  function handleClose() { resetForm(); closeConnectModal(); }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setServiceAccountJson(text);
      try { const parsed = JSON.parse(text); if (parsed.project_id && !projectId) setProjectId(parsed.project_id); } catch { /* ignore */ }
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!projectId.trim()) { setError('A GCP Project ID is required.'); return; }
    setLoading(true);
    try {
      let credentialsBase64: string | undefined;
      if (serviceAccountJson.trim()) {
        try { JSON.parse(serviceAccountJson.trim()); } catch { setError('Service Account Key must be valid JSON.'); setLoading(false); return; }
        credentialsBase64 = btoa(serviceAccountJson.trim());
      }
      const info = await validateGCPCredentials(projectId.trim(), credentialsBase64);
      setSuccess({ projectId: info.projectId });
      setTimeout(() => { connect({ projectId: projectId.trim(), credentialsBase64 }); resetForm(); }, 1500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Connection failed.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 bg-slate-800/60 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                <path d="M12.72 5.57l2.24-2.24.14-.94a9.94 9.94 0 0 0-8.01 1.6l1.66 1.66.81-.08a4.31 4.31 0 0 1 3.16 0z" fill="#EA4335"/>
                <path d="M19.43 8.09a9.98 9.98 0 0 0-3.01-3.46l-2.24 2.24a6.06 6.06 0 0 1 2.21 2.47l2.24-2.24.8.99z" fill="#4285F4"/>
                <path d="M12 17.93a5.9 5.9 0 0 1-3.57-1.2L6.2 18.97A9.96 9.96 0 0 0 12 21a9.96 9.96 0 0 0 5.8-1.86l-2.24-2.24A5.9 5.9 0 0 1 12 17.93z" fill="#34A853"/>
                <path d="M5.57 12.72A5.9 5.9 0 0 1 6.07 9.6L3.83 7.36A9.96 9.96 0 0 0 2 12c0 2.03.6 3.92 1.63 5.5l2.24-2.24a5.86 5.86 0 0 1-.3-2.54z" fill="#FBBC05"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connect Your GCP Project</h2>
              <p className="text-xs text-slate-400">Use a Service Account Key to manage your Google Cloud resources</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Shield size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-medium text-blue-300">Credentials stay in your browser.</span>{' '}
              Your service account key is stored only in <code className="text-blue-300 bg-blue-500/10 px-1 rounded">sessionStorage</code> and sent as a header on API calls.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5"><Key size={14} className="text-red-400" /> GCP Project ID <span className="text-red-400 text-xs">*</span></span>
              </label>
              <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="my-project-123456" disabled={loading || !!success}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30 disabled:opacity-50 transition-colors" />
              <p className="text-xs text-slate-500 mt-1">Found in <a href="https://console.cloud.google.com/home/dashboard" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink size={10} /></a></p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5"><FileJson size={14} className="text-yellow-400" /> Service Account Key (JSON)</span>
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-400 hover:border-slate-500 cursor-pointer transition-colors mb-2">
                <FileJson size={14} /><span>{serviceAccountJson ? 'Key file loaded ✓' : 'Upload key file (.json)'}</span>
                <input type="file" accept=".json" onChange={handleFileUpload} disabled={loading || !!success} className="hidden" />
              </label>
              <div className="relative">
                <textarea value={showJson ? serviceAccountJson : serviceAccountJson ? '••• JSON key loaded •••' : ''} onChange={(e) => { setShowJson(true); setServiceAccountJson(e.target.value); }} onFocus={() => setShowJson(true)} placeholder='Or paste JSON key here…' rows={4} disabled={loading || !!success}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/30 disabled:opacity-50 transition-colors resize-none" />
                {serviceAccountJson && <button type="button" onClick={() => setShowJson((v) => !v)} className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors" tabIndex={-1}>{showJson ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
              </div>
              <p className="text-xs text-slate-500 mt-1">Create at <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-yellow-400 hover:text-yellow-300 inline-flex items-center gap-0.5">IAM → Service Accounts <ExternalLink size={10} /></a> → Keys → Add Key → JSON</p>
            </div>

            {error && <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"><AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" /><p className="text-sm text-red-400">{error}</p></div>}
            {success && <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl"><CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" /><div className="text-sm text-green-300"><p className="font-semibold">Connected!</p><p className="text-green-400 mt-0.5">Project: <span className="font-mono">{success.projectId}</span></p></div></div>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose} className="flex-1 py-2.5 text-slate-300 bg-slate-700/80 hover:bg-slate-700 rounded-xl font-medium text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={loading || !!success || !projectId.trim()} className="flex-1 py-2.5 text-white bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : success ? <><CheckCircle size={16} /> Connected!</> : 'Connect GCP'}
              </button>
            </div>
          </form>

          <div className="p-4 bg-slate-800/60 border border-slate-700/40 rounded-xl text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-1">Required IAM roles:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {['compute.viewer', 'compute.instanceAdmin.v1', 'storage.admin', 'cloudsql.viewer', 'billing.viewer', 'monitoring.viewer'].map((r) => (
                <span key={r} className="font-mono text-slate-500">• roles/{r}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
