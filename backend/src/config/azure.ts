import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { ComputeManagementClient } from '@azure/arm-compute';
import { StorageManagementClient } from '@azure/arm-storage';
import { SqlManagementClient } from '@azure/arm-sql';
import { ConsumptionManagementClient } from '@azure/arm-consumption';
import type { TokenCredential } from '@azure/identity';

/** Azure regions commonly used */
export const AZURE_REGIONS = [
  'eastus',
  'eastus2',
  'westus',
  'westus2',
  'westus3',
  'centralus',
  'northeurope',
  'westeurope',
  'uksouth',
  'ukwest',
  'southeastasia',
  'eastasia',
  'japaneast',
  'australiaeast',
  'brazilsouth',
  'canadacentral',
] as const;

export type AzureRegion = (typeof AZURE_REGIONS)[number];

export interface AzureCredentials {
  /** Azure subscription ID */
  subscriptionId: string;
  /** Azure AD tenant ID */
  tenantId: string;
  /** Service principal (app registration) client ID */
  clientId: string;
  /** Service principal client secret */
  clientSecret: string;
}

export interface AzureClients {
  compute: ComputeManagementClient;
  storage: StorageManagementClient;
  sql: SqlManagementClient;
  consumption: ConsumptionManagementClient;
  subscriptionId: string;
}

export function createAzureClients(creds: AzureCredentials): AzureClients {
  let credential: TokenCredential;

  if (creds.tenantId && creds.clientId && creds.clientSecret) {
    credential = new ClientSecretCredential(
      creds.tenantId,
      creds.clientId,
      creds.clientSecret,
    );
  } else {
    credential = new DefaultAzureCredential();
  }

  return {
    compute: new ComputeManagementClient(credential, creds.subscriptionId),
    storage: new StorageManagementClient(credential, creds.subscriptionId),
    sql: new SqlManagementClient(credential, creds.subscriptionId),
    consumption: new ConsumptionManagementClient(credential, creds.subscriptionId),
    subscriptionId: creds.subscriptionId,
  };
}

export const defaultAzureClients = createAzureClients({
  subscriptionId: process.env.AZURE_SUBSCRIPTION_ID ?? '',
  tenantId: process.env.AZURE_TENANT_ID ?? '',
  clientId: process.env.AZURE_CLIENT_ID ?? '',
  clientSecret: process.env.AZURE_CLIENT_SECRET ?? '',
});
