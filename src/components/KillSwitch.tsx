'use client';

import { useState, useRef, useEffect } from 'react';
import { Power, AlertTriangle, X, Shield, Check, Loader2, Server, Database, Archive } from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResourceItem {
  id: string;
  name: string;
  status?: string;
  region?: string;
}

interface ResourceList {
  ec2: ResourceItem[];
  s3: ResourceItem[];
  rds: ResourceItem[];
}

interface ExecuteResult {
  terminatedEC2: number;
  deletedS3: number;
  stoppedRDS: number;
  errors: string[];
}

// ── Resource Group ─────────────────────────────────────────────────────────────

interface ResourceGroupProps {
  title: string;
  icon: React.ReactNode;
  items: ResourceItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

function ResourceGroup({ title, icon, items, selected, onToggle, onToggleAll }: ResourceGroupProps) {
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));

  return (
    <div className="border border-slate-700/50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-300">{title}</span>
          <span className="text-xs text-slate-500">({items.length})</span>
        </div>
        <button
          onClick={onToggleAll}
          className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 hover:bg-slate-700 rounded"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="divide-y divide-slate-700/30">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => onToggle(item.id)}
              className="w-4 h-4 rounded accent-red-500 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-white truncate block">{item.name}</span>
              {item.region && <span className="text-xs text-slate-500">{item.region}</span>}
            </div>
            {item.status && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  item.status === 'running'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {item.status}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

// ── OTP Modal ─────────────────────────────────────────────────────────────────

interface OTPModalProps {
  isOpen: boolean;
  generatedOtp: string;
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

  const expiryStr = new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
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

          <div className="p-6">
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-5">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">
                This action is <strong>irreversible</strong>. Selected resources will be permanently destroyed.
              </p>
            </div>

            <div className="mb-5 p-4 bg-slate-900/80 border border-amber-500/30 rounded-xl text-center">
              <p className="text-xs text-slate-400 mb-1">Your one-time password (expires {expiryStr})</p>
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-amber-400">{generatedOtp}</p>
              <p className="text-xs text-slate-500 mt-1">In production this would be sent via email/SMS</p>
            </div>

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
  const [resources, setResources] = useState<ResourceList | null>(null);
  const [loadingResources, setLoadingResources] = useState(true);
  const [selectedEC2, setSelectedEC2] = useState<Set<string>>(new Set());
  const [selectedS3, setSelectedS3] = useState<Set<string>>(new Set());
  const [selectedRDS, setSelectedRDS] = useState<Set<string>>(new Set());

  const [isPressed, setIsPressed] = useState(false);
  const [initiating, setInitiating] = useState(false);

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState('');

  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<ExecuteResult | null>(null);

  const fetchResources = () => {
    setLoadingResources(true);
    api.get<ResourceList>('/kill-switch/resources')
      .then((data) => setResources(data))
      .catch(() => setResources({ ec2: [], s3: [], rds: [] }))
      .finally(() => setLoadingResources(false));
  };

  useEffect(() => { fetchResources(); }, []);

  const toggle = (
    selected: Set<string>,
    setFn: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroup = (
    items: ResourceItem[],
    selected: Set<string>,
    setFn: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
    setFn(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const totalSelected = selectedEC2.size + selectedS3.size + selectedRDS.size;

  const handleDestroySelected = async () => {
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
      const res = await api.post<ExecuteResult>('/kill-switch/execute', {
        execToken,
        selectedResources: {
          ec2: Array.from(selectedEC2),
          s3: Array.from(selectedS3),
          rds: Array.from(selectedRDS),
        },
      });
      setExecResult(res);
      setSelectedEC2(new Set());
      setSelectedS3(new Set());
      setSelectedRDS(new Set());
      fetchResources();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const totalResources = resources
    ? resources.ec2.length + resources.s3.length + resources.rds.length
    : 0;

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
              Select the resources you want to destroy, then click the button below. EC2 instances and
              S3 buckets are permanently deleted. RDS databases are stopped.
            </p>
          </div>
        </div>
      </div>

      {/* Resource selection panel */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-slate-300">Select Resources to Destroy</h3>
          <div className="flex items-center gap-4">
            {totalSelected > 0 && (
              <span className="text-xs text-red-400 font-medium">{totalSelected} selected</span>
            )}
            <button
              onClick={() => {
                if (resources) {
                  setSelectedEC2(new Set(resources.ec2.map((r) => r.id)));
                  setSelectedS3(new Set(resources.s3.map((r) => r.id)));
                  setSelectedRDS(new Set(resources.rds.map((r) => r.id)));
                }
              }}
              disabled={!resources || totalResources === 0}
              className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            >
              Select all
            </button>
            <button
              onClick={() => { setSelectedEC2(new Set()); setSelectedS3(new Set()); setSelectedRDS(new Set()); }}
              disabled={totalSelected === 0}
              className="text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            >
              Clear all
            </button>
          </div>
        </div>

        {loadingResources ? (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading resources…</span>
          </div>
        ) : totalResources === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No active resources found</div>
        ) : (
          <div className="space-y-3">
            {resources && resources.ec2.length > 0 && (
              <ResourceGroup
                title="EC2 Instances"
                icon={<Server size={14} className="text-blue-400" />}
                items={resources.ec2}
                selected={selectedEC2}
                onToggle={(id) => toggle(selectedEC2, setSelectedEC2, id)}
                onToggleAll={() => toggleGroup(resources.ec2, selectedEC2, setSelectedEC2)}
              />
            )}
            {resources && resources.s3.length > 0 && (
              <ResourceGroup
                title="S3 Buckets"
                icon={<Archive size={14} className="text-green-400" />}
                items={resources.s3}
                selected={selectedS3}
                onToggle={(id) => toggle(selectedS3, setSelectedS3, id)}
                onToggleAll={() => toggleGroup(resources.s3, selectedS3, setSelectedS3)}
              />
            )}
            {resources && resources.rds.length > 0 && (
              <ResourceGroup
                title="RDS Databases"
                icon={<Database size={14} className="text-amber-400" />}
                items={resources.rds}
                selected={selectedRDS}
                onToggle={(id) => toggle(selectedRDS, setSelectedRDS, id)}
                onToggleAll={() => toggleGroup(resources.rds, selectedRDS, setSelectedRDS)}
              />
            )}
          </div>
        )}
      </div>

      {/* Destroy button */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center">
        <div className="relative inline-block">
          <div className={`absolute inset-0 bg-red-500 rounded-full blur-xl transition-opacity duration-300 ${isPressed ? 'opacity-50' : 'opacity-20'}`} />
          <button
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            onClick={handleDestroySelected}
            disabled={initiating || executing || totalSelected === 0}
            className={`relative w-48 h-48 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-4 border-red-400/50 shadow-2xl flex flex-col items-center justify-center gap-2 transition-all duration-150 hover:from-red-400 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed ${isPressed ? 'scale-95 shadow-lg' : 'scale-100'}`}
          >
            {initiating || executing
              ? <Loader2 size={48} className="text-white animate-spin" />
              : <Power size={48} className="text-white" />}
            <span className="text-white font-bold text-sm text-center leading-tight px-3">
              {initiating ? 'INITIATING…' : executing ? 'DESTROYING…' : totalSelected === 0
                ? 'SELECT\nRESOURCES'
                : (
                  <>DESTROY<br />SELECTED<br />({totalSelected})</>
                )}
            </span>
          </button>
        </div>
        <p className="text-red-400 text-sm font-medium mt-8">
          {totalSelected === 0 ? 'Select resources above to enable' : 'This action is irreversible'}
        </p>
        <p className="text-slate-500 text-xs mt-2">You will be asked to verify with OTP before proceeding</p>
      </div>

      <OTPModal
        isOpen={otpModalOpen}
        generatedOtp={generatedOtp}
        expiresAt={otpExpiresAt}
        onClose={() => setOtpModalOpen(false)}
        onVerified={handleVerified}
      />

      <ResultModal
        result={execResult}
        onClose={() => setExecResult(null)}
      />
    </div>
  );
}
