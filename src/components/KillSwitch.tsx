'use client';

/**
 * KillSwitch Component
 *
 * Emergency shutdown control with OTP verification.
 * Includes a big red button and confirmation modal with OTP input.
 */

import { useState, useRef, useEffect } from 'react';
import { Power, AlertTriangle, X, Shield, Check } from 'lucide-react';

// ============================================
// OTP Modal Component
// ============================================

interface OTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (otp: string) => void;
}

function OTPModal({ isOpen, onClose, onConfirm }: OTPModalProps) {
  // OTP input state - 6 digits
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Refs for input focus management
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when modal opens
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  // Handle individual digit input
  const handleChange = (index: number, value: string) => {
    // Only allow single digit
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split('').forEach((digit, i) => {
      if (i < 6) newOtp[i] = digit;
    });
    setOtp(newOtp);

    // Focus appropriate input
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  // Handle confirm
  const handleConfirm = async () => {
    const otpString = otp.join('');

    if (otpString.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsVerifying(true);

    // Simulate verification delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock validation - accept "123456" as valid OTP
    if (otpString === '123456') {
      onConfirm(otpString);
    } else {
      setError('Invalid OTP. Try 123456 for demo.');
      setIsVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                <Shield size={20} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Security Verification
                </h2>
                <p className="text-xs text-slate-400">Enter your OTP to confirm</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Warning message */}
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
              <AlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-400 font-medium">
                  This action is irreversible
                </p>
                <p className="text-xs text-red-400/70 mt-1">
                  All resources will be permanently destroyed. This cannot be undone.
                </p>
              </div>
            </div>

            {/* OTP Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-3 text-center">
                Enter 6-digit OTP
              </label>
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`w-12 h-14 text-center text-xl font-bold bg-slate-900 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                      error
                        ? 'border-red-500 focus:ring-red-500/50'
                        : 'border-slate-700 focus:border-blue-500 focus:ring-blue-500/50'
                    } text-white`}
                  />
                ))}
              </div>
              {error && (
                <p className="text-red-400 text-sm text-center mt-3">{error}</p>
              )}
              <p className="text-slate-500 text-xs text-center mt-3">
                Demo OTP: <code className="text-slate-400">123456</code>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 border-t border-slate-700 bg-slate-900/30">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isVerifying}
              className="flex-1 py-3 text-white bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                'Confirm Destruction'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================
// Success Modal Component
// ============================================

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SuccessModal({ isOpen, onClose }: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center animate-in fade-in zoom-in duration-200">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            All Resources Destroyed
          </h2>
          <p className="text-slate-400 mb-6">
            All cloud resources have been successfully terminated. Your account
            balance will be updated within 24 hours.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================
// Main Kill Switch Component
// ============================================

export default function KillSwitch() {
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Handle OTP confirmation
  const handleOTPConfirm = () => {
    setIsOTPModalOpen(false);
    setIsSuccessModalOpen(true);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Warning banner */}
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              Emergency Shutdown
            </h2>
            <p className="text-sm text-slate-400">
              The Kill Switch will permanently destroy all cloud resources
              including EC2 instances, S3 buckets, RDS databases, and any
              associated data. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>

      {/* Kill Switch Button Container */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center">
        {/* Resource summary */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-slate-900/50 rounded-xl">
          <div>
            <div className="text-2xl font-bold text-blue-400">24</div>
            <div className="text-xs text-slate-500">EC2 Instances</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">18</div>
            <div className="text-xs text-slate-500">S3 Buckets</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400">6</div>
            <div className="text-xs text-slate-500">RDS Databases</div>
          </div>
        </div>

        {/* Big red button */}
        <div className="relative inline-block">
          {/* Outer glow effect */}
          <div
            className={`absolute inset-0 bg-red-500 rounded-full blur-xl transition-opacity duration-300 ${
              isPressed ? 'opacity-50' : 'opacity-20'
            }`}
          />

          {/* Button */}
          <button
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            onClick={() => setIsOTPModalOpen(true)}
            className={`relative w-48 h-48 rounded-full bg-gradient-to-b from-red-500 to-red-700 border-4 border-red-400/50 shadow-2xl flex flex-col items-center justify-center gap-3 transition-all duration-150 hover:from-red-400 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/50 ${
              isPressed ? 'scale-95 shadow-lg' : 'scale-100'
            }`}
          >
            <Power size={48} className="text-white" />
            <span className="text-white font-bold text-lg">DESTROY ALL</span>
          </button>
        </div>

        {/* Warning text */}
        <p className="text-red-400 text-sm font-medium mt-8">
          ⚠️ This action is irreversible
        </p>
        <p className="text-slate-500 text-xs mt-2">
          You will be asked to verify with OTP before proceeding
        </p>
      </div>

      {/* Additional info */}
      <div className="mt-6 p-4 bg-slate-800/30 border border-slate-700/30 rounded-xl">
        <h3 className="text-sm font-medium text-slate-300 mb-2">
          What will be destroyed:
        </h3>
        <ul className="text-xs text-slate-500 space-y-1">
          <li>• All running EC2 instances will be terminated</li>
          <li>• All S3 buckets and their contents will be deleted</li>
          <li>• All RDS databases will be permanently deleted</li>
          <li>• Associated EBS volumes, snapshots, and backups</li>
          <li>• Elastic IPs, Load Balancers, and other resources</li>
        </ul>
      </div>

      {/* OTP Modal */}
      <OTPModal
        isOpen={isOTPModalOpen}
        onClose={() => setIsOTPModalOpen(false)}
        onConfirm={handleOTPConfirm}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
      />
    </div>
  );
}
