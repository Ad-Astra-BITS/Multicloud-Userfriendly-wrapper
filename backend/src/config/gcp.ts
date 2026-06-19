import { InstancesClient, ZoneOperationsClient } from '@google-cloud/compute';
import { Storage } from '@google-cloud/storage';
import { CloudBillingClient } from '@google-cloud/billing';

/** GCP regions commonly used */
export const GCP_REGIONS = [
  'us-central1',
  'us-east1',
  'us-east4',
  'us-west1',
  'us-west2',
  'europe-west1',
  'europe-west2',
  'europe-west3',
  'asia-east1',
  'asia-southeast1',
  'asia-northeast1',
  'australia-southeast1',
  'southamerica-east1',
] as const;

export type GcpRegion = (typeof GCP_REGIONS)[number];

export interface GcpCredentials {
  /** GCP project ID */
  projectId: string;
  /** Service account key JSON (parsed object) */
  clientEmail?: string;
  privateKey?: string;
}

export interface GcpClients {
  compute: InstancesClient;
  zoneOperations: ZoneOperationsClient;
  storage: Storage;
  projectId: string;
}

/**
 * Creates GCP client instances from the provided credentials.
 * Uses service account key credentials when available, otherwise
 * falls back to Application Default Credentials (ADC).
 */
export function createGcpClients(creds: GcpCredentials): GcpClients {
  const authOptions =
    creds.clientEmail && creds.privateKey
      ? {
          credentials: {
            client_email: creds.clientEmail,
            private_key: creds.privateKey,
          },
          projectId: creds.projectId,
        }
      : { projectId: creds.projectId };

  const compute = new InstancesClient(authOptions);
  const zoneOperations = new ZoneOperationsClient(authOptions);
  const storage = new Storage(authOptions);

  return { compute, zoneOperations, storage, projectId: creds.projectId };
}

// ── Module-level singleton clients (env-var / ADC credentials) ───────────

export const defaultGcpClients = createGcpClients({
  projectId: process.env.GCP_PROJECT_ID ?? '',
  clientEmail: process.env.GCP_CLIENT_EMAIL,
  privateKey: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
});
