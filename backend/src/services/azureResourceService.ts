import { AzureCredentials, AzureClients, createAzureClients } from '../config/azure';
import {
  AzureVMResource,
  AzureVMStatus,
  AzureStorageAccountResource,
  AzureSqlDatabaseResource,
  AzureBillingInfo,
} from '../types';

export class AzureApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`Azure API Error (${status}): ${message}`);
    this.name = 'AzureApiError';
  }
}

// ── VM size cost estimates (pay-as-you-go USD/mo) ────────────────────────

const VM_SIZE_MONTHLY_COST: Record<string, number> = {
  'Standard_B1ls': 3.80, 'Standard_B1s': 7.59, 'Standard_B1ms': 15.18,
  'Standard_B2s': 30.37, 'Standard_B2ms': 60.74, 'Standard_B4ms': 121.47,
  'Standard_D2s_v3': 70.08, 'Standard_D4s_v3': 140.16, 'Standard_D8s_v3': 280.32,
  'Standard_D2as_v4': 70.08, 'Standard_D4as_v4': 140.16,
  'Standard_E2s_v3': 91.98, 'Standard_E4s_v3': 183.96, 'Standard_E8s_v3': 367.92,
  'Standard_F2s_v2': 61.32, 'Standard_F4s_v2': 122.64, 'Standard_F8s_v2': 245.28,
  'Standard_A1_v2': 29.93, 'Standard_A2_v2': 63.51, 'Standard_A4_v2': 133.23,
};

// ── VM size → vCPU/RAM mapping ───────────────────────────────────────────

const VM_SIZE_SPECS: Record<string, { vcpus: number; memoryMb: number }> = {
  'Standard_B1ls': { vcpus: 1, memoryMb: 512 },
  'Standard_B1s': { vcpus: 1, memoryMb: 1024 },
  'Standard_B1ms': { vcpus: 1, memoryMb: 2048 },
  'Standard_B2s': { vcpus: 2, memoryMb: 4096 },
  'Standard_B2ms': { vcpus: 2, memoryMb: 8192 },
  'Standard_B4ms': { vcpus: 4, memoryMb: 16384 },
  'Standard_D2s_v3': { vcpus: 2, memoryMb: 8192 },
  'Standard_D4s_v3': { vcpus: 4, memoryMb: 16384 },
  'Standard_D8s_v3': { vcpus: 8, memoryMb: 32768 },
  'Standard_D2as_v4': { vcpus: 2, memoryMb: 8192 },
  'Standard_D4as_v4': { vcpus: 4, memoryMb: 16384 },
  'Standard_E2s_v3': { vcpus: 2, memoryMb: 16384 },
  'Standard_E4s_v3': { vcpus: 4, memoryMb: 32768 },
  'Standard_E8s_v3': { vcpus: 8, memoryMb: 65536 },
  'Standard_F2s_v2': { vcpus: 2, memoryMb: 4096 },
  'Standard_F4s_v2': { vcpus: 4, memoryMb: 8192 },
  'Standard_F8s_v2': { vcpus: 8, memoryMb: 16384 },
  'Standard_A1_v2': { vcpus: 1, memoryMb: 2048 },
  'Standard_A2_v2': { vcpus: 2, memoryMb: 4096 },
  'Standard_A4_v2': { vcpus: 4, memoryMb: 8192 },
};

const SQL_DTU_MONTHLY_COST: Record<string, number> = {
  'Basic': 4.90, 'S0': 15.03, 'S1': 30.05, 'S2': 75.10,
  'S3': 150.22, 'S4': 300.41, 'S6': 600.82, 'S7': 1201.66,
  'GP_S_Gen5_1': 103.98, 'GP_S_Gen5_2': 207.96,
  'GP_Gen5_2': 345.28, 'GP_Gen5_4': 690.55,
  'BC_Gen5_2': 838.79, 'BC_Gen5_4': 1677.59,
};

function estimateVmCost(vmSize: string): number {
  return VM_SIZE_MONTHLY_COST[vmSize] ?? 0;
}

function estimateSqlCost(sku: string): number {
  return SQL_DTU_MONTHLY_COST[sku] ?? 0;
}

export class AzureResourceService {
  private readonly clients: AzureClients;
  private readonly subscriptionId: string;

  constructor(creds: AzureCredentials) {
    this.clients = createAzureClients(creds);
    this.subscriptionId = creds.subscriptionId;
  }

  /**
   * Lists all Virtual Machines across all resource groups in the subscription.
   */
  async getVirtualMachines(): Promise<AzureVMResource[]> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');

    const vms: AzureVMResource[] = [];

    try {
      for await (const vm of this.clients.compute.virtualMachines.listAll()) {
        // Get the power state — requires an instance view call
        let powerState: AzureVMStatus = 'Unknown';
        const resourceGroup = this.extractResourceGroup(vm.id ?? '');

        if (resourceGroup && vm.name) {
          try {
            const instanceView = await this.clients.compute.virtualMachines.instanceView(
              resourceGroup,
              vm.name,
            );
            const statusEntry = instanceView.statuses?.find((s) =>
              s.code?.startsWith('PowerState/'),
            );
            if (statusEntry?.code) {
              const state = statusEntry.code.replace('PowerState/', '');
              const stateMap: Record<string, AzureVMStatus> = {
                running: 'Running', deallocated: 'Deallocated', stopped: 'Stopped',
                deallocating: 'Deallocating', starting: 'Starting',
              };
              powerState = stateMap[state] ?? 'Unknown';
            }
          } catch {
            // Instance view failed — use 'Unknown' power state
          }
        }

        const vmSize = vm.hardwareProfile?.vmSize ?? '';
        const specs = VM_SIZE_SPECS[vmSize] ?? { vcpus: 1, memoryMb: 1024 };

        // Extract OS disk size
        let osDiskSizeGb = 30;
        if (vm.storageProfile?.osDisk?.diskSizeGB) {
          osDiskSizeGb = vm.storageProfile.osDisk.diskSizeGB;
        }

        // Extract IPs
        let publicIp: string | undefined;
        let privateIp: string | undefined;
        // IP extraction requires separate network calls — skip for list view
        // (the user can see IPs in the Azure portal)

        vms.push({
          id: vm.id ?? '',
          name: vm.name ?? '',
          status: powerState,
          location: vm.location ?? '',
          resourceGroup,
          vmSize,
          vcpus: specs.vcpus,
          memory: specs.memoryMb,
          osDiskSizeGb,
          price_monthly: estimateVmCost(vmSize),
          publicIp,
          privateIp,
          tags: (vm.tags as Record<string, string>) ?? {},
        });
      }
    } catch (err: unknown) {
      this.handleAzureError(err);
    }

    return vms;
  }

  /**
   * Deallocates (stops and releases compute resources) a virtual machine.
   */
  async deallocateVM(resourceGroup: string, vmName: string): Promise<void> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');
    try {
      const poller = await this.clients.compute.virtualMachines.beginDeallocate(resourceGroup, vmName);
      await poller.pollUntilDone();
    } catch (err: unknown) { this.handleAzureError(err); }
  }

  /**
   * Starts a deallocated virtual machine.
   */
  async startVM(resourceGroup: string, vmName: string): Promise<void> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');
    try {
      const poller = await this.clients.compute.virtualMachines.beginStart(resourceGroup, vmName);
      await poller.pollUntilDone();
    } catch (err: unknown) { this.handleAzureError(err); }
  }

  /**
   * Permanently deletes virtual machines.
   */
  async deleteVMs(vms: Array<{ resourceGroup: string; name: string }>): Promise<void> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');
    if (vms.length === 0) return;
    try {
      await Promise.all(vms.map(async ({ resourceGroup, name }) => {
        const poller = await this.clients.compute.virtualMachines.beginDelete(resourceGroup, name);
        await poller.pollUntilDone();
      }));
    } catch (err: unknown) { this.handleAzureError(err); }
  }

  /**
   * Lists all Storage Accounts in the subscription.
   */
  async getStorageAccounts(): Promise<AzureStorageAccountResource[]> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');
    const accounts: AzureStorageAccountResource[] = [];

    try {
      for await (const acct of this.clients.storage.storageAccounts.list()) {
        accounts.push({
          id: acct.id ?? '',
          name: acct.name ?? '',
          location: acct.location ?? '',
          resourceGroup: this.extractResourceGroup(acct.id ?? ''),
          kind: (acct.kind as string) ?? 'StorageV2',
          skuName: acct.sku?.name ?? '',
          accessTier: (acct.accessTier as string) ?? '',
          createdAt: acct.creationTime ? acct.creationTime.toISOString() : undefined,
        });
      }
    } catch (err: unknown) { this.handleAzureError(err); }
    return accounts;
  }

  /**
   * Deletes a storage account.
   */
  async deleteStorageAccount(resourceGroup: string, accountName: string): Promise<void> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');
    try {
      await this.clients.storage.storageAccounts.delete(resourceGroup, accountName);
    } catch (err: unknown) { this.handleAzureError(err); }
  }

  /**
   * Lists all SQL Databases across all servers in the subscription.
   */
  async getSqlDatabases(): Promise<AzureSqlDatabaseResource[]> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');
    const databases: AzureSqlDatabaseResource[] = [];

    try {
      // First list all SQL servers
      const servers: Array<{ name: string; resourceGroup: string; location: string }> = [];
      for await (const server of this.clients.sql.servers.list()) {
        servers.push({
          name: server.name ?? '',
          resourceGroup: this.extractResourceGroup(server.id ?? ''),
          location: server.location ?? '',
        });
      }

      // Then list databases for each server
      for (const server of servers) {
        try {
          for await (const db of this.clients.sql.databases.listByServer(server.resourceGroup, server.name)) {
            if (db.name === 'master') continue; // Skip system database

            databases.push({
              id: db.id ?? '',
              name: db.name ?? '',
              serverName: server.name,
              resourceGroup: server.resourceGroup,
              location: db.location ?? server.location,
              status: db.status ?? 'Unknown',
              sku: db.currentSku?.name ?? db.sku?.name ?? '',
              maxSizeGb: db.maxSizeBytes ? Math.round(db.maxSizeBytes / (1024 ** 3)) : 0,
              monthlyCost: estimateSqlCost(db.currentSku?.name ?? db.sku?.name ?? ''),
            });
          }
        } catch {
          // Skip servers we can't access
        }
      }
    } catch (err: unknown) { this.handleAzureError(err); }
    return databases;
  }

  /**
   * Fetches billing / consumption usage summary for the current billing period.
   */
  async getBillingInfo(): Promise<AzureBillingInfo> {
    if (!this.subscriptionId) throw new AzureApiError(400, 'Azure Subscription ID is required');

    // Aggregate from known resource costs as a fallback
    const [vms, dbs] = await Promise.allSettled([this.getVirtualMachines(), this.getSqlDatabases()]);

    let monthToDate = 0;
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

    if (vms.status === 'fulfilled') {
      for (const vm of vms.value) {
        if (vm.status === 'Running') monthToDate += (vm.price_monthly / daysInMonth) * dayOfMonth;
      }
    }
    if (dbs.status === 'fulfilled') {
      for (const db of dbs.value) {
        if (db.status === 'Online') monthToDate += (db.monthlyCost / daysInMonth) * dayOfMonth;
      }
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

  private extractResourceGroup(resourceId: string): string {
    const match = resourceId.match(/\/resourceGroups\/([^/]+)/i);
    return match?.[1] ?? '';
  }

  private handleAzureError(err: unknown): never {
    console.error('Raw Azure Error:', err);
    const error = err as { statusCode?: number; code?: string; message?: string };
    const status = error.statusCode ?? 500;
    const message = error.message ?? 'Unknown Azure API error';
    const code = error.code ?? '';

    if (code === 'AuthorizationFailed' || code === 'AuthenticationFailed' || status === 401 || status === 403) {
      const isAuth = status === 401 || code === 'AuthenticationFailed';
      throw new AzureApiError(
        isAuth ? 401 : 403,
        isAuth
          ? 'Authentication failed. Verify your Tenant ID, Client ID, and Client Secret are correct.'
          : 'Authorization failed — the service principal lacks required RBAC roles. Go to Azure Portal → Subscriptions → Access control (IAM) and assign at least the "Reader" role to your App Registration.',
      );
    }
    if (code === 'ResourceNotFound' || code === 'ResourceGroupNotFound' || status === 404) {
      throw new AzureApiError(404, `Not found: ${message}`);
    }
    if (code === 'InvalidSubscriptionId' || status === 400) {
      throw new AzureApiError(400, `Invalid request: ${message}`);
    }
    throw new AzureApiError(
      typeof status === 'number' && status >= 400 && status < 600 ? status : 500,
      message,
    );
  }
}

export function createAzureService(creds: AzureCredentials): AzureResourceService {
  return new AzureResourceService(creds);
}
