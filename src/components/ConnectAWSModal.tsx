'use client';

/**
 * ConnectAWSModal.tsx
 *
 * A full-screen modal that walks the user through connecting their AWS account.
 *
 * Flow:
 *   1. User enters Access Key ID, Secret Access Key, and Region.
 *   2. On submit, the frontend calls POST /api/aws/validate with credentials
 *      as request headers (never in the URL or body).
 *   3. The backend uses STS GetCallerIdentity to verify the keys and returns
 *      the Account ID and ARN.
 *   4. On success, credentials are saved to sessionStorage via AWSContext.
 *
 * Required IAM permissions: none — STS GetCallerIdentity works with any valid key.
 */

import { useState } from 'react';
import {
  X,
  Key,
  Globe,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { useAWS } from '@/context/AWSContext';
import { validateAwsCredentials } from '@/lib/api';

// ── AWS regions list ───────────────────────────────────────────────────────

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ca-central-1', label: 'Canada (Central)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-west-2', label: 'Europe (London)' },
  { value: 'eu-west-3', label: 'Europe (Paris)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
];

// ── IAM permissions needed ─────────────────────────────────────────────────

const REQUIRED_PERMISSIONS = [
  'ec2:DescribeInstances',
  'ec2:TerminateInstances',
  's3:ListAllMyBuckets',
  's3:GetBucketLocation',
  's3:GetLifecycleConfiguration',
  's3:PutLifecycleConfiguration',
  'rds:DescribeDBInstances',
  'rds:StopDBInstance',
  'ce:GetCostAndUsage',
  'cloudwatch:GetMetricStatistics',
];

// ── Component ──────────────────────────────────────────────────────────────

export default function ConnectAWSModal() {
  const { connectModalOpen, closeConnectModal, connect } = useAWS();

  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ accountId: string; arn: string } | null>(null);

  if (!connectModalOpen) return null;

  function resetForm() {
    setAccessKeyId('');
    setSecretAccessKey('');
    setRegion('us-east-1');
    setShowSecret(false);
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

    if (!accessKeyId.trim() || !secretAccessKey.trim()) {
      setError('Both Access Key ID and Secret Access Key are required.');
      return;
    }

    setLoading(true);
    try {
      const info = await validateAwsCredentials(
        accessKeyId.trim(),
        secretAccessKey.trim(),
        region,
      );

      setSuccess({ accountId: info.accountId, arn: info.arn });

      // Save to context (→ sessionStorage) and close after a short delay
      setTimeout(() => {
        connect({
          accessKeyId: accessKeyId.trim(),
          secretAccessKey: secretAccessKey.trim(),
          region,
          accountId: info.accountId,
        });
        resetForm();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <svg viewBox="0 0 40 24" className="w-6 h-6" fill="none">
                <path d="M11.5 0L0 6v12l11.5 6L23 18V6L11.5 0z" fill="#FF9900" opacity="0.9" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connect Your AWS Account</h2>
              <p className="text-xs text-slate-400">
                Enter your IAM credentials to manage your cloud resources
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Security notice */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <Shield size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-slate-300">
              <span className="font-medium text-blue-300">Credentials stay in your browser.</span>{' '}
              Your Access Key and Secret are stored only in{' '}
              <code className="text-blue-300 bg-blue-500/10 px-1 rounded">sessionStorage</code> and
              sent directly to your AWS account via the backend. They are never logged or persisted
              to our database.
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Access Key ID */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Key size={14} className="text-orange-400" />
                  AWS Access Key ID
                </span>
              </label>
              <input
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="AKIAIOSFODNN7EXAMPLE"
                disabled={loading || !!success}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50 transition-colors"
              />
              <p className="text-xs text-slate-500 mt-1">
                Starts with <code className="text-slate-400">AKIA</code> (long-term) or{' '}
                <code className="text-slate-400">ASIA</code> (temporary/STS)
              </p>
            </div>

            {/* Secret Access Key */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Key size={14} className="text-orange-400" />
                  AWS Secret Access Key
                </span>
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  disabled={loading || !!success}
                  className="w-full px-4 py-2.5 pr-12 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Region */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Globe size={14} className="text-orange-400" />
                  Primary AWS Region
                </span>
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={loading || !!success}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30 disabled:opacity-50 transition-colors"
              >
                {AWS_REGIONS.map((r) => (
                  <option key={r.value} value={r.value} className="bg-slate-800">
                    {r.label} ({r.value})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                The region where most of your EC2, RDS, and S3 resources live.
                Cost Explorer always queries globally.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-300">
                  <p className="font-medium">Successfully connected!</p>
                  <p className="text-green-400/80 mt-0.5">
                    Account ID: <span className="font-mono">{success.accountId}</span>
                  </p>
                  <p className="text-green-400/60 text-xs mt-0.5 truncate">{success.arn}</p>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full py-3 px-6 bg-orange-500 hover:bg-orange-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Validating credentials…
                </>
              ) : success ? (
                <>
                  <CheckCircle size={18} />
                  Connected! Redirecting…
                </>
              ) : (
                <>
                  <Key size={18} />
                  Connect AWS Account
                </>
              )}
            </button>
          </form>

          {/* Required permissions reference */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1.5 select-none">
              <span className="text-xs">▶</span>
              <span className="group-open:hidden">Show required IAM permissions</span>
              <span className="hidden group-open:inline">Hide IAM permissions</span>
            </summary>
            <div className="mt-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700/40">
              <p className="text-xs text-slate-400 mb-2">
                Create an IAM user with these permissions (no console access needed):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {REQUIRED_PERMISSIONS.map((perm) => (
                  <code
                    key={perm}
                    className="text-xs text-green-400 bg-slate-900/60 px-2 py-1 rounded font-mono"
                  >
                    {perm}
                  </code>
                ))}
              </div>
              <a
                href="https://console.aws.amazon.com/iam/home#/users"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3 transition-colors"
              >
                Open IAM Console
                <ExternalLink size={11} />
              </a>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
