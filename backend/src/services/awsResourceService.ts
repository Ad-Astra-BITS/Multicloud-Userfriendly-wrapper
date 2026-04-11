/**
 * awsResourceService.ts
 *
 * The primary AWS integration layer for Ad Astra.
 * Wraps AWS SDK v3 clients for EC2, S3, RDS, Cost Explorer, and CloudWatch.
 * All functions are async and throw on SDK errors — callers handle error propagation.
 *
 * IAM permissions required:
 *   ec2:DescribeInstances, ec2:DescribeInstanceStatus, ec2:TerminateInstances
 *   s3:ListAllMyBuckets, s3:GetBucketLocation, s3:GetLifecycleConfiguration, s3:PutLifecycleConfiguration
 *   rds:DescribeDBInstances, rds:StopDBInstance
 *   ce:GetCostAndUsage
 *   cloudwatch:GetMetricStatistics
 */

import {
  DescribeInstancesCommand,
  TerminateInstancesCommand,
  Instance,
} from '@aws-sdk/client-ec2';
import {
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketLifecycleConfigurationCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  DeleteBucketCommand,
  LifecycleRule,
} from '@aws-sdk/client-s3';
import {
  DescribeDBInstancesCommand,
  StopDBInstanceCommand,
  DBInstance,
} from '@aws-sdk/client-rds';
import {
  GetCostAndUsageCommand,
  Granularity,
  GetCostAndUsageCommandInput,
} from '@aws-sdk/client-cost-explorer';
import {
  GetMetricStatisticsCommand,
  Statistic,
} from '@aws-sdk/client-cloudwatch';
import { ec2, s3, rds, costExplorer, cloudWatch, AwsClients } from '../config/aws';
import { Resource, CostRecord, ResourceStatus } from '../types';

// Default clients (env-var credentials). Pass `clients` to use per-request creds.
type Clients = Pick<AwsClients, 'ec2' | 's3' | 'rds' | 'costExplorer' | 'cloudWatch'>;

// ─────────────────────────────────────────────────────────────────────────────
// EC2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all EC2 instances across all reservations in the configured region.
 * Monthly cost is estimated from instance type; real cost comes from Cost Explorer.
 */
export async function listEC2Instances(clients?: Clients): Promise<Resource[]> {
  const response = await (clients?.ec2 ?? ec2).send(new DescribeInstancesCommand({ MaxResults: 100 }));
  const resources: Resource[] = [];

  for (const reservation of response.Reservations ?? []) {
    for (const instance of reservation.Instances ?? []) {
      const nameTag = instance.Tags?.find((t) => t.Key === 'Name');
      resources.push({
        id: instance.InstanceId ?? '',
        awsId: instance.InstanceId ?? '',
        name: nameTag?.Value ?? instance.InstanceId ?? 'Unknown',
        type: 'EC2',
        status: mapEC2State(instance.State?.Name ?? ''),
        region: instance.Placement?.AvailabilityZone?.slice(0, -1) ?? (process.env.AWS_REGION ?? 'us-east-1'),
        monthlyCost: estimateEC2Cost(instance),
        tags: Object.fromEntries((instance.Tags ?? []).map((t) => [t.Key ?? '', t.Value ?? ''])),
      });
    }
  }

  return resources;
}

/**
 * Returns average CPU utilisation (%) for an EC2 instance over the last 24 hours.
 */
export async function getEC2CPUUtilization(instanceId: string, clients?: Clients): Promise<number> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

  const response = await (clients?.cloudWatch ?? cloudWatch).send(
    new GetMetricStatisticsCommand({
      Namespace: 'AWS/EC2',
      MetricName: 'CPUUtilization',
      Dimensions: [{ Name: 'InstanceId', Value: instanceId }],
      StartTime: startTime,
      EndTime: endTime,
      Period: 86400,
      Statistics: [Statistic.Average],
    }),
  );

  const datapoints = response.Datapoints ?? [];
  if (datapoints.length === 0) return 0;
  const avg = datapoints.reduce((sum, dp) => sum + (dp.Average ?? 0), 0) / datapoints.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Terminates a list of EC2 instances by ID.
 * Used by the Kill Switch flow after OTP verification.
 */
export async function terminateEC2Instances(instanceIds: string[], clients?: Clients): Promise<void> {
  if (instanceIds.length === 0) return;
  await (clients?.ec2 ?? ec2).send(new TerminateInstancesCommand({ InstanceIds: instanceIds }));
}

// ─────────────────────────────────────────────────────────────────────────────
// S3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all S3 buckets owned by the account and returns them as Resource objects.
 */
export async function listS3Buckets(clients?: Clients): Promise<Resource[]> {
  const listResponse = await (clients?.s3 ?? s3).send(new ListBucketsCommand({}));
  const resources: Resource[] = [];

  for (const bucket of listResponse.Buckets ?? []) {
    if (!bucket.Name) continue;
    resources.push({
      id: bucket.Name,
      awsId: bucket.Name,
      name: bucket.Name,
      type: 'S3',
      status: 'running',
      region: await getBucketRegion(bucket.Name, clients),
      monthlyCost: 0, // real cost comes from Cost Explorer
    });
  }

  return resources;
}

/** Fetches the bucket's storage region. Returns 'us-east-1' on error. */
async function getBucketRegion(bucketName: string, clients?: Clients): Promise<string> {
  try {
    const response = await (clients?.s3 ?? s3).send(new GetBucketLocationCommand({ Bucket: bucketName }));
    return response.LocationConstraint ?? 'us-east-1';
  } catch {
    return 'us-east-1';
  }
}

/** Returns the current lifecycle rules for a bucket (empty array if none). */
export async function getS3LifecycleRules(bucketName: string, clients?: Clients): Promise<LifecycleRule[]> {
  try {
    const response = await (clients?.s3 ?? s3).send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucketName }));
    return response.Rules ?? [];
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NoSuchLifecycleConfiguration') return [];
    throw err;
  }
}

/**
 * Applies a Glacier transition lifecycle rule to a bucket.
 * Optionally chains to Glacier Deep Archive after a second threshold.
 *
 * @param bucketName      Target S3 bucket
 * @param daysToGlacier   Days before objects move to Glacier
 * @param daysToDeepArchive  (optional) Additional days before Deep Archive
 */
export async function applyGlacierLifecycle(
  bucketName: string,
  daysToGlacier: number,
  daysToDeepArchive?: number,
  clients?: Clients,
): Promise<void> {
  const rules: LifecycleRule[] = [
    {
      ID: 'ad-astra-glacier-transition',
      Status: 'Enabled',
      Filter: { Prefix: '' },
      Transitions: [
        { Days: daysToGlacier, StorageClass: 'GLACIER' },
        ...(daysToDeepArchive
          ? [{ Days: daysToDeepArchive, StorageClass: 'DEEP_ARCHIVE' as const }]
          : []),
      ],
    },
  ];

  await (clients?.s3 ?? s3).send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName,
      LifecycleConfiguration: { Rules: rules },
    }),
  );
}

/**
 * Switches a bucket to Intelligent-Tiering by setting a Day 0 transition rule.
 */
export async function applyIntelligentTiering(bucketName: string, clients?: Clients): Promise<void> {
  const rules: LifecycleRule[] = [
    {
      ID: 'ad-astra-intelligent-tiering',
      Status: 'Enabled',
      Filter: { Prefix: '' },
      Transitions: [{ Days: 0, StorageClass: 'INTELLIGENT_TIERING' }],
    },
  ];

  await (clients?.s3 ?? s3).send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName,
      LifecycleConfiguration: { Rules: rules },
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RDS
// ─────────────────────────────────────────────────────────────────────────────

/** Lists all RDS DB instances in the region and returns them as Resource objects. */
export async function listRDSInstances(clients?: Clients): Promise<Resource[]> {
  const response = await (clients?.rds ?? rds).send(new DescribeDBInstancesCommand({}));
  return (response.DBInstances ?? []).map((db) => ({
    id: db.DBInstanceIdentifier ?? '',
    awsId: db.DBInstanceIdentifier ?? '',
    name: db.DBInstanceIdentifier ?? 'Unknown',
    type: 'RDS' as const,
    status: mapRDSStatus(db.DBInstanceStatus ?? ''),
    region: db.AvailabilityZone?.slice(0, -1) ?? (process.env.AWS_REGION ?? 'us-east-1'),
    monthlyCost: estimateRDSCost(db),
  }));
}

/** Stops a running RDS instance (does not delete; resumes on next start). */
export async function stopRDSInstance(dbIdentifier: string, clients?: Clients): Promise<void> {
  await (clients?.rds ?? rds).send(new StopDBInstanceCommand({ DBInstanceIdentifier: dbIdentifier }));
}

/**
 * Empties and deletes an S3 bucket.
 * First deletes all objects (in batches of 1000), then deletes the bucket itself.
 */
export async function deleteS3Bucket(bucketName: string, clients?: Clients): Promise<void> {
  const client = clients?.s3 ?? s3;

  // Delete all objects in batches
  let continuationToken: string | undefined;
  do {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: bucketName,
      ContinuationToken: continuationToken,
    }));

    const objects = listed.Contents ?? [];
    if (objects.length > 0) {
      await client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects.map((o) => ({ Key: o.Key! })) },
      }));
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);

  // Delete the now-empty bucket
  await client.send(new DeleteBucketCommand({ Bucket: bucketName }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Explorer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches unblended cost grouped by AWS service for the past N months.
 * Returns one CostRecord per (month, service) pair.
 */
export async function getMonthlyCostsByService(months = 6, clients?: Clients): Promise<CostRecord[]> {
  const endDate = toDateString(new Date());
  const startDate = toDateString(subtractMonths(new Date(), months));

  const input: GetCostAndUsageCommandInput = {
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: Granularity.MONTHLY,
    Metrics: ['UnblendedCost'],
    GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
  };

  const response = await (clients?.costExplorer ?? costExplorer).send(new GetCostAndUsageCommand(input));
  const records: CostRecord[] = [];

  for (const result of response.ResultsByTime ?? []) {
    const month = result.TimePeriod?.Start?.slice(0, 7) ?? '';
    for (const group of result.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Other';
      const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? '0');
      if (cost > 0) records.push({ month, service, cost: round2(cost) });
    }
  }

  return records;
}

/**
 * Fetches total unblended cost per month (all services combined).
 */
export async function getTotalCostPerMonth(months = 6, clients?: Clients): Promise<{ month: string; cost: number }[]> {
  const endDate = toDateString(new Date());
  const startDate = toDateString(subtractMonths(new Date(), months));

  const input: GetCostAndUsageCommandInput = {
    TimePeriod: { Start: startDate, End: endDate },
    Granularity: Granularity.MONTHLY,
    Metrics: ['UnblendedCost'],
  };

  const response = await (clients?.costExplorer ?? costExplorer).send(new GetCostAndUsageCommand(input));

  return (response.ResultsByTime ?? []).map((result) => ({
    month: result.TimePeriod?.Start?.slice(0, 7) ?? '',
    cost: round2(parseFloat(result.Total?.UnblendedCost?.Amount ?? '0')),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapEC2State(state: string): ResourceStatus {
  const map: Record<string, ResourceStatus> = {
    running: 'running',
    stopped: 'stopped',
    'shutting-down': 'terminated',
    terminated: 'terminated',
  };
  return map[state] ?? 'warning';
}

function mapRDSStatus(status: string): ResourceStatus {
  if (status === 'available') return 'running';
  if (status === 'stopped') return 'stopped';
  return 'warning';
}

// Rough on-demand price estimates (USD/month) — Cost Explorer gives exact values.
const EC2_PRICE_MAP: Record<string, number> = {
  't3.nano': 3.8, 't3.micro': 7.6, 't3.small': 15.18, 't3.medium': 30.37,
  't3.large': 60.74, 't3.xlarge': 121.47, 't3.2xlarge': 242.94,
  'm5.large': 70.08, 'm5.xlarge': 140.16, 'm5.2xlarge': 280.32,
  'r5.large': 91.98, 'r5.xlarge': 183.96, 'r5.2xlarge': 367.92,
};

const RDS_PRICE_MAP: Record<string, number> = {
  'db.t3.micro': 12.41, 'db.t3.small': 24.82, 'db.t3.medium': 49.64,
  'db.m5.large': 131.4, 'db.m5.xlarge': 262.8,
  'db.r5.large': 175.2, 'db.r5.xlarge': 350.4,
};

function estimateEC2Cost(instance: Instance): number {
  return EC2_PRICE_MAP[instance.InstanceType ?? ''] ?? 50;
}

function estimateRDSCost(db: DBInstance): number {
  return RDS_PRICE_MAP[db.DBInstanceClass ?? ''] ?? 100;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function subtractMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() - months);
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
