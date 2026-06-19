'use client';

/**
 * ConnectAzureModal.tsx
 *
 * Modal for connecting a Microsoft Azure subscription to Ad Astra via a Service Principal.
 * Flow: User enters Subscription ID, Tenant ID, Client ID, Client Secret → validate → save.
 */

import { useState } from 'react';
import { X, Key, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ExternalLink, Shield } from 'lucide-react';
import { useAzure } from '@/context/AzureContext';
import { validateAzureCredentials } from '@/lib/azureApi';

export default function ConnectAzureModal() {
  const { connectModalOpen, closeConnectModal, connect } = useAzure();

  const [subscriptionId, setSubscriptionId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ subscriptionId: string } | null>(null);

  if (!connectModalOpen) return null;

  function resetForm() {
    setSubscriptionId(''); setTenantId(''); setClientId(''); setClientSecret('');
    setShowSecret(false); setError(null); setSuccess(null);
  }

  function handleClose() { resetForm(); closeConnectModal(); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);

    if (!subscriptionId.trim()) { setError('Subscription ID is required.'); return; }
    if (!tenantId.trim()) { setError('Tenant ID is required.'); return; }
    if (!clientId.trim()) { setError('Client ID is required.'); return; }
    if (!clientSecret.trim()) { setError('Client Secret is required.'); return; }

    setLoading(true);
    try {
      const info = await validateAzureCredentials(
        subscriptionId.trim(), tenantId.trim(), clientId.trim(), clientSecret.trim(),
      );
      setSuccess({ subscriptionId: info.subscriptionId });

      setTimeout(() => {
        connect({
          subscriptionId: subscriptionId.trim(),
          tenantId: tenantId.trim(),
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        });
        resetForm();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 bg-slate-800/60 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                <rect x="1" y="1" width="10" height="10" rx="1" fill="#F25022"/>
                <rect x="13" y="1" width="10" height="10" rx="1" fill="#7FBA00"/>
                <rect x="1" y="13" width="10" height="10" rx="1" fill="#00A4EF"/>
                <rect x="13" y="13" width="10" height="10" rx="1" fill="#FFB900"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connect Your Azure Subscription</h2>
              <p className="text-xs text-slate-400">Use a Service Principal to manage your Azure resources</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Security notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Shield size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-medium text-blue-300">Credentials stay in your browser.</span>{' '}
              Your service principal secret is stored only in{' '}
              <code className="text-blue-300 bg-blue-500/10 px-1 rounded">sessionStorage</code>{' '}
              and sent as headers on API calls. It is never logged or saved to our database.
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subscription ID */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5"><Key size={14} className="text-cyan-400" /> Subscription ID <span className="text-red-400 text-xs">*</span></span>
              </label>
              <input type="text" value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={loading || !!success}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 transition-colors" />
            </div>

            {/* Tenant ID */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5"><Key size={14} className="text-cyan-400" /> Tenant (Directory) ID <span className="text-red-400 text-xs">*</span></span>
              </label>
              <input type="text" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={loading || !!success}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 transition-colors" />
            </div>

            {/* Client ID */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5"><Key size={14} className="text-cyan-400" /> Application (Client) ID <span className="text-red-400 text-xs">*</span></span>
              </label>
              <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={loading || !!success}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 transition-colors" />
            </div>

            {/* Client Secret */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5"><Key size={14} className="text-cyan-400" /> Client Secret <span className="text-red-400 text-xs">*</span></span>
              </label>
              <div className="relative">
                <input type={showSecret ? 'text' : 'password'} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="••••••••••••••••••••" disabled={loading || !!success}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 disabled:opacity-50 transition-colors pr-12" />
                <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors" tabIndex={-1}>
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Create at{' '}
                <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-0.5">
                  Azure Portal → App Registrations <ExternalLink size={10} />
                </a>{' '}→ Certificates & secrets → New client secret
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-300">
                  <p className="font-semibold">Connected successfully!</p>
                  <p className="text-green-400 mt-0.5">Subscription: <span className="font-mono">{success.subscriptionId}</span></p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleClose} className="flex-1 py-2.5 text-slate-300 bg-slate-700/80 hover:bg-slate-700 rounded-xl font-medium text-sm transition-colors">Cancel</button>
              <button type="submit" disabled={loading || !!success || !subscriptionId.trim() || !tenantId.trim() || !clientId.trim() || !clientSecret.trim()}
                className="flex-1 py-2.5 text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : success ? <><CheckCircle size={16} /> Connected!</> : 'Connect Azure'}
              </button>
            </div>
          </form>

          {/* Required roles hint */}
          <div className="p-4 bg-slate-800/60 border border-slate-700/40 rounded-xl text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-1">Required Azure RBAC roles for the service principal:</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {['Reader', 'Virtual Machine Contributor', 'Storage Account Contributor', 'SQL DB Contributor', 'Billing Reader', 'Cost Management Reader'].map((r) => (
                <span key={r} className="font-mono text-slate-500">• {r}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
