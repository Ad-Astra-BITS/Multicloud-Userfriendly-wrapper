import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the AWS config module so the service uses controllable fake clients
vi.mock('../../config/aws', () => ({
  ec2: { send: vi.fn() },
  s3: { send: vi.fn() },
  rds: { send: vi.fn() },
  costExplorer: { send: vi.fn() },
  cloudWatch: { send: vi.fn() },
  sts: { send: vi.fn() },
  createAwsClients: vi.fn(),
}));

import {
  listEC2Instances,
  listS3Buckets,
  listRDSInstances,
  terminateEC2Instances,
  deleteS3Bucket,
  stopRDSInstance,
  getMonthlyCostsByService,
  getTotalCostPerMonth,
  getEC2CPUUtilization,
} from '../../services/awsResourceService';
import { ec2, s3, rds, costExplorer, cloudWatch } from '../../config/aws';

const mockEc2Send = vi.mocked(ec2.send);
const mockS3Send = vi.mocked(s3.send);
const mockRdsSend = vi.mocked(rds.send);
const mockCeSend = vi.mocked(costExplorer.send);
const mockCwSend = vi.mocked(cloudWatch.send);

// ── listEC2Instances ──────────────────────────────────────────────────────────

describe('listEC2Instances', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty array when there are no reservations', async () => {
    mockEc2Send.mockResolvedValueOnce({ Reservations: [] });

    const result = await listEC2Instances();

    expect(result).toEqual([]);
  });

  it('maps running EC2 instances to Resource objects', async () => {
    mockEc2Send.mockResolvedValueOnce({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: 'i-0abc123',
              State: { Name: 'running' },
              InstanceType: 't3.medium',
              Placement: { AvailabilityZone: 'us-east-1a' },
              Tags: [{ Key: 'Name', Value: 'my-server' }],
            },
          ],
        },
      ],
    });

    const result = await listEC2Instances();

    expect(result).toHaveLength(1);
    expect(result[0].awsId).toBe('i-0abc123');
    expect(result[0].name).toBe('my-server');
    expect(result[0].type).toBe('EC2');
    expect(result[0].status).toBe('running');
    expect(result[0].region).toBe('us-east-1');
  });

  it('maps stopped state to "stopped" status', async () => {
    mockEc2Send.mockResolvedValueOnce({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: 'i-stopped',
              State: { Name: 'stopped' },
              InstanceType: 't3.micro',
              Placement: { AvailabilityZone: 'us-west-2a' },
              Tags: [],
            },
          ],
        },
      ],
    });

    const result = await listEC2Instances();

    expect(result[0].status).toBe('stopped');
    expect(result[0].region).toBe('us-west-2');
  });

  it('maps shutting-down state to "terminated"', async () => {
    mockEc2Send.mockResolvedValueOnce({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: 'i-terminating',
              State: { Name: 'shutting-down' },
              InstanceType: 't3.nano',
              Placement: { AvailabilityZone: 'us-east-1b' },
              Tags: [],
            },
          ],
        },
      ],
    });

    const result = await listEC2Instances();

    expect(result[0].status).toBe('terminated');
  });

  it('uses instance ID as name when Name tag is absent', async () => {
    mockEc2Send.mockResolvedValueOnce({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: 'i-noname',
              State: { Name: 'running' },
              InstanceType: 't3.nano',
              Placement: { AvailabilityZone: 'us-east-1c' },
              Tags: [],
            },
          ],
        },
      ],
    });

    const result = await listEC2Instances();

    expect(result[0].name).toBe('i-noname');
  });

  it('includes estimated monthly cost based on instance type', async () => {
    mockEc2Send.mockResolvedValueOnce({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: 'i-priced',
              State: { Name: 'running' },
              InstanceType: 't3.medium',
              Placement: { AvailabilityZone: 'us-east-1a' },
              Tags: [],
            },
          ],
        },
      ],
    });

    const result = await listEC2Instances();

    expect(result[0].monthlyCost).toBe(30.37);
  });

  it('handles multiple reservations with multiple instances', async () => {
    mockEc2Send.mockResolvedValueOnce({
      Reservations: [
        {
          Instances: [
            { InstanceId: 'i-1', State: { Name: 'running' }, InstanceType: 't3.nano', Placement: { AvailabilityZone: 'us-east-1a' }, Tags: [] },
            { InstanceId: 'i-2', State: { Name: 'stopped' }, InstanceType: 't3.micro', Placement: { AvailabilityZone: 'us-east-1a' }, Tags: [] },
          ],
        },
        {
          Instances: [
            { InstanceId: 'i-3', State: { Name: 'running' }, InstanceType: 'm5.large', Placement: { AvailabilityZone: 'us-east-1b' }, Tags: [] },
          ],
        },
      ],
    });

    const result = await listEC2Instances();

    expect(result).toHaveLength(3);
  });

  it('propagates SDK errors', async () => {
    mockEc2Send.mockRejectedValueOnce(new Error('EC2 access denied'));

    await expect(listEC2Instances()).rejects.toThrow('EC2 access denied');
  });
});

// ── listS3Buckets ─────────────────────────────────────────────────────────────

describe('listS3Buckets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty array when no buckets exist', async () => {
    mockS3Send.mockResolvedValueOnce({ Buckets: [] });

    const result = await listS3Buckets();

    expect(result).toEqual([]);
  });

  it('maps S3 buckets to Resource objects with type=S3 and status=running', async () => {
    // First call: ListBucketsCommand; subsequent calls: GetBucketLocationCommand per bucket
    mockS3Send
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }, { Name: 'another-bucket' }] })
      .mockResolvedValueOnce({ LocationConstraint: 'us-west-2' })
      .mockResolvedValueOnce({ LocationConstraint: 'eu-west-1' });

    const result = await listS3Buckets();

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('S3');
    expect(result[0].status).toBe('running');
    expect(result[0].name).toBe('my-bucket');
    expect(result[0].region).toBe('us-west-2');
    expect(result[1].region).toBe('eu-west-1');
  });

  it('falls back to us-east-1 when GetBucketLocation fails', async () => {
    mockS3Send
      .mockResolvedValueOnce({ Buckets: [{ Name: 'locked-bucket' }] })
      .mockRejectedValueOnce(new Error('Access Denied'));

    const result = await listS3Buckets();

    expect(result[0].region).toBe('us-east-1');
  });

  it('skips buckets with no Name field', async () => {
    mockS3Send.mockResolvedValueOnce({ Buckets: [{ Name: undefined }] });

    const result = await listS3Buckets();

    expect(result).toHaveLength(0);
  });
});

// ── listRDSInstances ──────────────────────────────────────────────────────────

describe('listRDSInstances', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps available RDS instances to Resource with status running', async () => {
    mockRdsSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: 'prod-db',
          DBInstanceStatus: 'available',
          DBInstanceClass: 'db.t3.medium',
          AvailabilityZone: 'us-east-1a',
        },
      ],
    });

    const result = await listRDSInstances();

    expect(result).toHaveLength(1);
    expect(result[0].awsId).toBe('prod-db');
    expect(result[0].type).toBe('RDS');
    expect(result[0].status).toBe('running');
    expect(result[0].monthlyCost).toBe(49.64);
    expect(result[0].region).toBe('us-east-1');
  });

  it('maps stopped RDS to status stopped', async () => {
    mockRdsSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: 'stopped-db',
          DBInstanceStatus: 'stopped',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a',
        },
      ],
    });

    const result = await listRDSInstances();

    expect(result[0].status).toBe('stopped');
  });

  it('maps unknown RDS status to warning', async () => {
    mockRdsSend.mockResolvedValueOnce({
      DBInstances: [
        {
          DBInstanceIdentifier: 'backup-db',
          DBInstanceStatus: 'backing-up',
          DBInstanceClass: 'db.t3.micro',
          AvailabilityZone: 'us-east-1a',
        },
      ],
    });

    const result = await listRDSInstances();

    expect(result[0].status).toBe('warning');
  });

  it('returns empty array when no DB instances', async () => {
    mockRdsSend.mockResolvedValueOnce({ DBInstances: [] });

    const result = await listRDSInstances();

    expect(result).toEqual([]);
  });
});

// ── terminateEC2Instances ─────────────────────────────────────────────────────

describe('terminateEC2Instances', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends TerminateInstancesCommand with the provided IDs', async () => {
    mockEc2Send.mockResolvedValueOnce({ TerminatingInstances: [] });

    await terminateEC2Instances(['i-001', 'i-002']);

    expect(mockEc2Send).toHaveBeenCalledOnce();
  });

  it('does nothing when the instances array is empty', async () => {
    await terminateEC2Instances([]);

    expect(mockEc2Send).not.toHaveBeenCalled();
  });

  it('propagates SDK errors', async () => {
    mockEc2Send.mockRejectedValueOnce(new Error('Unauthorized'));

    await expect(terminateEC2Instances(['i-001'])).rejects.toThrow('Unauthorized');
  });
});

// ── stopRDSInstance ───────────────────────────────────────────────────────────

describe('stopRDSInstance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls StopDBInstanceCommand for a regular RDS instance', async () => {
    // DescribeDBInstances returns instance without a cluster identifier
    mockRdsSend
      .mockResolvedValueOnce({ DBInstances: [{ DBInstanceIdentifier: 'my-db', DBClusterIdentifier: undefined }] })
      .mockResolvedValueOnce({}); // StopDBInstanceCommand

    await stopRDSInstance('my-db');

    expect(mockRdsSend).toHaveBeenCalledTimes(2);
  });

  it('calls StopDBClusterCommand for an Aurora instance', async () => {
    mockRdsSend
      .mockResolvedValueOnce({ DBInstances: [{ DBInstanceIdentifier: 'aurora-instance', DBClusterIdentifier: 'my-aurora-cluster' }] })
      .mockResolvedValueOnce({}); // StopDBClusterCommand

    await stopRDSInstance('aurora-instance');

    expect(mockRdsSend).toHaveBeenCalledTimes(2);
  });
});

// ── getMonthlyCostsByService ──────────────────────────────────────────────────

describe('getMonthlyCostsByService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cost records for each service group', async () => {
    mockCeSend.mockResolvedValueOnce({
      ResultsByTime: [
        {
          TimePeriod: { Start: '2024-03-01' },
          Groups: [
            { Keys: ['Amazon EC2'], Metrics: { UnblendedCost: { Amount: '150.50' } } },
            { Keys: ['Amazon S3'], Metrics: { UnblendedCost: { Amount: '25.00' } } },
          ],
        },
      ],
    });

    const result = await getMonthlyCostsByService(1);

    expect(result).toHaveLength(2);
    expect(result[0].service).toBe('Amazon EC2');
    expect(result[0].cost).toBe(150.50);
    expect(result[0].month).toBe('2024-03');
    expect(result[1].service).toBe('Amazon S3');
    expect(result[1].cost).toBe(25.00);
  });

  it('excludes groups with zero cost', async () => {
    mockCeSend.mockResolvedValueOnce({
      ResultsByTime: [
        {
          TimePeriod: { Start: '2024-03-01' },
          Groups: [
            { Keys: ['Amazon EC2'], Metrics: { UnblendedCost: { Amount: '100.00' } } },
            { Keys: ['Tax'], Metrics: { UnblendedCost: { Amount: '0.00' } } },
          ],
        },
      ],
    });

    const result = await getMonthlyCostsByService(1);

    expect(result).toHaveLength(1);
    expect(result.find((r) => r.service === 'Tax')).toBeUndefined();
  });

  it('returns empty array when ResultsByTime is empty', async () => {
    mockCeSend.mockResolvedValueOnce({ ResultsByTime: [] });

    const result = await getMonthlyCostsByService(1);

    expect(result).toEqual([]);
  });

  it('rounds costs to 2 decimal places', async () => {
    mockCeSend.mockResolvedValueOnce({
      ResultsByTime: [
        {
          TimePeriod: { Start: '2024-03-01' },
          Groups: [
            { Keys: ['Amazon EC2'], Metrics: { UnblendedCost: { Amount: '150.555' } } },
          ],
        },
      ],
    });

    const result = await getMonthlyCostsByService(1);

    expect(result[0].cost).toBe(150.56);
  });
});

// ── getTotalCostPerMonth ──────────────────────────────────────────────────────

describe('getTotalCostPerMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns total monthly costs', async () => {
    mockCeSend.mockResolvedValueOnce({
      ResultsByTime: [
        { TimePeriod: { Start: '2024-01-01' }, Total: { UnblendedCost: { Amount: '210.00' } } },
        { TimePeriod: { Start: '2024-02-01' }, Total: { UnblendedCost: { Amount: '235.50' } } },
      ],
    });

    const result = await getTotalCostPerMonth(2);

    expect(result).toHaveLength(2);
    expect(result[0].month).toBe('2024-01');
    expect(result[0].cost).toBe(210.00);
    expect(result[1].month).toBe('2024-02');
    expect(result[1].cost).toBe(235.50);
  });
});

// ── getEC2CPUUtilization ──────────────────────────────────────────────────────

describe('getEC2CPUUtilization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns average CPU across datapoints', async () => {
    mockCwSend.mockResolvedValueOnce({
      Datapoints: [{ Average: 10 }, { Average: 20 }, { Average: 30 }],
    });

    const cpu = await getEC2CPUUtilization('i-0abc123');

    expect(cpu).toBe(20); // (10+20+30)/3 = 20
  });

  it('returns 0 when no datapoints are available', async () => {
    mockCwSend.mockResolvedValueOnce({ Datapoints: [] });

    const cpu = await getEC2CPUUtilization('i-0abc123');

    expect(cpu).toBe(0);
  });

  it('rounds CPU to 2 decimal places', async () => {
    mockCwSend.mockResolvedValueOnce({
      Datapoints: [{ Average: 3.33333 }, { Average: 6.66667 }],
    });

    const cpu = await getEC2CPUUtilization('i-0abc123');

    // (3.33333 + 6.66667) / 2 = 5.00000 → 5.0
    expect(cpu).toBe(5);
  });
});

// ── deleteS3Bucket ────────────────────────────────────────────────────────────

describe('deleteS3Bucket', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes all objects then the bucket itself', async () => {
    // ListObjectsV2Command → returns 2 objects, no continuation token
    mockS3Send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'file1.txt' }, { Key: 'file2.txt' }],
        IsTruncated: false,
        NextContinuationToken: undefined,
      })
      // DeleteObjectsCommand
      .mockResolvedValueOnce({ Deleted: [{ Key: 'file1.txt' }, { Key: 'file2.txt' }] })
      // DeleteBucketCommand
      .mockResolvedValueOnce({});

    await deleteS3Bucket('my-test-bucket');

    expect(mockS3Send).toHaveBeenCalledTimes(3);
  });

  it('handles empty bucket (no objects to delete)', async () => {
    mockS3Send
      .mockResolvedValueOnce({ Contents: [], IsTruncated: false })
      .mockResolvedValueOnce({}); // DeleteBucketCommand

    await deleteS3Bucket('empty-bucket');

    // ListObjects + DeleteBucket = 2 calls (no DeleteObjects since no contents)
    expect(mockS3Send).toHaveBeenCalledTimes(2);
  });
});
