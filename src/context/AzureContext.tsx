'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AzureStoredCredentials, saveAzureCredentials, loadAzureCredentials, clearAzureCredentials } from '@/lib/azureApi';

interface AzureContextValue {
  isConnected: boolean;
  credentials: AzureStoredCredentials | null;
  connect: (creds: AzureStoredCredentials) => void;
  disconnect: () => void;
  connectModalOpen: boolean;
  openConnectModal: () => void;
  closeConnectModal: () => void;
}

const AzureContext = createContext<AzureContextValue | null>(null);

export function AzureContextProvider({ children }: { children: React.ReactNode }) {
  const [credentials, setCredentials] = useState<AzureStoredCredentials | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  useEffect(() => {
    const stored = loadAzureCredentials();
    if (stored) setCredentials(stored);
  }, []);

  const connect = useCallback((creds: AzureStoredCredentials) => {
    const withTimestamp: AzureStoredCredentials = { ...creds, connectedAt: new Date().toISOString() };
    saveAzureCredentials(withTimestamp);
    setCredentials(withTimestamp);
    setConnectModalOpen(false);
  }, []);

  const disconnect = useCallback(() => { clearAzureCredentials(); setCredentials(null); }, []);
  const openConnectModal = useCallback(() => setConnectModalOpen(true), []);
  const closeConnectModal = useCallback(() => setConnectModalOpen(false), []);

  return (
    <AzureContext.Provider value={{ isConnected: credentials !== null, credentials, connect, disconnect, connectModalOpen, openConnectModal, closeConnectModal }}>
      {children}
    </AzureContext.Provider>
  );
}

export function useAzure(): AzureContextValue {
  const ctx = useContext(AzureContext);
  if (!ctx) throw new Error('useAzure must be used inside <AzureContextProvider>');
  return ctx;
}
