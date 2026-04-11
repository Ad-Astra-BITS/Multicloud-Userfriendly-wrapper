'use client';

/**
 * KillSwitch Component
 *
 * Emergency shutdown with a real 3-step flow:
 *   1. Click DESTROY ALL → POST /kill-switch/initiate → backend generates OTP
 *   2. User enters the OTP shown on screen → POST /kill-switch/verify → execToken
 *   3. POST /kill-switch/execute with execToken → actual termination
 *
 * Resource counts are fetched live from /api/analytics/summary.
 */

import { useState, useRef, useEffect } from 'react';
import { Power, AlertTriangle, X, Shield, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceCounts {
  ec2: number;
  s3: number;
  rds: number;
}

interface ExecuteResult {
  terminatedEC2: number;
  deletedS3: number;
  stoppedRDS: number;
  errors: string[];
}

// ── OTP Modal ─────────────────────────────────────────────────────────────────

interface OTPModalProps {
  isOpen: boolean;
  generatedOtp: string;       // OTP returned by the backend (shown to user)
  expiresAt: string;
  onClose: () => void;
  onVerified: (execToken: string) => void;
}

function OTPModal({ isOpen, generatedOtp, expiresAt, onClose, onVerified }: OTPModalProps) {
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;
    const next = [...otp];
    pasted.split('').forEach((d, i) => { if (i < 6) next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleConfirm = async () => {
    const code = otp.join('');
    if (code.length !== 6) { setError('Please enter all 6 digits'); return; }
    setVerifying(true);
    try {
      const res = await api.post<{ execToken: string }>('/kill-switch/verify', { otp: code });
      onVerified(res.execToken);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid or expired OTP');
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  const expiry = new Date(expiresAt);
  const expiryStr = expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Shield size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Security Verification</h2>
                <p className="text-xs text-slate-400">Enter the OTP shown below</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-5">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                This action is <strong>irreversible</strong>. All resources will be permanently destroyed.
              </p>
            </div>

            {/* Show the OTP */}
            <div className="mb-5 p-4 bg-slate-900/80 border border-amber-500/30 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Your one-time password (expires {expiryStr})</p>
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-400">{generatedOtp}</p>
              <p className="text-xs text-slate-500 mt-1">In production this would be sent via email/SMS</p>
            </div>

            {/* OTP Input */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-400 mb-3 text-center">
                Re-enter the OTP to confirm
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`w-11 h-13 text-center text-xl font-bold bg-slate-900 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      error ? 'border-red-500 focus:ring-red-500/50' : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/50'
                    } text-white`}
                  />
                ))}
              </div>
              {error && <p className="text-red-400 text-sm text-center mt-3">{error}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900/30">
            <button onClick={onClose} className="flex-1 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={verifying}
              className="flex-1 py-3 text-white bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : 'Confirm Destruction'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Result Modal ──────────────────────────────────────────────────────────────

interface ResultModalProps {
  result: ExecuteResult | null;
  onClose: () => void;
}

function ResultModal({ result, onClose }: ResultModalProps) {
  if (!result) return null;
  const hasErrors = result.errors.length > 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className={`w-20 h-20 ${hasErrors ? 'bg-amber-500/20' : 'bg-green-500/20'} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {hasErrors
              ? <AlertTriangle size={40} className="text-amber-400" />
              : <Check size={40} className="text-green-400" />}
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            {hasErrors ? 'Partial Execution' : 'Kill Switch Executed'}
          </h2>
          <div className="text-slate-400 mb-4 space-y-1 text-sm">
            <p>{result.terminatedEC2} EC2 instances terminated</p>
            <p>{result.deletedS3} S3 buckets deleted</p>
            <p>{result.stoppedRDS} RDS databases stopped</p>
          </div>
          {hasErrors && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-left">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">{e}</p>
              ))}
            </div>
          )}
          <button onClick={onClose} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors">
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function KillSwitch() {
  const [counts, setCounts] = useState<ResourceCounts | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const [initiating, setInitiating] = useState(false);

  // OTP modal state
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState('');

  // Execution state
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteResult | null>(null);

  // Fetch live resource counts
  useEffect(() => {
    api.get<{ activeResources: ResourceCounts }>('/analytics/summary')
      .then((d) => setCounts(d.activeResources))
      .catch(() => {});
  }, []);

  const handleDestroyAll = async () => {
    setInitiating(true);
    try {
      const res = await api.post<{ otp: string; expiresAt: string }>('/kill-switch/initiate');
      setGeneratedOtp(res.otp);
      setOtpExpiresAt(res.expiresAt);
      setOtpModalOpen(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to initiate kill switch');
    } finally {
      setInitiating(false);
    }
  };

  const handleVerified = async (execToken: string) => {
    setOtpModalOpen(false);
    setExecuting(true);
    try {
      const res = await api.post<ExecuteResult>('/kill-switch/execute', { execToken });
      setExecResult(res);
      // Refresh counts after execution
      api.get<{ activeResources: ResourceCounts }>('/analytics/summary')
        .then((d) => setCounts(d.activeResources))
        .catch(() => {});
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const totalResources = counts ? counts.ec2 + counts.s3 + counts.rds : null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Warning banner */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-400 mb-2">Emergency Shutdown</h2>
            <p className="text-sm text-slate-400">
              The Kill Switch will permanently destroy all cloud resources including EC2 instances,
              S3 buckets, RDS databases, and any associated data. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {/* Kill Switch button container */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center">
        {/* Live resource summary */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-slate-900/50 rounded-xl">
          <div>
            <div className="text-2xl font-bold text-blue-400">
              {counts ? counts.ec2 : <span className="inline-block w-8 h-6 bg-slate-700 rounded animate-pulse" />}
            </div>
            <div className="text-xs text-slate-500 mt-1">EC2 Instances</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {counts ? counts.s3 : <span className="inline-block w-8 h-6 bg-slate-700 rounded animate-pulse" />}
            </div>
            <div className="text-xs text-slate-500 mt-1">S3 Buckets</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">
              {counts ? counts.rds : <span className="inline-block w-8 h-6 bg-slate-700 rounded animate-pulse" />}
            </div>
            <div className="text-xs text-slate-500 mt-1">RDS Databases</div>
          </div>
        </div>

        {/* Big red button */}
        <div className="relative inline-block">
          <div className={`absolute inset-0 bg-red-500 rounded-full blur-xl transition-opacity duration-300 ${isPressed ? 'opacity-50' : 'opacity-20'}`} />
          <button
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            onClick={handleDestroyAll}
            disabled={initiating || executing || totalResources === 0}
            className={`relative w-48 h-48 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-4 border-red-400/50 shadow-2xl flex flex-col items-center justify-center gap-3 transition-all duration-150 hover:from-red-400 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${isPressed ? 'scale-95 shadow-lg' : 'scale-100'}`}
          >
            {initiating || executing
              ? <Loader2 size={48} className="text-white animate-spin" />
              : <Power size={48} className="text-white" />}
            <span className="text-white font-bold text-lg">
              {initiating ? 'INITIATING…' : executing ? 'DESTROYING…' : 'DESTROY ALL'}
            </span>
          </button>
        </div>

        <p className="text-red-400 text-sm font-medium mt-8">This action is irreversible</p>
        <p className="text-slate-500 text-xs mt-2">You will be asked to verify with OTP before proceeding</p>
      </div>

      {/* What will be destroyed */}
      <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl">
        <h3 className="text-sm font-medium text-slate-300 mb-2">What will be destroyed:</h3>
        <ul className="text-xs text-slate-500 space-y-1">
          <li>• All running EC2 instances will be terminated</li>
          <li>• All S3 buckets and their contents will be permanently deleted</li>
          <li>• All running RDS databases will be stopped</li>
          <li>• Associated EBS volumes and other compute resources</li>
        </ul>
      </div>

      {/* OTP Modal */}
      <OTPModal
        isOpen={otpModalOpen}
        generatedOtp={generatedOtp}
        expiresAt={otpExpiresAt}
        onClose={() => setOtpModalOpen(false)}
        onVerified={handleVerified}
      />

      {/* Result Modal */}
      <ResultModal
        result={execResult}
        onClose={() => setExecResult(null)}
      />
    </div>
  );
}
