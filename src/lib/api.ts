/**
 * api.ts
 *
 * Centralised API client for Ad Astra.
 * Reads AWS credentials from sessionStorage and injects them as headers
 * on every request so the backend can create per-request AWS SDK clients.
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const data = await api.get('/resources');
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// ── Credential storage key ─────────────────────────────────────────────────

const CREDS_KEY = 'ad_astra_aws_credentials';

export interface StoredCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  accountId?: string;
  connectedAt?: string;
}

export function saveCredentials(creds: StoredCredentials): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(CREDS_KEY, JSON.stringify(creds));
}

export function loadCredentials(): StoredCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CREDS_KEY);
    return raw ? (JSON.parse(raw) as StoredCredentials) : null;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CREDS_KEY);
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

function buildHeaders(extra?: Record<string, string>): HeadersInit {
  const creds = loadCredentials();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };

  if (creds) {
    headers['x-aws-access-key-id'] = creds.accessKeyId;
    headers['x-aws-secret-access-key'] = creds.secretAccessKey;
    headers['x-aws-region'] = creds.region;
  }

  return headers;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers: buildHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }

  return json.data as T;
}

// ── Typed API surface ──────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ── AWS credential validation (calls /api/aws/validate) ──────────────────

export interface AccountInfo {
  accountId: string;
  arn: string;
  userId: string;
  region: string;
}

export async function validateAwsCredentials(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
): Promise<AccountInfo> {
  const res = await fetch(`${BASE_URL}/aws/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-aws-access-key-id': accessKeyId,
      'x-aws-secret-access-key': secretAccessKey,
      'x-aws-region': region,
    },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Credential validation failed');
  }

  return json.data as AccountInfo;
}
