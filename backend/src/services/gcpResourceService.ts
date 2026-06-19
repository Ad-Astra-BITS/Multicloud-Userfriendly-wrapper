import { GcpCredentials, GcpClients, createGcpClients } from '../config/gcp';
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

const MACHINE_TYPE_MONTHLY_COST: Record<string, number> = {
  'f1-micro': 3.88, 'g1-small': 13.80,
  'e2-micro': 6.11, 'e2-small': 12.23, 'e2-medium': 24.46,
  'e2-standard-2': 48.92, 'e2-standard-4': 97.83, 'e2-standard-8': 195.67,
  'n1-standard-1': 24.27, 'n1-standard-2': 48.55, 'n1-standard-4': 97.09,
  'n1-standard-8': 194.18, 'n2-standard-2': 56.52, 'n2-standard-4': 113.04,
  'n2-standard-8': 226.08, 'n2d-standard-2': 49.16, 'n2d-standard-4': 98.32,
  'c2-standard-4': 124.43, 'c2-standard-8': 248.85,
};

const SQL_TIER_MONTHLY_COST: Record<string, number> = {
  'db-f1-micro': 7.67, 'db-g1-small': 25.55,
  'db-n1-standard-1': 51.10, 'db-n1-standard-2': 102.20,
  'db-n1-standard-4': 204.40, 'db-n1-standard-8': 408.80,
  'db-n1-highmem-2': 131.40, 'db-n1-highmem-4': 262.80,
  'db-custom-1-3840': 54.75, 'db-custom-2-7680': 109.50,
};

function parseMachineTypeShortName(machineType: string): string {
  return machineType.split('/').pop() ?? machineType;
}

export class GoogleCloudResourceService {
  private readonly clients: GcpClients;
  private readonly projectId: string;

  constructor(creds: GcpCredentials) {
    this.clients = createGcpClients(creds);
    this.projectId = creds.projectId;
  }

  async getInstances(): Promise<GCPInstanceResource[]> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    const instances: GCPInstanceResource[] = [];

    try {
      const iterable = this.clients.compute.aggregatedListAsync({
        project: this.projectId,
        maxResults: 500,
      });

      for await (const [zone, scopedList] of iterable) {
        if (!scopedList.instances || scopedList.instances.length === 0) continue;

        for (const inst of scopedList.instances) {
          const machineTypeShort = parseMachineTypeShortName(inst.machineType ?? '');
          const zoneShort = (zone ?? '').replace('zones/', '');
          let vcpus = 1, memoryMb = 1024;
          const parts = machineTypeShort.split('-');
          if (parts.length >= 3) {
            const pv = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(pv)) vcpus = pv;
          }
          if (machineTypeShort === 'f1-micro') { vcpus = 1; memoryMb = 614; }
          else if (machineTypeShort === 'g1-small') { vcpus = 1; memoryMb = 1740; }
          else if (machineTypeShort === 'e2-micro') { vcpus = 2; memoryMb = 1024; }
          else if (machineTypeShort === 'e2-small') { vcpus = 2; memoryMb = 2048; }
          else if (machineTypeShort === 'e2-medium') { vcpus = 2; memoryMb = 4096; }
          else if (machineTypeShort.includes('standard')) memoryMb = vcpus * 3840;
          else if (machineTypeShort.includes('highmem')) memoryMb = vcpus * 6656;
          else if (machineTypeShort.includes('highcpu')) memoryMb = vcpus * 922;

          let externalIp: string | undefined, internalIp: string | undefined;
          for (const nic of inst.networkInterfaces ?? []) {
            if (nic.networkIP) internalIp = nic.networkIP;
            for (const ac of nic.accessConfigs ?? []) { if (ac.natIP) externalIp = ac.natIP; }
          }
          let diskSizeGb = 10;
          if (inst.disks?.[0]) diskSizeGb = parseInt(String(inst.disks[0].diskSizeGb ?? 10), 10);

          instances.push({
            id: String(inst.id ?? ''), name: inst.name ?? '',
            status: (inst.status ?? 'TERMINATED') as GCPInstanceStatus,
            zone: zoneShort, machineType: machineTypeShort,
            vcpus, memory: memoryMb, diskSizeGb,
            price_monthly: MACHINE_TYPE_MONTHLY_COST[machineTypeShort] ?? 0,
            externalIp, internalIp,
            labels: (inst.labels as Record<string, string>) ?? {},
          });
        }
      }
    } catch (err: unknown) { this.handleGcpError(err); }
    return instances;
  }

  async stopInstance(zone: string, instanceName: string): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    try {
      const [op] = await this.clients.compute.stop({ project: this.projectId, zone, instance: instanceName });
      if (op.latestResponse) await this.clients.zoneOperations.wait({ project: this.projectId, zone, operation: op.latestResponse.name });
    } catch (err: unknown) { this.handleGcpError(err); }
  }

  async startInstance(zone: string, instanceName: string): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    try {
      const [op] = await this.clients.compute.start({ project: this.projectId, zone, instance: instanceName });
      if (op.latestResponse) await this.clients.zoneOperations.wait({ project: this.projectId, zone, operation: op.latestResponse.name });
    } catch (err: unknown) { this.handleGcpError(err); }
  }

  async deleteInstances(instances: Array<{ zone: string; name: string }>): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    if (instances.length === 0) return;
    try {
      await Promise.all(instances.map(async ({ zone, name }) => {
        const [op] = await this.clients.compute.delete({ project: this.projectId, zone, instance: name });
        if (op.latestResponse) await this.clients.zoneOperations.wait({ project: this.projectId, zone, operation: op.latestResponse.name });
      }));
    } catch (err: unknown) { this.handleGcpError(err); }
  }

  async getBuckets(): Promise<GCPBucketResource[]> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    try {
      const [buckets] = await this.clients.storage.getBuckets({ project: this.projectId });
      return buckets.map((b): GCPBucketResource => ({
        name: b.name ?? '',
        location: (b.metadata?.location as string) ?? '',
        storageClass: (b.metadata?.storageClass as string) ?? 'STANDARD',
        createdAt: b.metadata?.timeCreated ? new Date(b.metadata.timeCreated as string).toISOString() : undefined,
      }));
    } catch (err: unknown) { this.handleGcpError(err); return []; }
  }

  async deleteBucket(bucketName: string): Promise<void> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    try {
      const bucket = this.clients.storage.bucket(bucketName);
      await bucket.deleteFiles({ force: true });
      await bucket.delete();
    } catch (err: unknown) { this.handleGcpError(err); }
  }

  async getSqlInstances(): Promise<GCPSqlInstanceResource[]> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    try {
      const authClient = await this.clients.storage.authClient.getClient();
      const url = `https://sqladmin.googleapis.com/v1/projects/${encodeURIComponent(this.projectId)}/instances`;
      const res = await authClient.request({ url });
      const data = res.data as { items?: Array<{
        name: string; databaseVersion: string; state: string; region: string;
        settings: { tier: string; dataDiskSizeGb: string };
        ipAddresses?: Array<{ ipAddress: string }>;
      }> };
      return (data.items ?? []).map((i): GCPSqlInstanceResource => ({
        name: i.name, databaseVersion: i.databaseVersion, state: i.state, region: i.region,
        tier: i.settings?.tier ?? '', monthlyCost: SQL_TIER_MONTHLY_COST[i.settings?.tier ?? ''] ?? 0,
        dataDiskSizeGb: parseInt(i.settings?.dataDiskSizeGb ?? '10', 10),
        ipAddresses: i.ipAddresses?.map((ip) => ip.ipAddress) ?? [],
      }));
    } catch (err: unknown) { this.handleGcpError(err); return []; }
  }

  async getBillingEstimate(): Promise<GCPBillingInfo> {
    if (!this.projectId) throw new GcpApiError(400, 'GCP Project ID is required');
    const [instances, sqlInstances] = await Promise.allSettled([this.getInstances(), this.getSqlInstances()]);
    let monthToDate = 0;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    if (instances.status === 'fulfilled') {
      for (const i of instances.value) if (i.status === 'RUNNING') monthToDate += (i.price_monthly / daysInMonth) * dayOfMonth;
    }
    if (sqlInstances.status === 'fulfilled') {
      for (const s of sqlInstances.value) if (s.state === 'RUNNABLE') monthToDate += (s.monthlyCost / daysInMonth) * dayOfMonth;
    }
    monthToDate = Math.round(monthToDate * 100) / 100;
    const monthlyCosts: Array<{ month: string; cost: number }> = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyCosts.push({ month: d.toISOString().slice(0, 7), cost: i === 0 ? monthToDate : 0 });
    }
    return { monthToDate, monthlyCosts };
  }

  private handleGcpError(err: unknown): never {
    const error = err as { code?: number; message?: string };
    const status = error.code ?? 500;
    const message = error.message ?? 'Unknown GCP API error';
    if (status === 7 || status === 403) throw new GcpApiError(403, `Permission denied: ${message}`);
    if (status === 5 || status === 404) throw new GcpApiError(404, `Not found: ${message}`);
    if (status === 16 || status === 401) throw new GcpApiError(401, `Authentication failed: ${message}`);
    if (status === 3 || status === 400) throw new GcpApiError(400, `Invalid request: ${message}`);
    throw new GcpApiError(typeof status === 'number' && status >= 400 && status < 600 ? status : 500, message);
  }
}

export function createGoogleCloudService(creds: GcpCredentials): GoogleCloudResourceService {
  return new GoogleCloudResourceService(creds);
}
