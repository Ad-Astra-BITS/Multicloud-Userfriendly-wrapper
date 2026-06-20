import { InstancesClient, ZoneOperationsClient } from '@google-cloud/compute';
import { Storage } from '@google-cloud/storage';

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
  projectId: string;
  clientEmail?: string;
  privateKey?: string;
}

export interface GcpClients {
  compute: InstancesClient;
  zoneOperations: ZoneOperationsClient;
  storage: Storage;
  projectId: string;
}

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

  return {
    compute: new InstancesClient(authOptions),
    zoneOperations: new ZoneOperationsClient(authOptions),
    storage: new Storage(authOptions),
    projectId: creds.projectId,
  };
}

export const defaultGcpClients = createGcpClients({
  projectId: process.env.GCP_PROJECT_ID ?? '',
  clientEmail: process.env.GCP_CLIENT_EMAIL,
  privateKey: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, '\n'),
});
