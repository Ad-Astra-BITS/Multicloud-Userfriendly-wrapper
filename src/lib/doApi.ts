'use client';

import axios, { AxiosInstance } from 'axios';

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api');

// ── Credential storage ─────────────────────────────────────────────────────

const DO_CREDS_KEY = 'ad_astra_do_credentials';

export interface DOStoredCredentials {
  apiToken: string;
  spacesKey?: string;
  spacesSecret?: string;
  spacesRegion?: string;
  /** The account email returned by GET /v2/account — used for display only */
  email?: string;
  /** DO account UUID — used as the "Account ID" equivalent */
  uuid?: string;
  connectedAt?: string;
}

export function saveDOCredentials(creds: DOStoredCredentials): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DO_CREDS_KEY, JSON.stringify(creds));
}

export function loadDOCredentials(): DOStoredCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DO_CREDS_KEY);
    return raw ? (JSON.parse(raw) as DOStoredCredentials) : null;
  } catch {
    return null;
  }
}

export function clearDOCredentials(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DO_CREDS_KEY);
}

function createDOClient(): AxiosInstance {
  const client = axios.create({
    baseURL: `${BASE_URL}/do`,
    timeout: 30_000,
    headers: { 'Content-Type': 'application/json' },
  });

  // Inject fresh credentials on every request
  client.interceptors.request.use((config) => {
    const creds = loadDOCredentials();
    if (creds) {
      config.headers['x-do-api-token'] = creds.apiToken;
      if (creds.spacesKey) config.headers['x-do-spaces-key'] = creds.spacesKey;
      if (creds.spacesSecret) config.headers['x-do-spaces-secret'] = creds.spacesSecret;
      if (creds.spacesRegion) config.headers['x-do-spaces-region'] = creds.spacesRegion;
    }
    return config;
  });

  // Unwrap the ApiResponse envelope and surface errors cleanly
  client.interceptors.response.use(
    (response) => {
      // Backend wraps everything in { success, data, error, message }
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

export const doClient = createDOClient();

// ── Typed API methods ──────────────────────────────────────────────────────

/** Unwraps `{ success, data }` response envelope and returns `data` */
async function get<T>(path: string): Promise<T> {
  const res = await doClient.get<{ success: boolean; data: T }>(path);
  return res.data.data;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await doClient.post<{ success: boolean; data: T; message?: string }>(path, body ?? {});
  return res.data.data;
}

async function del<T>(path: string): Promise<T> {
  const res = await doClient.delete<{ success: boolean; data: T; message?: string }>(path);
  return res.data.data;
}

// ── Account validation ─────────────────────────────────────────────────────

export interface DOAccountInfo {
  email: string;
  uuid: string;
  status: string;
  dropletLimit: number;
  emailVerified: boolean;
}

export async function validateDOToken(apiToken: string): Promise<DOAccountInfo> {
  const res = await axios.post<{ success: boolean; data: DOAccountInfo; message?: string }>(
    `${BASE_URL}/do/validate`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
        'x-do-api-token': apiToken,
      },
      timeout: 15_000,
    },
  );
  if (!res.data.success) throw new Error(res.data.message ?? 'Validation failed');
  return res.data.data;
}

// ── Droplets ───────────────────────────────────────────────────────────────

export interface DODroplet {
  id: number;
  name: string;
  status: 'active' | 'off' | 'archive';
  region: string;
  vcpus: number;
  memory: number;
  disk: number;
  price_monthly: number;
  ip_address?: string;
  tags?: string[];
}

export interface DODropletMetrics {
  dropletId: number;
  cpuPercent: number;
  memoryPercent: number;
  timestamp: string;
}

export const doDropletsApi = {
  list: () => get<DODroplet[]>('/droplets'),
  metrics: (id: number) => get<DODropletMetrics>(`/droplets/${id}/metrics`),
  terminate: (dropletIds: number[]) => post<null>('/droplets/terminate', { dropletIds }),
};

// ── Spaces ─────────────────────────────────────────────────────────────────

export interface DOSpace {
  name: string;
  region: string;
  creationDate?: string;
}

export const doSpacesApi = {
  list: () => get<DOSpace[]>('/spaces'),
  optimize: (region: string, name: string, expiryDays?: number) =>
    post<null>(`/spaces/${region}/${name}/optimize`, expiryDays !== undefined ? { expiryDays } : {}),
  delete: (region: string, name: string) => del<null>(`/spaces/${region}/${name}`),
};

// ── Databases ──────────────────────────────────────────────────────────────

export interface DODatabase {
  id: string;
  name: string;
  engine: string;
  version: string;
  status: string;
  region: string;
  numNodes: number;
  sizeSlug: string;
  monthlyCost: number;
}

export interface DODatabaseStopResult {
  action: 'snapshot_and_destroy' | 'manual_required';
  message: string;
  dbId: string;
  snapshot?: unknown;
}

export const doDatabasesApi = {
  list: () => get<DODatabase[]>('/databases'),
  stop: (id: string, confirmDestroy = false) =>
    post<DODatabaseStopResult>(`/databases/${id}/stop`, { confirmDestroy }),
};

// ── Billing ────────────────────────────────────────────────────────────────

export interface DOInvoice {
  invoiceUuid: string;
  amount: string;
  invoicePeriod: string;
  updatedAt: string;
}

export interface DOBillingHistory {
  monthToDate: number;
  accountBalance: number;
  invoices: DOInvoice[];
}

export const doBillingApi = {
  history: () => get<DOBillingHistory>('/billing'),
};
