'use client';

/**
 * AWSContext.tsx
 *
 * React context that manages the user's AWS credential state for the session.
 * Credentials are stored in sessionStorage (cleared when the browser tab closes).
 *
 * Provides:
 *   - isConnected: boolean — whether valid credentials are stored
 *   - credentials: StoredCredentials | null — the active credentials
 *   - connect(creds): void — save credentials and mark connected
 *   - disconnect(): void — clear credentials
 *   - openConnectModal(): void — trigger the ConnectAWSModal from anywhere
 *   - closeConnectModal(): void
 *   - connectModalOpen: boolean
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import {
  StoredCredentials,
  saveCredentials,
  loadCredentials,
  clearCredentials,
} from '@/lib/api';

// ── Context shape ──────────────────────────────────────────────────────────

interface AWSContextValue {
  isConnected: boolean;
  credentials: StoredCredentials | null;
  connect: (creds: StoredCredentials) => void;
  disconnect: () => void;
  connectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
}

const AWSContext = createContext<AWSContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function AWSContextProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<StoredCredentials | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const stored = loadCredentials();
    if (stored) setCredentials(stored);
  }, []);

  const connect = useCallback((creds: StoredCredentials) => {
    const withTimestamp: StoredCredentials = {
      ...creds,
      connectedAt: new Date().toISOString(),
    };
    saveCredentials(withTimestamp);
    setCredentials(withTimestamp);
    setConnectModalOpen(false);
  }, []);

  const disconnect = useCallback(() => {
    clearCredentials();
    setCredentials(null);
  }, []);

  const openConnectModal = useCallback(() => setConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setConnectModalOpen(false), []);

  return (
    <AWSContext.Provider
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
    </AWSContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAWS(): AWSContextValue {
  const ctx = useContext(AWSContext);
  if (!ctx) throw new Error('useAWS must be used inside <AWSContextProvider>');
  return ctx;
}
