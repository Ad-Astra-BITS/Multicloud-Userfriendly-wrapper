'use client';

import axios, { AxiosInstance } from 'axios';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api');

const GCP_CREDS_KEY = 'ad_astra_gcp_credentials';

export interface GCPStoredCredentials {
  projectId: string;
  credentialsBase64?: string;
  connectedAt?: string;
}

export function saveGCPCredentials(creds: GCPStoredCredentials): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(GCP_CREDS_KEY, JSON.stringify(creds));
}

export function loadGCPCredentials(): GCPStoredCredentials | null {
  if (typeof window === 'undefined') return null;
  try { const raw = sessionStorage.getItem(GCP_CREDS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function clearGCPCredentials(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(GCP_CREDS_KEY);
}

function createGCPClient(): AxiosInstance {
  const client = axios.create({ baseURL: `${BASE_URL}/gcp`, timeout: 30_000, headers: { 'Content-Type': 'application/json' } });
  client.interceptors.request.use((config) => {
    const creds = loadGCPCredentials();
    if (creds) { config.headers['x-gcp-project-id'] = creds.projectId; if (creds.credentialsBase64) config.headers['x-gcp-credentials'] = creds.credentialsBase64; }
    return config;
  });
  client.interceptors.response.use(
    (r) => { if (r.data && !r.data.success) return Promise.reject(new Error(r.data.error ?? 'Request failed')); return r; },
    (e) => Promise.reject(new Error(e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? 'Request failed')),
  );
  return client;
}

export const gcpClient = createGCPClient();

async function get<T>(path: string): Promise<T> { return (await gcpClient.get<{ success: boolean; data: T }>(path)).data.data; }
async function post<T>(path: string, body?: unknown): Promise<T> { return (await gcpClient.post<{ success: boolean; data: T }>(path, body ?? {})).data.data; }
async function del<T>(path: string): Promise<T> { return (await gcpClient.delete<{ success: boolean; data: T }>(path)).data.data; }

export interface GCPProjectInfo { projectId: string; }

export async function validateGCPCredentials(projectId: string, credentialsBase64?: string): Promise<GCPProjectInfo> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-gcp-project-id': projectId };
  if (credentialsBase64) headers['x-gcp-credentials'] = credentialsBase64;
  const res = await axios.post<{ success: boolean; data: GCPProjectInfo; message?: string }>(`${BASE_URL}/gcp/validate`, {}, { headers, timeout: 15_000 });
  if (!res.data.success) throw new Error(res.data.message ?? 'Validation failed');
  return res.data.data;
}

export interface GCPInstance {
  id: string; name: string; status: string; zone: string; machineType: string;
  vcpus: number; memory: number; diskSizeGb: number; price_monthly: number;
  externalIp?: string; internalIp?: string; labels?: Record<string, string>;
}

export const gcpInstancesApi = {
  list: () => get<GCPInstance[]>('/instances'),
  stop: (zone: string, name: string) => post<null>(`/instances/${zone}/${name}/stop`),
  start: (zone: string, name: string) => post<null>(`/instances/${zone}/${name}/start`),
  delete: (instances: Array<{ zone: string; name: string }>) => post<null>('/instances/delete', { instances }),
};

export interface GCPBucket { name: string; location: string; storageClass: string; createdAt?: string; }
export const gcpBucketsApi = { list: () => get<GCPBucket[]>('/buckets'), delete: (name: string) => del<null>(`/buckets/${name}`) };

export interface GCPSqlInstance { name: string; databaseVersion: string; state: string; region: string; tier: string; monthlyCost: number; dataDiskSizeGb: number; ipAddresses?: string[]; }
export const gcpSqlApi = { list: () => get<GCPSqlInstance[]>('/sql') };

export interface GCPBillingInfo { monthToDate: number; monthlyCosts: Array<{ month: string; cost: number }>; }
export const gcpBillingApi = { estimate: () => get<GCPBillingInfo>('/billing') };
