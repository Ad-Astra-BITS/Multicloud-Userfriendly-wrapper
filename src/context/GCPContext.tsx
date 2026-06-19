'use client';

/**
 * GCPContext.tsx
 *
 * React context managing the user's Google Cloud Platform credential state for the session.
 * Mirrors AWSContext.tsx and DOContext.tsx — same patterns, same session-storage approach.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  GCPStoredCredentials,
  saveGCPCredentials,
  loadGCPCredentials,
  clearGCPCredentials,
} from '@/lib/gcpApi';

// ── Context shape ──────────────────────────────────────────────────────────

interface GCPContextValue {
  isConnected: boolean;
  credentials: GCPStoredCredentials | null;
  connect: (creds: GCPStoredCredentials) => void;
  disconnect: () => void;
  connectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
}

const GCPContext = createContext<GCPContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function GCPContextProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<GCPStoredCredentials | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Hydrate from sessionStorage on mount (client-side only)
  useEffect(() => {
    const stored = loadGCPCredentials();
    if (stored) setCredentials(stored);
  }, []);

  const connect = useCallback((creds: GCPStoredCredentials) => {
    const withTimestamp: GCPStoredCredentials = {
      ...creds,
      connectedAt: new Date().toISOString(),
    };
    saveGCPCredentials(withTimestamp);
    setCredentials(withTimestamp);
    setConnectModalOpen(false);
  }, []);

  const disconnect = useCallback(() => {
    clearGCPCredentials();
    setCredentials(null);
  }, []);

  const openConnectModal = useCallback(() => setConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setConnectModalOpen(false), []);

  return (
    <GCPContext.Provider
      value={{
        isConnected: credentials !== null,
        credentials,
        connect,
        disconnect,
        connectModalOpen,
        openConnectModal,
        closeConnectModal,
      }}
    >
      {children}
    </GCPContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useGCP(): GCPContextValue {
  const ctx = useContext(GCPContext);
  if (!ctx) throw new Error('useGCP must be used inside <GCPContextProvider>');
  return ctx;
}
