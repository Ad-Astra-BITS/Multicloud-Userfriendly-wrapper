'use client';

/**
 * DOContext.tsx
 *
 * React context managing the user's DigitalOcean credential state for the session.
 * Mirrors AWSContext.tsx exactly — same patterns, same session-storage approach.
 *
 * Provides:
 *   isConnected        — whether valid DO credentials are stored
 *   credentials        — the active DOStoredCredentials bundle (or null)
 *   connect(creds)     — save credentials and mark connected
 *   disconnect()       — clear credentials
 *   connectModalOpen   — whether the ConnectDOModal is visible
 *   openConnectModal() — trigger the modal from anywhere in the tree
 *   closeConnectModal()
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  DOStoredCredentials,
  saveDOCredentials,
  loadDOCredentials,
  clearDOCredentials,
} from '@/lib/doApi';

// ── Context shape ──────────────────────────────────────────────────────────

interface DOContextValue {
  isConnected: boolean;
  credentials: DOStoredCredentials | null;
  connect: (creds: DOStoredCredentials) => void;
  disconnect: () => void;
  connectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
}

const DOContext = createContext<DOContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function DOContextProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<DOStoredCredentials | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Hydrate from sessionStorage on mount (client-side only)
  useEffect(() => {
    const stored = loadDOCredentials();
    if (stored) setCredentials(stored);
  }, []);

  const connect = useCallback((creds: DOStoredCredentials) => {
    const withTimestamp: DOStoredCredentials = {
      ...creds,
      connectedAt: new Date().toISOString(),
    };
    saveDOCredentials(withTimestamp);
    setCredentials(withTimestamp);
    setConnectModalOpen(false);
  }, []);

  const disconnect = useCallback(() => {
    clearDOCredentials();
    setCredentials(null);
  }, []);

  const openConnectModal = useCallback(() => setConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setConnectModalOpen(false), []);

  return (
    <DOContext.Provider
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
    </DOContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useDO(): DOContextValue {
  const ctx = useContext(DOContext);
  if (!ctx) throw new Error('useDO must be used inside <DOContextProvider>');
  return ctx;
}
