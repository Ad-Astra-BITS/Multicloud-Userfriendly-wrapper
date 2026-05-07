import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteBucketCommand,
} from '@aws-sdk/client-s3';
import {
  DoCredentials,
  DOSpacesRegion,
  DO_SPACES_REGIONS,
  createDoApiClient,
  createSpacesClient,
} from '../config/digitalocean';
import {
  DODropletResource,
  DODropletMetrics,
  DOSpaceResource,
  DODatabaseResource,
  DODatabaseStopResult,
  DOBillingHistory,
  DOInvoice,
  DODatabaseEngine,
  DODatabaseStatus,
  DODropletStatus,
} from '../types';

export class DigitalOceanApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`DigitalOcean API Error (${status}): ${message}`);
    this.name = 'DigitalOceanApiError';
  }
}

const MAX_RETRIES = 4;

const BASE_DELAY_MS = 500;

/**
 * Executes a DO API call with automatic exponential-backoff retry.
 *
 * Retries on:
 *   - HTTP 429 (rate limited) — respects the Retry-After header when present.
 *   - HTTP 500, 502, 503, 504 — transient server errors that may resolve on retry.
 *
 * Throws immediately on:
 *   - HTTP 4xx (except 429) — auth failures, bad requests, and 404s will not
 *     resolve with retries and should surface as errors right away.
 *   - Non-HTTP errors — network failures, timeouts beyond the Axios limit, etc.
 *
 * @param fn         Factory function that returns the Axios promise to attempt.
 * @param attempt    Internal recursion counter — callers should omit this.
 */
async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Non-Axios errors (e.g. programming errors) bubble up immediately
    if (!axios.isAxiosError(err)) throw err;

    const axiosErr = err as AxiosError<{ message?: string; id?: string }>;
    const status = axiosErr.response?.status ?? 0;
    // DO error responses carry a human-readable `message` field
    const doMessage = axiosErr.response?.data?.message ?? axiosErr.message;

    // Client errors (except rate-limit) will not be fixed by retrying
    if (status >= 400 && status < 500 && status !== 429) {
      throw new DigitalOceanApiError(status, doMessage);
    }

    // Give up once we've exhausted our retry budget
    if (attempt >= MAX_RETRIES) {
      throw new DigitalOceanApiError(
        status || 500,
        `Max retries exceeded. Last error: ${doMessage}`,
      );
    }

    // Calculate delay: prefer Retry-After header on 429, else exponential backoff
    let delayMs = BASE_DELAY_MS * 2 ** attempt;
    if (status === 429) {
      const retryAfter = axiosErr.response?.headers?.['retry-after'];
      if (retryAfter) delayMs = parseInt(String(retryAfter), 10) * 1000;
    }

    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    return withRetry(fn, attempt + 1);
  }
}

interface RawDroplet {
  id: number;
  name: string;
  status: 'new' | 'active' | 'off' | 'archive';
  vcpus: number;
  memory: number; // MB
  disk: number;   // GB
  region: { slug: string };
  networks?: {
    v4?: Array<{ ip_address: string; type: 'public' | 'private' }>;
  };
  size: { price_monthly: number };
  tags?: string[];
}

interface RawMetricsResponse {
  status: 'success' | 'error';
  data: {
    result: Array<{
      metric: Record<string, string>;
      values: Array<[number, string]>;
    }>;
  };
}

/** Partial DO v2 Database cluster shape */
interface RawDatabase {
  id: string;
  name: string;
  engine: string;
  version: string;
  status: string;
  region: string;
  num_nodes: number;
  size: string;
  maintenance_window?: { day: string; hour: string };
}

/** DO v2 invoice summary item from GET /v2/customers/my/invoices */
interface RawInvoiceSummary {
  invoice_uuid: string;
  amount: string;
  invoice_period: string;
  updated_at: string;
}

/** DO v2 account balance from GET /v2/customers/my/balance */
interface RawBalance {
  month_to_date_usage: string;
  account_balance: string;
  month_to_date_balance: string;
  generated_at: string;
}

const DB_SIZE_COST_MAP: Record<string, number> = {
  'db-s-1vcpu-1gb':   15,
  'db-s-1vcpu-2gb':   25,
  'db-s-2vcpu-4gb':   50,
  'db-s-4vcpu-8gb':  100,
  'db-s-6vcpu-16gb': 200,
  'db-s-8vcpu-32gb': 400,
  'db-s-16vcpu-64gb':800,
  // General Purpose
  'gd-2vcpu-8gb':     65,
  'gd-4vcpu-16gb':   130,
  'gd-8vcpu-32gb':   260,
  'gd-16vcpu-64gb':  520,
  // Memory Optimised
  'm3-2vcpu-16gb':   100,
  'm3-4vcpu-32gb':   200,
  'm3-8vcpu-64gb':   400,
};

function estimateDbMonthlyCost(sizeSlug: string): number {
  return DB_SIZE_COST_MAP[sizeSlug] ?? 0;
}

export class DigitalOceanResourceService {
  private readonly api: AxiosInstance;
  private readonly spacesKey?: string;
  private readonly spacesSecret?: string;
  private readonly defaultSpacesRegion: DOSpacesRegion;

  /**
   * @param creds  DO credentials bundle.
   *               `apiToken` is mandatory for all operations.
   *               `spacesKey` and `spacesSecret` are required only for Spaces operations.
   */
  constructor(creds: DoCredentials) {
    this.api = createDoApiClient(creds.apiToken);
    this.spacesKey = creds.spacesKey;
    this.spacesSecret = creds.spacesSecret;
    this.defaultSpacesRegion = creds.spacesRegion ?? 'nyc3';
  }

  private getSpacesClient(region: string): S3Client {
    if (!this.spacesKey || !this.spacesSecret) {
      throw new DigitalOceanApiError(
        401,
        'DigitalOcean Spaces credentials are required for this operation. ' +
          'Provide x-do-spaces-key and x-do-spaces-secret request headers.',
      );
    }
    return createSpacesClient(this.spacesKey, this.spacesSecret, region);
  }

  async getDroplets(): Promise<DODropletResource[]> {
    const droplets: RawDroplet[] = [];
    let page = 1;

    while (true) {
      const res = await withRetry(() =>
        this.api.get<{
          droplets: RawDroplet[];
          links?: { pages?: { next?: string } };
        }>('/droplets', { params: { page, per_page: 100 } }),
      );

      droplets.push(...res.data.droplets);

      if (!res.data.links?.pages?.next) break;
      page++;
    }

    return droplets.map(
      (d): DODropletResource => ({
        id: d.id,
        name: d.name,
        status: (['active', 'off', 'archive'] as DODropletStatus[]).includes(
          d.status as DODropletStatus,
        )
          ? (d.status as DODropletStatus)
          : 'off', // 'new' (provisioning) is treated as 'off' until ready
        region: d.region.slug,
        vcpus: d.vcpus,
        memory: d.memory,
        disk: d.disk,
        price_monthly: d.size.price_monthly,
        ip_address: d.networks?.v4?.find((n) => n.type === 'public')?.ip_address,
        tags: d.tags ?? [],
      }),
    );
  }

  /**
   * Fetches live CPU and memory utilisation for a single Droplet over the last hour.
   *
   * Uses the DO Monitoring API, which returns Prometheus-compatible time-series data.
   * Ad Astra averages all data points in the 1-hour window to produce a single
   * representative value — matching the approach used for AWS CloudWatch metrics.
   *
   * PREREQUISITE: The `do-agent` (DO Monitoring) must be installed and running on
   * the Droplet, otherwise the Monitoring API returns an empty result set and this
   * function returns 0 for both metrics. Instruct users to enable monitoring via
   * the DO Control Panel or with: `curl -sSL https://repos.insights.digitalocean.com/install.sh | sudo bash`
   *
   * DO API: GET /v2/monitoring/metrics/droplet/cpu
   *         GET /v2/monitoring/metrics/droplet/memory_utilization_percent
   *
   * @param dropletId  Numeric Droplet ID (from getDroplets())
   */
  async getDropletMetrics(dropletId: number): Promise<DODropletMetrics> {
    const endTs = Math.floor(Date.now() / 1000);
    const startTs = endTs - 3600; // last 60 minutes

    // CPU and memory are fetched in parallel to halve the wall-clock time
    const [cpuResult, memResult] = await Promise.allSettled([
      withRetry(() =>
        this.api.get<RawMetricsResponse>('/monitoring/metrics/droplet/cpu', {
          params: {
            host_id: String(dropletId),
            start: String(startTs),
            end: String(endTs),
          },
        }),
      ),
      withRetry(() =>
        this.api.get<RawMetricsResponse>(
          '/monitoring/metrics/droplet/memory_utilization_percent',
          {
            params: {
              host_id: String(dropletId),
              start: String(startTs),
              end: String(endTs),
            },
          },
        ),
      ),
    ]);

    const averageValues = (
      result: PromiseSettledResult<{ data: RawMetricsResponse }>,
    ): number => {
      if (result.status === 'rejected') return 0;
      const values = result.value.data?.data?.result?.[0]?.values ?? [];
      if (values.length === 0) return 0;
      const sum = values.reduce((acc, [, v]) => acc + parseFloat(v), 0);
      return Math.round((sum / values.length) * 100) / 100;
    };

    return {
      dropletId,
      cpuPercent: averageValues(cpuResult),
      memoryPercent: averageValues(memResult),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Permanently destroys an array of Droplets — the DO equivalent of the AWS Kill Switch.
   *
   * ⚠ DESTRUCTIVE: All Droplet data is lost unless a snapshot/backup exists.
   *   This must be gated behind the OTP verification flow before being called.
   *
   * Deletions are dispatched concurrently (Promise.all) to minimise wall-clock time
   * when shutting down multiple Droplets. Each deletion is individually retried on
   * transient failures.
   *
   * DO API: DELETE /v2/droplets/{id} → 204 No Content on success
   *
   * @param dropletIds  Array of numeric Droplet IDs to permanently destroy
   */
  async terminateDroplets(dropletIds: number[]): Promise<void> {
    if (dropletIds.length === 0) return;

    await Promise.all(
      dropletIds.map((id) => withRetry(() => this.api.delete(`/droplets/${id}`))),
    );
  }


  async getSpaces(): Promise<DOSpaceResource[]> {
    // Surface missing credentials immediately
    if (!this.spacesKey || !this.spacesSecret) {
      throw new DigitalOceanApiError(
        401,
        'DigitalOcean Spaces credentials are required. ' +
          'Provide x-do-spaces-key and x-do-spaces-secret request headers.',
      );
    }

    const listClient = this.getSpacesClient('nyc3');
    let rawBuckets: Array<{ Name?: string; CreationDate?: Date }>;
    try {
      const res = await listClient.send(new ListBucketsCommand({}));
      rawBuckets = res.Buckets ?? [];
    } catch (err: unknown) {
      const errName = (err as { name?: string; Code?: string }).name ??
        (err as { name?: string; Code?: string }).Code ?? '';
      const errMsg = String((err as { message?: string }).message ?? '');
      const isAuthError =
        errName === 'InvalidAccessKeyId' ||
        errName === 'SignatureDoesNotMatch' ||
        errName === 'InvalidAccessKey' ||
        errName === 'AuthorizationHeaderMalformed' ||
        /invalid access key|signature|authorization header|credential/i.test(errMsg);

      if (isAuthError) {
        throw new DigitalOceanApiError(
          403,
          'Invalid Spaces credentials. Please check your Spaces Access Key and Secret Key at ' +
            'https://cloud.digitalocean.com/spaces.',
        );
      }
      throw new DigitalOceanApiError(
        500,
        `Failed to list Spaces: ${errMsg || 'Unknown S3-compatible API error'}`,
      );
    }

    if (rawBuckets.length === 0) return [];

    const locationClient = this.getSpacesClient('nyc3');

    const spaceResults = await Promise.allSettled(
      rawBuckets
        .filter((b) => b.Name)
        .map(async (bucket): Promise<DOSpaceResource> => {
          const name = bucket.Name!;
          const region = await this.resolveBucketRegion(name, locationClient);
          return { name, region, creationDate: bucket.CreationDate };
        }),
    );

    return spaceResults
      .filter(
        (r): r is PromiseFulfilledResult<DOSpaceResource> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
  }

  private async resolveBucketRegion(
    bucketName: string,
    primaryClient: S3Client,
  ): Promise<string> {
    const knownRegions = DO_SPACES_REGIONS as readonly string[];

    try {
      const res = await primaryClient.send(
        new GetBucketLocationCommand({ Bucket: bucketName }),
      );
      const loc = String(res.LocationConstraint ?? '').trim();
      if (loc && knownRegions.includes(loc)) {
        return loc;
      }
    } catch {
      // fall through to region probe
    }


    for (const region of DO_SPACES_REGIONS) {
      const client = this.getSpacesClient(region);
      try {
        const head = await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        const bucketRegion = String(head.BucketRegion ?? '').trim();
        if (bucketRegion && knownRegions.includes(bucketRegion)) {
          return bucketRegion;
        }
      } catch {
        // continue probing other regions
      }
    }

    return 'nyc3'; // last-resort fallback when region cannot be resolved
  }

  /**
   * Applies a cost-optimising object expiry lifecycle rule to a Space.
   * Uses the S3-compatible PutBucketLifecycleConfiguration API.
   *
   * @param spaceRegion  DO region slug where the Space lives, e.g. 'nyc3'
   * @param spaceName    Name of the Space bucket
   * @param expiryDays   Days after last modification before objects are deleted (default: 90)
   */
  async optimizeSpace(
    spaceRegion: string,
    spaceName: string,
    expiryDays = 90,
  ): Promise<void> {
    const client = this.getSpacesClient(spaceRegion);

    await client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: spaceName,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: 'ad-astra-expire-cold-objects',
              Status: 'Enabled',
              Filter: { Prefix: '' }, // applies to all objects in the bucket
              Expiration: { Days: expiryDays },
              // Clean up stale incomplete multipart uploads as a free cost saving
              AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
            },
          ],
        },
      }),
    );
  }

  /**
   * Empties all objects from a Space and then destroys the bucket itself.
   *
   * @param spaceRegion  DO region slug where the Space lives
   * @param spaceName    Name of the Space bucket to delete
   */
  async deleteSpace(spaceRegion: string, spaceName: string): Promise<void> {
    const client = this.getSpacesClient(spaceRegion);

    // Step 1 + 2: Paginate and batch-delete all objects
    let continuationToken: string | undefined;
    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: spaceName,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = listed.Contents ?? [];
      if (objects.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: spaceName,
            Delete: {
              Objects: objects.map((o) => ({ Key: o.Key! })),
              // Quiet mode suppresses per-object success entries in the response
              // to keep the payload small for large buckets
              Quiet: true,
            },
          }),
        );
      }

      continuationToken = listed.NextContinuationToken;
    } while (continuationToken);

    // Step 3: Delete the now-empty bucket
    await client.send(new DeleteBucketCommand({ Bucket: spaceName }));
  }

  async getDatabases(): Promise<DODatabaseResource[]> {
    const res = await withRetry(() =>
      this.api.get<{ databases: RawDatabase[] }>('/databases', {
        params: { per_page: 100 },
      }),
    );

    return (res.data.databases ?? []).map(
      (db): DODatabaseResource => ({
        id: db.id,
        name: db.name,
        engine: db.engine as DODatabaseEngine,
        version: db.version,
        status: db.status as DODatabaseStatus,
        region: db.region,
        numNodes: db.num_nodes,
        sizeSlug: db.size,
        monthlyCost: estimateDbMonthlyCost(db.size),
      }),
    );
  }

  /**
   * Attempts to "stop" a managed database cluster to halt billing.
   * @param dbId            UUID of the managed database cluster to stop
   * @param confirmDestroy  Set to true to actually destroy the cluster.
   *                        Defaults to false (dry-run — returns config only).
   */
  async stopDatabase(dbId: string, confirmDestroy = false): Promise<DODatabaseStopResult> {
    // Always fetch the current config first so we can return it as a "snapshot"
    const infoRes = await withRetry(() =>
      this.api.get<{ database: RawDatabase }>(`/databases/${dbId}`),
    );
    const dbConfig = infoRes.data.database;

    if (!confirmDestroy) {
      // Dry-run: return the config with a detailed explanation, touch nothing
      return {
        action: 'manual_required',
        message:
          'DigitalOcean does not support pausing managed database clusters. ' +
          'To halt billing, the cluster must be destroyed (set confirmDestroy=true in the request body). ' +
          'The cluster configuration is included in this response so you can recreate it later. ' +
          'DO retains automatic backups for the configured retention window after deletion.',
        dbId,
        snapshot: dbConfig,
      };
    }

    // Stage 2: Permanently destroy the cluster
    await withRetry(() => this.api.delete(`/databases/${dbId}`));

    return {
      action: 'snapshot_and_destroy',
      message:
        `Managed database cluster '${dbConfig.name}' ` +
        `(${dbConfig.engine} ${dbConfig.version}, region: ${dbConfig.region}) ` +
        `has been destroyed and billing has stopped. ` +
        `Automatic backups are retained per DO's backup policy. ` +
        `Use the returned snapshot to recreate the cluster via POST /v2/databases.`,
      dbId,
      snapshot: dbConfig,
    };
  }

  async getBillingHistory(): Promise<DOBillingHistory> {
    // Fetch balance and invoices concurrently to reduce latency
    const [balanceRes, invoicesRes] = await Promise.all([
      withRetry(() => this.api.get<RawBalance>('/customers/my/balance')),
      withRetry(() =>
        this.api.get<{
          invoices: RawInvoiceSummary[];
          links?: { pages?: { next?: string } };
        }>('/customers/my/invoices', {
          params: { per_page: 12 }, // 12 months matches the AWS analytics chart range
        }),
      ),
    ]);

    const balance = balanceRes.data;
    const rawInvoices = invoicesRes.data.invoices ?? [];

    const invoices: DOInvoice[] = rawInvoices.map(
      (inv): DOInvoice => ({
        invoiceUuid: inv.invoice_uuid,
        amount: inv.amount,
        invoicePeriod: inv.invoice_period,
        updatedAt: inv.updated_at,
      }),
    );

    return {
      monthToDate: parseFloat(balance.month_to_date_usage ?? '0'),
      accountBalance: parseFloat(balance.account_balance ?? '0'),
      invoices,
    };
  }
}

export function createDigitalOceanService(
  creds: DoCredentials,
): DigitalOceanResourceService {
  return new DigitalOceanResourceService(creds);
}
