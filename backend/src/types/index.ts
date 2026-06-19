// ── Primitives ────────────────────────────────────────────────────────────────

export type ResourceType = 'EC2' | 'S3' | 'RDS';
export type ResourceStatus = 'running' | 'stopped' | 'warning' | 'terminated';

// ── DigitalOcean Primitives ───────────────────────────────────────────────────

export type DODropletStatus = 'active' | 'off' | 'archive';
export type DODatabaseStatus = 'online' | 'migrating' | 'forking' | 'resizing' | 'error' | 'unknown';
export type DODatabaseEngine = 'pg' | 'mysql' | 'redis' | 'mongodb' | 'kafka' | 'opensearch';
export type S3Tier = 'Standard' | 'Intelligent Tiering' | 'Glacier' | 'Glacier Deep Archive';
export type Priority = 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'warning' | 'info';
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed';

// ── Domain Models ─────────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  awsId: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  region: string;
  monthlyCost: number;
  tags?: Record<string, string>;
}

export interface S3Bucket {
  id: string;
  awsBucketName: string;
  currentTier: S3Tier;
  recommendedTier?: S3Tier;
  sizeBytes: number;
  estimatedSavings: number;
  lastAccessed?: string;
  lifecycleApplied: boolean;
}

export interface Recommendation {
  id: string;
  resourceId: string;
  title: string;
  description: string;
  currentTier: string;
  recommendedTier: string;
  estimatedSavings: number;
  priority: Priority;
  status: RecommendationStatus;
  appliedAt?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  resourceId?: string;
  title: string;
  description: string;
  severity: Severity;
  resolved: boolean;
  createdAt: string;
}

export interface CostRecord {
  month: string;
  service: string;
  cost: number;
}

export interface DashboardSummary {
  totalMonthlyCost: number;
  costChange: number;
  activeResources: { ec2: number; s3: number; rds: number };
  potentialSavings: number;
  alertCount: number;
}

// ── DigitalOcean Domain Models ────────────────────────────────────────────────

/**
 * Unified Droplet model — maps directly to the frontend Server Comparison UI.
 * Fields match the shared compute schema (id, name, vcpus, memory, disk, price_monthly)
 * so the comparison table can render Droplets alongside AWS EC2 instances.
 */
export interface DODropletResource {
  id: number;
  name: string;
  status: DODropletStatus;
  region: string;
  /** Number of virtual CPUs */
  vcpus: number;
  /** RAM in megabytes */
  memory: number;
  /** Root disk in gigabytes */
  disk: number;
  /** Estimated monthly cost in USD (from the DO size object) */
  price_monthly: number;
  ip_address?: string;
  tags?: string[];
}

/** Live CPU and memory utilisation fetched from the DO Monitoring API */
export interface DODropletMetrics {
  dropletId: number;
  /** Average CPU utilisation (%) over the past hour, across all cores */
  cpuPercent: number;
  /** Average memory utilisation (%) over the past hour */
  memoryPercent: number;
  timestamp: string;
}

/** A single DigitalOcean Spaces bucket with its regional placement */
export interface DOSpaceResource {
  name: string;
  region: string;
  creationDate?: Date;
}

/** Managed database cluster */
export interface DODatabaseResource {
  id: string;
  name: string;
  engine: DODatabaseEngine;
  version: string;
  status: DODatabaseStatus;
  region: string;
  numNodes: number;
  /** DO size slug, e.g. 'db-s-1vcpu-1gb' */
  sizeSlug: string;
  /** Estimated monthly cost in USD derived from the size slug */
  monthlyCost: number;
}

/**
 * Result returned by stopDatabase().
 *
 * When confirmDestroy=false (dry run): action = 'manual_required', snapshot = db config.
 * When confirmDestroy=true (destructive): action = 'snapshot_and_destroy', cluster is gone.
 */
export interface DODatabaseStopResult {
  action: 'snapshot_and_destroy' | 'manual_required';
  message: string;
  dbId: string;
  /** The cluster's full configuration at time of deletion, for recreation purposes */
  snapshot?: unknown;
}

/** A single DO invoice summary entry */
export interface DOInvoice {
  invoiceUuid: string;
  /** Total amount as a string (e.g. "12.34") — preserves DO's decimal precision */
  amount: string;
  /** Billing period, e.g. "2024-01" */
  invoicePeriod: string;
  updatedAt: string;
}

/** Billing history response — maps to the same shape used by AWS Cost Explorer analytics */
export interface DOBillingHistory {
  /** Month-to-date spend in USD */
  monthToDate: number;
  /** Current account credit/balance in USD */
  accountBalance: number;
  invoices: DOInvoice[];
}

// ── Google Cloud Platform Primitives ──────────────────────────────────────────

export type GCPInstanceStatus = 'RUNNING' | 'STOPPED' | 'TERMINATED' | 'PROVISIONING' | 'STAGING' | 'SUSPENDED' | 'SUSPENDING' | 'REPAIRING';
export type GCPDiskType = 'pd-standard' | 'pd-balanced' | 'pd-ssd' | 'pd-extreme';

// ── Google Cloud Platform Domain Models ──────────────────────────────────────

/**
 * Unified Compute Engine VM instance model.
 * Fields match the shared compute schema so the comparison table can render
 * GCP instances alongside AWS EC2 and DO Droplets.
 */
export interface GCPInstanceResource {
  id: string;
  name: string;
  status: GCPInstanceStatus;
  zone: string;
  /** e.g. 'n1-standard-1', 'e2-medium' */
  machineType: string;
  vcpus: number;
  /** RAM in megabytes */
  memory: number;
  /** Root disk size in gigabytes */
  diskSizeGb: number;
  /** Estimated monthly cost in USD */
  price_monthly: number;
  /** External IP address if any */
  externalIp?: string;
  /** Internal IP address */
  internalIp?: string;
  labels?: Record<string, string>;
}

/** A single GCS bucket */
export interface GCPBucketResource {
  name: string;
  location: string;
  storageClass: string;
  createdAt?: string;
}

/** GCP Cloud SQL instance */
export interface GCPSqlInstanceResource {
  name: string;
  databaseVersion: string;
  state: string;
  region: string;
  tier: string;
  /** Estimated monthly cost in USD */
  monthlyCost: number;
  /** Storage capacity in GB */
  dataDiskSizeGb: number;
  ipAddresses?: string[];
}

/** GCP billing summary */
export interface GCPBillingInfo {
  /** Month-to-date estimated spend in USD */
  monthToDate: number;
  /** Last 12 months cost breakdown */
  monthlyCosts: Array<{ month: string; cost: number }>;
}

// ── API Envelope ──────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
