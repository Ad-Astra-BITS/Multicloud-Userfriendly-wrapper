'use client';

import axios, { AxiosInstance } from 'axios';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api');

// ── Credential storage ─────────────────────────────────────────────────────

const AZURE_CREDS_KEY = 'ad_astra_azure_credentials';

export interface AzureStoredCredentials {
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  connectedAt?: string;
}

export function saveAzureCredentials(creds: AzureStoredCredentials): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AZURE_CREDS_KEY, JSON.stringify(creds));
}

export function loadAzureCredentials(): AzureStoredCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AZURE_CREDS_KEY);
    return raw ? (JSON.parse(raw) as AzureStoredCredentials) : null;
  } catch { return null; }
}

export function clearAzureCredentials(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AZURE_CREDS_KEY);
}

function createAzureClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${BASE_URL}/azure`,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const creds = loadAzureCredentials();
    if (creds) {
      config.headers['x-azure-subscription-id'] = creds.subscriptionId;
      config.headers['x-azure-tenant-id'] = creds.tenantId;
      config.headers['x-azure-client-id'] = creds.clientId;
      config.headers['x-azure-client-secret'] = creds.clientSecret;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => {
      if (response.data && !response.data.success) {
        return Promise.reject(new Error(response.data.error ?? 'Request failed'));
      }
      return response;
    },
    (error) => {
      const msg =
        error.response?.data?.error ??
        error.response?.data?.message ??
        error.message ??
        'Request failed';
      return Promise.reject(new Error(msg));
    },
  );

  return client;
}

export const azureClient = createAzureClient();

// ── Typed API methods ──────────────────────────────────────────────────────

async function get<T>(path: string): Promise<T> {
  const res = await azureClient.get<{ success: boolean; data: T }>(path);
  return res.data.data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await azureClient.post<{ success: boolean; data: T; message?: string }>(path, body ?? {});
  return res.data.data;
}

async function del<T>(path: string): Promise<T> {
  const res = await azureClient.delete<{ success: boolean; data: T; message?: string }>(path);
  return res.data.data;
}

// ── Account validation ─────────────────────────────────────────────────────

export interface AzureSubscriptionInfo {
  subscriptionId: string;
}

export async function validateAzureCredentials(
  subscriptionId: string,
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<AzureSubscriptionInfo> {
  const res = await axios.post<{ success: boolean; data: AzureSubscriptionInfo; message?: string }>(
    `${BASE_URL}/azure/validate`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'x-azure-subscription-id': subscriptionId,
        'x-azure-tenant-id': tenantId,
        'x-azure-client-id': clientId,
        'x-azure-client-secret': clientSecret,
      },
      timeout: 15_000,
    },
  );
  if (!res.data.success) throw new Error(res.data.message ?? 'Validation failed');
  return res.data.data;
}

// ── Virtual Machines ───────────────────────────────────────────────────────

export interface AzureVM {
  id: string;
  name: string;
  status: 'Running' | 'Deallocated' | 'Stopped' | 'Deallocating' | 'Starting' | 'Unknown';
  location: string;
  resourceGroup: string;
  vmSize: string;
  vcpus: number;
  memory: number;
  osDiskSizeGb: number;
  price_monthly: number;
  publicIp?: string;
  privateIp?: string;
  tags?: Record<string, string>;
}

export const azureVMsApi = {
  list: () => get<AzureVM[]>('/vms'),
  deallocate: (resourceGroup: string, name: string) =>
    post<null>(`/vms/${resourceGroup}/${name}/deallocate`),
  start: (resourceGroup: string, name: string) =>
    post<null>(`/vms/${resourceGroup}/${name}/start`),
  delete: (vms: Array<{ resourceGroup: string; name: string }>) =>
    post<null>('/vms/delete', { vms }),
};

// ── Storage Accounts ───────────────────────────────────────────────────────

export interface AzureStorageAccount {
  id: string;
  name: string;
  location: string;
  resourceGroup: string;
  kind: string;
  skuName: string;
  accessTier: string;
  createdAt?: string;
}

export const azureStorageApi = {
  list: () => get<AzureStorageAccount[]>('/storage'),
  delete: (resourceGroup: string, name: string) =>
    del<null>(`/storage/${resourceGroup}/${name}`),
};

// ── SQL Databases ──────────────────────────────────────────────────────────

export interface AzureSqlDatabase {
  id: string;
  name: string;
  serverName: string;
  resourceGroup: string;
  location: string;
  status: string;
  sku: string;
  maxSizeGb: number;
  monthlyCost: number;
}

export const azureSqlApi = {
  list: () => get<AzureSqlDatabase[]>('/sql'),
};

// ── Billing ────────────────────────────────────────────────────────────────

export interface AzureBillingInfo {
  monthToDate: number;
  monthlyCosts: Array<{ month: string; cost: number }>;
}

export const azureBillingApi = {
  info: () => get<AzureBillingInfo>('/billing'),
};
