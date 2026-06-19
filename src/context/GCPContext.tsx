'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GCPStoredCredentials, saveGCPCredentials, loadGCPCredentials, clearGCPCredentials } from '@/lib/gcpApi';

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

export function GCPContextProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<GCPStoredCredentials | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  useEffect(() => { const stored = loadGCPCredentials(); if (stored) setCredentials(stored); }, []);

  const connect = useCallback((creds: GCPStoredCredentials) => {
    const withTimestamp = { ...creds, connectedAt: new Date().toISOString() };
    saveGCPCredentials(withTimestamp);
    setCredentials(withTimestamp);
    setConnectModalOpen(false);
  }, []);

  const disconnect = useCallback(() => { clearGCPCredentials(); setCredentials(null); }, []);
  const openConnectModal = useCallback(() => setConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setConnectModalOpen(false), []);

  return (
    <GCPContext.Provider value={{ isConnected: credentials !== null, credentials, connect, disconnect, connectModalOpen, openConnectModal, closeConnectModal }}>
      {children}
    </GCPContext.Provider>
  );
}

export function useGCP(): GCPContextValue {
  const ctx = useContext(GCPContext);
  if (!ctx) throw new Error('useGCP must be used inside <GCPContextProvider>');
  return ctx;
}
