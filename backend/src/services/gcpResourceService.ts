import { GcpCredentials, GcpClients, createGcpClients, GCP_REGIONS } from '../config/gcp';
import {
  GCPInstanceResource,
  GCPInstanceStatus,
  GCPBucketResource,
  GCPSqlInstanceResource,
  GCPBillingInfo,
} from '../types';

export class GcpApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`GCP API Error (${status}): ${message}`);
    this.name = 'GcpApiError';
  }
}

// ── Machine type cost estimates (on-demand hourly → monthly) ─────────────

const MACHINE_TYPE_MONTHLY_COST: Record<string, number> = {
  'f1-micro': 3.88,
  'g1-small': 13.80,
  'e2-micro': 6.11,
  'e2-small': 12.23,
  'e2-medium': 24.46,
  'e2-standard-2': 48.92,
  'e2-standard-4': 97.83,
  'e2-standard-8': 195.67,
  'e2-standard-16': 391.34,
  'n1-standard-1': 24.27,
  'n1-standard-2': 48.55,
  'n1-standard-4': 97.09,
  'n1-standard-8': 194.18,
  'n1-standard-16': 388.36,
  'n2-standard-2': 56.52,
  'n2-standard-4': 113.04,
  'n2-standard-8': 226.08,
  'n2d-standard-2': 49.16,
  'n2d-standard-4': 98.32,
  'c2-standard-4': 124.43,
  'c2-standard-8': 248.85,
  'm1-megamem-96': 7116.48,
  'a2-highgpu-1g': 2291.04,
};

const SQL_TIER_MONTHLY_COST: Record<string, number> = {
  'db-f1-micro': 7.67,
  'db-g1-small': 25.55,
  'db-n1-standard-1': 51.10,
  'db-n1-standard-2': 102.20,
  'db-n1-standard-4': 204.40,
  'db-n1-standard-8': 408.80,
  'db-n1-standard-16': 817.60,
  'db-n1-highmem-2': 131.40,
  'db-n1-highmem-4': 262.80,
  'db-n1-highmem-8': 525.60,
  'db-custom-1-3840': 54.75,
  'db-custom-2-7680': 109.50,
  'db-custom-4-15360': 219.00,
};

function estimateMachineTypeCost(machineType: string): number {
  // machineType from API is a URL like zones/us-central1-a/machineTypes/e2-medium
  const shortName = machineType.split('/').pop() ?? machineType;
  return MACHINE_TYPE_MONTHLY_COST[shortName] ?? 0;
}

function parseMachineTypeShortName(machineType: string): string {
  return machineType.split('/').pop() ?? machineType;
}

function estimateSqlTierCost(tier: string): number {
  return SQL_TIER_MONTHLY_COST[tier] ?? 0;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class GoogleCloudResourceService {
  private readonly clients: GcpClients;
  private readonly projectId: string;

  constructor(creds: GcpCredentials) {
    this.clients = createGcpClients(creds);
    this.projectId = creds.projectId;
  }

  /**
   * Lists all Compute Engine VM instances across all zones in the project.
   * Uses aggregatedList to fetch from all zones in a single API call.
   */
  async getInstances(): Promise<GCPInstanceResource[]> {
    if (!this.projectId) {
      throw new GcpApiError(400, 'GCP Project ID is required');
    }

    const instances: GCPInstanceResource[] = [];

    try {
      const aggListRequest = {
        project: this.projectId,
        maxResults: 500,
      };

      const iterable = this.clients.compute.aggregatedListAsync(aggListRequest);

      for await (const [zone, scopedList] of iterable) {
        if (!scopedList.instances || scopedList.instances.length === 0) continue;

        for (const instance of scopedList.instances) {
          const machineTypeShort = parseMachineTypeShortName(instance.machineType ?? '');
          const zoneShort = (zone ?? '').replace('zones/', '');

          // Parse vCPUs and memory from machine type description or fallback
          let vcpus = 1;
          let memoryMb = 1024;

          // GCP API doesn't directly return vCPU/memory in the instance list —
          // we estimate from the machine type name pattern: {family}-{tier}-{vcpus}
          const parts = machineTypeShort.split('-');
          if (parts.length >= 3) {
            const parsedVcpus = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(parsedVcpus)) vcpus = parsedVcpus;
          }
          // Common estimates for well-known types
          if (machineTypeShort === 'f1-micro') { vcpus = 1; memoryMb = 614; }
          else if (machineTypeShort === 'g1-small') { vcpus = 1; memoryMb = 1740; }
          else if (machineTypeShort === 'e2-micro') { vcpus = 2; memoryMb = 1024; }
          else if (machineTypeShort === 'e2-small') { vcpus = 2; memoryMb = 2048; }
          else if (machineTypeShort === 'e2-medium') { vcpus = 2; memoryMb = 4096; }
          else if (machineTypeShort.includes('standard')) {
            memoryMb = vcpus * 3840;
          } else if (machineTypeShort.includes('highmem')) {
            memoryMb = vcpus * 6656;
          } else if (machineTypeShort.includes('highcpu')) {
            memoryMb = vcpus * 922;
          }

          // Extract IPs
          let externalIp: string | undefined;
          let internalIp: string | undefined;
          for (const nic of instance.networkInterfaces ?? []) {
            if (nic.networkIP) internalIp = nic.networkIP;
            for (const ac of nic.accessConfigs ?? []) {
              if (ac.natIP) externalIp = ac.natIP;
            }
          }

          // Disk size
          let diskSizeGb = 10;
          if (instance.disks && instance.disks.length > 0) {
            diskSizeGb = parseInt(String(instance.disks[0].diskSizeGb ?? 10), 10);
          }

          instances.push({
            id: String(instance.id ?? ''),
            name: instance.name ?? '',
            status: (instance.status ?? 'TERMINATED') as GCPInstanceStatus,
            zone: zoneShort,
            machineType: machineTypeShort,
            vcpus,
            memory: memoryMb,
            diskSizeGb,
            price_monthly: estimateMachineTypeCost(machineTypeShort),
            externalIp,
            internalIp,
            labels: (instance.labels as Record<string, string>) ?? {},
          });
        }
      }
    } catch (err: unknown) {
      this.handleGcpError(err);
    }

    return instances;
  }

  /**
   * Stops a running Compute Engine instance.
   */
  async stopInstance(zone: string, instanceName: string): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');

    try {
      const [operation] = await this.clients.compute.stop({
        project: this.projectId,
        zone,
        instance: instanceName,
      });

      // Wait for the operation to complete
      if (operation.latestResponse) {
        await this.clients.zoneOperations.wait({
          project: this.projectId,
          zone,
          operation: operation.latestResponse.name,
        });
      }
    } catch (err: unknown) {
      this.handleGcpError(err);
    }
  }

  /**
   * Starts a stopped Compute Engine instance.
   */
  async startInstance(zone: string, instanceName: string): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');

    try {
      const [operation] = await this.clients.compute.start({
        project: this.projectId,
        zone,
        instance: instanceName,
      });

      if (operation.latestResponse) {
        await this.clients.zoneOperations.wait({
          project: this.projectId,
          zone,
          operation: operation.latestResponse.name,
        });
      }
    } catch (err: unknown) {
      this.handleGcpError(err);
    }
  }

  /**
   * Permanently deletes Compute Engine instances.
   */
  async deleteInstances(instances: Array<{ zone: string; name: string }>): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    if (instances.length === 0) return;

    try {
      await Promise.all(
        instances.map(async ({ zone, name }) => {
          const [operation] = await this.clients.compute.delete({
            project: this.projectId,
            zone,
            instance: name,
          });
          if (operation.latestResponse) {
            await this.clients.zoneOperations.wait({
              project: this.projectId,
              zone,
              operation: operation.latestResponse.name,
            });
          }
        }),
      );
    } catch (err: unknown) {
      this.handleGcpError(err);
    }
  }

  /**
   * Lists all Cloud Storage buckets in the project.
   */
  async getBuckets(): Promise<GCPBucketResource[]> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');

    try {
      const [buckets] = await this.clients.storage.getBuckets({
        project: this.projectId,
      });

      return buckets.map((bucket): GCPBucketResource => ({
        name: bucket.name ?? '',
        location: (bucket.metadata?.location as string) ?? '',
        storageClass: (bucket.metadata?.storageClass as string) ?? 'STANDARD',
        createdAt: bucket.metadata?.timeCreated
          ? new Date(bucket.metadata.timeCreated as string).toISOString()
          : undefined,
      }));
    } catch (err: unknown) {
      this.handleGcpError(err);
      return [];
    }
  }

  /**
   * Deletes a Cloud Storage bucket after emptying all objects.
   */
  async deleteBucket(bucketName: string): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');

    try {
      const bucket = this.clients.storage.bucket(bucketName);
      await bucket.deleteFiles({ force: true });
      await bucket.delete();
    } catch (err: unknown) {
      this.handleGcpError(err);
    }
  }

  /**
   * Lists Cloud SQL instances in the project.
   * Uses the REST API via the google-auth-library since @google-cloud/sql is not
   * available as a standalone client library — Cloud SQL Admin API is accessed via
   * the googleapis package or direct REST calls.
   */
  async getSqlInstances(): Promise<GCPSqlInstanceResource[]> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');

    // Cloud SQL Admin API doesn't have a dedicated @google-cloud client.
    // We use the auth from storage client to make authenticated REST calls.
    try {
      const authClient = await this.clients.storage.authClient.getClient();
      const url = `https://sqladmin.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/instances`;
      const res = await authClient.request({ url });
      const data = res.data as { items?: Array<{
        name: string;
        databaseVersion: string;
        state: string;
        region: string;
        settings: { tier: string; dataDiskSizeGb: string };
        ipAddresses?: Array<{ ipAddress: string }>;
      }> };

      return (data.items ?? []).map((inst): GCPSqlInstanceResource => ({
        name: inst.name,
        databaseVersion: inst.databaseVersion,
        state: inst.state,
        region: inst.region,
        tier: inst.settings?.tier ?? '',
        monthlyCost: estimateSqlTierCost(inst.settings?.tier ?? ''),
        dataDiskSizeGb: parseInt(inst.settings?.dataDiskSizeGb ?? '10', 10),
        ipAddresses: inst.ipAddresses?.map((ip) => ip.ipAddress) ?? [],
      }));
    } catch (err: unknown) {
      this.handleGcpError(err);
      return [];
    }
  }

  /**
   * Fetches billing info — estimates from known resource costs.
   * Full Cloud Billing API requires a billing account ID and is complex to set up,
   * so we provide an estimate based on active resources.
   */
  async getBillingEstimate(): Promise<GCPBillingInfo> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');

    // Aggregate costs from running resources
    const [instances, sqlInstances] = await Promise.allSettled([
      this.getInstances(),
      this.getSqlInstances(),
    ]);

    let monthToDate = 0;

    if (instances.status === 'fulfilled') {
      for (const inst of instances.value) {
        if (inst.status === 'RUNNING') {
          // Pro-rate: assume we're partway through the month
          const dayOfMonth = new Date().getDate();
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          monthToDate += (inst.price_monthly / daysInMonth) * dayOfMonth;
        }
      }
    }

    if (sqlInstances.status === 'fulfilled') {
      for (const sql of sqlInstances.value) {
        if (sql.state === 'RUNNABLE') {
          const dayOfMonth = new Date().getDate();
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          monthToDate += (sql.monthlyCost / daysInMonth) * dayOfMonth;
        }
      }
    }

    monthToDate = Math.round(monthToDate * 100) / 100;

    // Generate estimated monthly costs for the past 12 months
    // (placeholder — actual billing API integration would be more accurate)
    const monthlyCosts: Array<{ month: string; cost: number }> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
      monthlyCosts.push({
        month: monthStr,
        cost: i === 0 ? monthToDate : 0, // Only current month has data without Billing API
      });
    }

    return { monthToDate, monthlyCosts };
  }

  private handleGcpError(err: unknown): never {
    const error = err as { code?: number; message?: string; details?: string };
    const status = error.code ?? 500;
    const message = error.message ?? 'Unknown GCP API error';

    if (status === 7 || status === 403) {
      throw new GcpApiError(403, `Permission denied: ${message}`);
    }
    if (status === 5 || status === 404) {
      throw new GcpApiError(404, `Not found: ${message}`);
    }
    if (status === 16 || status === 401) {
      throw new GcpApiError(401, `Authentication failed: ${message}`);
    }
    if (status === 3 || status === 400) {
      throw new GcpApiError(400, `Invalid request: ${message}`);
    }

    throw new GcpApiError(
      typeof status === 'number' && status >= 400 && status < 600 ? status : 500,
      message,
    );
  }
}

export function createGoogleCloudService(
  creds: GcpCredentials,
): GoogleCloudResourceService {
  return new GoogleCloudResourceService(creds);
}
