'use client';

/**
 * ConnectDOModal.tsx
 *
 * Modal for connecting a DigitalOcean account to Ad Astra via a Personal Access Token.
 * Mirrors ConnectAWSModal.tsx in structure, adapted for DO's auth model.
 *
 * Flow:
 *   1. User enters their Personal Access Token (and optionally Spaces credentials).
 *   2. On submit, POST /api/do/validate is called with the token as a header.
 *   3. The backend calls GET /v2/account to verify the token and returns account info.
 *   4. On success, credentials are saved to sessionStorage via DOContext.
 */

import { useState } from 'react';
import {
  X,
  Key,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
  ChevronDown,
  ChevronUp,
  HardDrive,
} from 'lucide-react';
import { useDO } from '@/context/DOContext';
import { validateDOToken } from '@/lib/doApi';

// ── Component ──────────────────────────────────────────────────────────────

export default function ConnectDOModal() {
  const { connectModalOpen, closeConnectModal, connect } = useDO();

  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [spacesKey, setSpacesKey] = useState('');
  const [spacesSecret, setSpacesSecret] = useState('');
  const [spacesBucket, setSpacesBucket] = useState('');
  const [spacesRegion, setSpacesRegion] = useState('nyc3');
  const [showSpacesSecret, setShowSpacesSecret] = useState(false);
  const [showSpacesFields, setShowSpacesFields] = useState(false);

  const SPACES_REGIONS = [
    { value: 'nyc3', label: 'New York 3 (nyc3)' },
    { value: 'sfo2', label: 'San Francisco 2 (sfo2)' },
    { value: 'sfo3', label: 'San Francisco 3 (sfo3)' },
    { value: 'ams3', label: 'Amsterdam 3 (ams3)' },
    { value: 'sgp1', label: 'Singapore 1 (sgp1)' },
    { value: 'fra1', label: 'Frankfurt 1 (fra1)' },
    { value: 'tor1', label: 'Toronto 1 (tor1)' },
    { value: 'blr1', label: 'Bangalore 1 (blr1)' },
    { value: 'syd1', label: 'Sydney 1 (syd1)' },
  ];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ email: string; uuid: string } | null>(null);

  if (!connectModalOpen) return null;

  function resetForm() {
    setApiToken('');
    setShowToken(false);
    setSpacesKey('');
    setSpacesSecret('');
    setSpacesBucket('');
    setSpacesRegion('nyc3');
    setShowSpacesSecret(false);
    setShowSpacesFields(false);
    setError(null);
    setSuccess(null);
  }

  function handleClose() {
    resetForm();
    closeConnectModal();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!apiToken.trim()) {
      setError('A Personal Access Token is required.');
      return;
    }

    setLoading(true);
    try {
      const info = await validateDOToken(apiToken.trim());
      setSuccess({ email: info.email, uuid: info.uuid });

      // Save to context (→ sessionStorage) after a short delay for UX
      setTimeout(() => {
        connect({
          apiToken: apiToken.trim(),
          spacesKey: spacesKey.trim() || undefined,
          spacesSecret: spacesSecret.trim() || undefined,
          spacesBucket: spacesBucket.trim() || undefined,
          spacesRegion: spacesRegion || undefined,
          email: info.email,
          uuid: info.uuid,
        });
        resetForm();
      }, 1500);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Connection failed. Please check your Personal Access Token.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 bg-slate-800/60 sticky top-0">
          <div className="flex items-center gap-3">
            {/* DO logo mark */}
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#0080FF">
                <path d="M12.003 0C5.375 0 0 5.375 0 12.003c0 6.625 5.375 12 12.003 12 6.625 0 12-5.375 12-12C24.003 5.375 18.628 0 12.003 0zm-.006 19.308v-3.24c3.408 0 5.963-3.24 4.66-6.82-.514-1.397-1.65-2.533-3.048-3.047-3.578-1.304-6.82 1.252-6.82 4.66H3.549C3.549 6.12 8.556 1.575 14.38 3.198c2.627.74 4.76 2.87 5.5 5.5 1.623 5.824-2.927 10.83-7.862 10.61z" />
                <path d="M12 15.88v3.237H8.764V15.88H12zM8.764 18.244H6.39v-2.375h2.375v2.375zM6.39 15.87H4.41v-1.98h1.98v1.98z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connect Your DigitalOcean Account</h2>
              <p className="text-xs text-slate-400">Use a Personal Access Token to manage your DO resources</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Security notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Shield size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-medium text-blue-300">Token stays in your browser.</span>{' '}
              Your PAT is stored only in{' '}
              <code className="text-blue-300 bg-blue-500/10 px-1 rounded">sessionStorage</code>{' '}
              and injected as a header on API calls. It is never logged or saved to our database.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Personal Access Token */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Key size={14} className="text-blue-400" />
                  Personal Access Token
                  <span className="text-red-400 text-xs">*</span>
                </span>
              </label>
              <div className="relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="dop_v1_…"
                  disabled={loading || !!success}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                Generate at{' '}
                <a
                  href="https://cloud.digitalocean.com/account/api/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5"
                >
                  cloud.digitalocean.com/account/api/tokens
                  <ExternalLink size={10} />
                </a>
              </p>
            </div>

            {/* Spaces credentials — collapsible */}
            <div>
              <button
                type="button"
                onClick={() => setShowSpacesFields((v) => !v)}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <HardDrive size={14} className="text-teal-400" />
                Spaces Object Storage credentials (optional)
                {showSpacesFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              <p className="text-xs text-slate-500 mt-1 ml-5">
                Required only for Spaces (S3-compatible storage) operations. Separate from the PAT.
              </p>

              {showSpacesFields && (
                <div className="mt-3 space-y-3 pl-5 border-l border-slate-700/50">
                  {/* Spaces Key */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Spaces Access Key</label>
                    <input
                      type="text"
                      value={spacesKey}
                      onChange={(e) => setSpacesKey(e.target.value)}
                      placeholder="DO00XXXXXXXXXXXXXX"
                      disabled={loading || !!success}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50 transition-colors"
                    />
                  </div>
                  {/* Spaces Secret */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Spaces Secret Key</label>
                    <div className="relative">
                      <input
                        type={showSpacesSecret ? 'text' : 'password'}
                        value={spacesSecret}
                        onChange={(e) => setSpacesSecret(e.target.value)}
                        placeholder="••••••••••••••••••••••••"
                        disabled={loading || !!success}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50 transition-colors pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSpacesSecret((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                        tabIndex={-1}
                      >
                        {showSpacesSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  {/* Spaces Bucket Name */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Spaces Bucket Name</label>
                    <input
                      type="text"
                      value={spacesBucket}
                      onChange={(e) => setSpacesBucket(e.target.value)}
                      placeholder="e.g. my-space"
                      disabled={loading || !!success}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 font-mono text-xs focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50 transition-colors"
                    />
                  </div>
                  {/* Spaces Region */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Spaces Region</label>
                    <select
                      value={spacesRegion}
                      onChange={(e) => setSpacesRegion(e.target.value)}
                      disabled={loading || !!success}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/30 disabled:opacity-50 transition-colors appearance-none cursor-pointer"
                    >
                      {SPACES_REGIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      The region from your Space&apos;s origin endpoint, e.g. <code className="text-teal-400 bg-teal-500/10 px-1 rounded">bucket.sfo3.digitaloceanspaces.com</code> → <strong className="text-slate-300">sfo3</strong>
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Generate Spaces keys at{' '}
                    <a
                      href="https://cloud.digitalocean.com/spaces"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-0.5"
                    >
                      cloud.digitalocean.com/spaces <ExternalLink size={10} />
                    </a>
                    {' '}→ Settings → Spaces access keys.
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle size={18} className="text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-300">
                  <p className="font-semibold">Connected successfully!</p>
                  <p className="text-green-400 mt-0.5">
                    Account: <span className="font-mono">{success.email}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-2.5 text-slate-300 bg-slate-700/80 hover:bg-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !!success || !apiToken.trim()}
                className="flex-1 py-2.5 text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Verifying Token…</>
                ) : success ? (
                  <><CheckCircle size={16} /> Connected!</>
                ) : (
                  'Connect DigitalOcean'
                )}
              </button>
            </div>
          </form>

          {/* Required scopes hint */}
          <div className="p-4 bg-slate-800/60 border border-slate-700/40 rounded-xl text-xs text-slate-500">
            <p className="font-medium text-slate-400 mb-1">Required token scopes (Read + Write):</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {['droplet:read', 'droplet:delete', 'database:read', 'database:delete', 'space:read', 'space:write', 'billing:read', 'monitoring:read'].map((s) => (
                <span key={s} className="font-mono text-slate-500">• {s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
