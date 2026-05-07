import axios, { AxiosInstance } from 'axios';
import { S3Client } from '@aws-sdk/client-s3';

/** DigitalOcean v2 REST API base URL */
export const DO_API_BASE = 'https://api.digitalocean.com/v2';

export const DO_SPACES_REGIONS = [
  'nyc3',
  'sfo2',
  'sfo3',
  'ams3',
  'sgp1',
  'fra1',
  'tor1',
  'blr1',
  'syd1',
] as const;

export type DOSpacesRegion = (typeof DO_SPACES_REGIONS)[number];

export interface DoCredentials {
  /** Personal Access Token — authorises all DO v2 REST API calls */
  apiToken: string;
  /** Spaces access key — generated separately from the PAT */
  spacesKey?: string;
  /** Spaces secret key — paired with spacesKey */
  spacesSecret?: string;
  spacesRegion?: DOSpacesRegion;
}

export function createDoApiClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: DO_API_BASE,
    timeout: 30_000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Creates an AWS S3Client pointed at a specific DigitalOcean Spaces regional endpoint.
 *
 * DO Spaces exposes the full S3-compatible API at:
 *   https://{region}.digitaloceanspaces.com
 *
 * Because we reuse @aws-sdk/client-s3 (already a project dependency), we get
 * all S3 primitives — ListBuckets, PutLifecycleConfiguration, DeleteBucket, etc. —
 * without adding a new library. The only difference is the custom endpoint URL.
 *
 * @param key     DO Spaces access key (from the Spaces keys panel)
 * @param secret  DO Spaces secret key
 * @param region  DO region slug, e.g. 'nyc3', 'sfo3', 'fra1'
 */
export function createSpacesClient(key: string, secret: string, region = 'nyc3'): S3Client {
  return new S3Client({
    endpoint: `https://${region}.digitaloceanspaces.com`,
    // DO Spaces SigV4 credential scope uses the endpoint region slug
    // (e.g. nyc3, sfo3): ACCESS_KEY/DATE/{REGION}/s3/aws4_request
    // so we sign with the same region as the endpoint host.
    region,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: false,
  });
}

// ── Module-level singleton clients (env-var credentials) ─────────────────────
// These are used as fallbacks when no per-request credentials are provided.

/** Default DO API Axios client, backed by the DO_API_TOKEN environment variable */
export const doApiClient = createDoApiClient(process.env.DO_API_TOKEN ?? '');

/** Default Spaces S3Client, backed by DO_SPACES_* environment variables */
export const defaultSpacesClient = createSpacesClient(
  process.env.DO_SPACES_KEY ?? '',
  process.env.DO_SPACES_SECRET ?? '',
  (process.env.DO_SPACES_REGION as DOSpacesRegion) ?? 'nyc3',
);
