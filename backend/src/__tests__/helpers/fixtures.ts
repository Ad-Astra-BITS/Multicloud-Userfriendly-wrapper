import type {
  Resource,
  DashboardSummary,
  Recommendation,
  Alert,
  CostRecord,
  DODropletResource,
  DOSpaceResource,
  DODatabaseResource,
  DOBillingHistory,
  GCPInstanceResource,
  GCPBucketResource,
  GCPSqlInstanceResource,
  GCPBillingInfo,
  AzureVMResource,
  AzureStorageAccountResource,
  AzureSqlDatabaseResource,
  AzureBillingInfo,
} from '../../types';

// ── AWS Fixtures ──────────────────────────────────────────────────────────────

export const ec2Running: Resource = {
  id: 'i-0abc123def456ghi0',
  awsId: 'i-0abc123def456ghi0',
  name: 'web-server-prod',
  type: 'EC2',
  status: 'running',
  region: 'us-east-1',
  monthlyCost: 30.37,
  tags: { Environment: 'production', Name: 'web-server-prod' },
};

export const ec2Stopped: Resource = {
  id: 'i-0stopped1234567890',
  awsId: 'i-0stopped1234567890',
  name: 'old-worker',
  type: 'EC2',
  status: 'stopped',
  region: 'us-west-2',
  monthlyCost: 15.18,
  tags: {},
};

export const s3Bucket: Resource = {
  id: 'my-app-assets',
  awsId: 'my-app-assets',
  name: 'my-app-assets',
  type: 'S3',
  status: 'running',
  region: 'us-east-1',
  monthlyCost: 0,
};

export const rdsRunning: Resource = {
  id: 'prod-db',
  awsId: 'prod-db',
  name: 'prod-db',
  type: 'RDS',
  status: 'running',
  region: 'us-east-1',
  monthlyCost: 49.64,
};

export const dashboardSummary: DashboardSummary = {
  totalMonthlyCost: 250.50,
  costChange: 5.2,
  activeResources: { ec2: 3, s3: 5, rds: 2 },
  potentialSavings: 75.00,
  alertCount: 2,
};

export const costTrend: { month: string; cost: number }[] = [
  { month: '2024-01', cost: 210.00 },
  { month: '2024-02', cost: 235.50 },
  { month: '2024-03', cost: 250.50 },
];

export const costBreakdown: CostRecord[] = [
  { month: '2024-03', service: 'Amazon EC2', cost: 150.50 },
  { month: '2024-03', service: 'Amazon RDS', cost: 75.00 },
  { month: '2024-03', service: 'Amazon S3', cost: 25.00 },
];

export const recommendationFixture: Recommendation = {
  id: 'i-0abc123def456ghi0-underutilised-ec2-instance',
  resourceId: 'i-0abc123def456ghi0',
  title: 'Underutilised EC2 Instance',
  description: 'web-server-prod has averaged 2% CPU over 24h.',
  currentTier: '$30.37/mo (current type)',
  recommendedTier: 'Smaller instance type',
  estimatedSavings: 15.18,
  priority: 'high',
  status: 'pending',
  createdAt: '2024-01-15T10:00:00.000Z',
};

export const alertFixture: Alert = {
  id: 'alert-001',
  resourceId: 'i-0abc123def456ghi0',
  title: 'High CPU Usage',
  description: 'Instance CPU exceeded 90% for 30 minutes.',
  severity: 'warning',
  resolved: false,
  createdAt: '2024-01-15T10:00:00.000Z',
};

export const resolvedAlertFixture: Alert = {
  ...alertFixture,
  resolved: true,
};

// ── DigitalOcean Fixtures ─────────────────────────────────────────────────────

export const doDroplet: DODropletResource = {
  id: 123456,
  name: 'web-droplet-1',
  status: 'active',
  region: 'nyc3',
  vcpus: 2,
  memory: 2048,
  disk: 60,
  price_monthly: 18.00,
  ip_address: '198.51.100.1',
  tags: ['production'],
};

export const doSpace: DOSpaceResource = {
  name: 'my-space-bucket',
  region: 'nyc3',
  creationDate: new Date('2024-01-01'),
};

export const doDatabase: DODatabaseResource = {
  id: 'db-uuid-1234',
  name: 'prod-postgres',
  engine: 'pg',
  version: '15',
  status: 'online',
  region: 'nyc3',
  numNodes: 1,
  sizeSlug: 'db-s-1vcpu-1gb',
  monthlyCost: 15.00,
};

export const doBilling: DOBillingHistory = {
  monthToDate: 45.60,
  accountBalance: 0,
  invoices: [
    {
      invoiceUuid: 'inv-001',
      amount: '42.00',
      invoicePeriod: '2024-02',
      updatedAt: '2024-03-01T00:00:00Z',
    },
  ],
};

// ── GCP Fixtures ──────────────────────────────────────────────────────────────

export const gcpInstance: GCPInstanceResource = {
  id: '1234567890',
  name: 'instance-1',
  status: 'RUNNING',
  zone: 'us-central1-a',
  machineType: 'e2-medium',
  vcpus: 2,
  memory: 4096,
  diskSizeGb: 20,
  price_monthly: 24.46,
  externalIp: '34.100.200.1',
};

export const gcpBucket: GCPBucketResource = {
  name: 'my-gcp-bucket',
  location: 'US',
  storageClass: 'STANDARD',
  createdAt: '2024-01-01T00:00:00Z',
};

export const gcpSqlInstance: GCPSqlInstanceResource = {
  name: 'my-sql',
  databaseVersion: 'POSTGRES_15',
  state: 'RUNNABLE',
  region: 'us-central1',
  tier: 'db-f1-micro',
  monthlyCost: 7.67,
  dataDiskSizeGb: 10,
  ipAddresses: ['10.0.0.1'],
};

export const gcpBilling: GCPBillingInfo = {
  monthToDate: 32.50,
  monthlyCosts: [
    { month: '2024-02', cost: 28.00 },
    { month: '2024-03', cost: 32.50 },
  ],
};

// ── Azure Fixtures ────────────────────────────────────────────────────────────

export const azureVM: AzureVMResource = {
  id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Compute/virtualMachines/my-vm',
  name: 'my-vm',
  status: 'Running',
  location: 'eastus',
  resourceGroup: 'my-rg',
  vmSize: 'Standard_B2s',
  vcpus: 2,
  memory: 4096,
  osDiskSizeGb: 30,
  price_monthly: 30.37,
};

export const azureStorage: AzureStorageAccountResource = {
  id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Storage/storageAccounts/mystorage',
  name: 'mystorage',
  location: 'eastus',
  resourceGroup: 'my-rg',
  kind: 'StorageV2',
  skuName: 'Standard_LRS',
  accessTier: 'Hot',
  createdAt: '2024-01-01T00:00:00Z',
};

export const azureSql: AzureSqlDatabaseResource = {
  id: '/subscriptions/sub-id/resourceGroups/my-rg/providers/Microsoft.Sql/servers/my-server/databases/my-db',
  name: 'my-db',
  serverName: 'my-server',
  resourceGroup: 'my-rg',
  location: 'eastus',
  status: 'Online',
  sku: 'Basic',
  maxSizeGb: 2,
  monthlyCost: 4.99,
};

export const azureBilling: AzureBillingInfo = {
  monthToDate: 85.20,
  monthlyCosts: [
    { month: '2024-02', cost: 78.00 },
    { month: '2024-03', cost: 85.20 },
  ],
};

// ── Prisma-shaped objects (DB rows) ───────────────────────────────────────────

export const dbAlertRow = {
  id: 'alert-001',
  resourceId: 'i-0abc123def456ghi0',
  title: 'High CPU Usage',
  description: 'Instance CPU exceeded 90%.',
  severity: 'WARNING',
  resolved: false,
  resolvedAt: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};

export const dbRecommendationRow = {
  id: 'rec-001',
  resourceId: 'i-0abc123def456ghi0',
  title: 'Underutilised EC2 Instance',
  description: 'Instance has averaged 2% CPU.',
  currentTier: '$30.37/mo',
  recommendedTier: 'Smaller instance type',
  estimatedSavings: 15.18,
  priority: 'HIGH',
  status: 'PENDING',
  appliedAt: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
};
