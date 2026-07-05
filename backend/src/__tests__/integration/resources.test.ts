import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { ec2Running, ec2Stopped, s3Bucket, rdsRunning, dbAlertRow } from '../helpers/fixtures';

vi.mock('../../services/awsResourceService', () => ({
  listEC2Instances: vi.fn(),
  listS3Buckets: vi.fn(),
  listRDSInstances: vi.fn(),
  terminateEC2Instances: vi.fn(),
  stopRDSInstance: vi.fn(),
  deleteS3Bucket: vi.fn(),
  getMonthlyCostsByService: vi.fn(),
  getTotalCostPerMonth: vi.fn(),
  getEC2CPUUtilization: vi.fn(),
  getS3LifecycleRules: vi.fn(),
  applyGlacierLifecycle: vi.fn(),
  applyIntelligentTiering: vi.fn(),
}));

vi.mock('../../config/database', () => ({
  prisma: {
    alert: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    resource: { count: vi.fn(), upsert: vi.fn() },
    recommendation: { aggregate: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    costRecord: { upsert: vi.fn(), findMany: vi.fn() },
    otpVerification: { updateMany: vi.fn(), create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    s3Bucket: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

import * as awsService from '../../services/awsResourceService';
import { prisma } from '../../config/database';

const mockedListEC2 = () => vi.mocked(awsService.listEC2Instances);
const mockedListS3 = () => vi.mocked(awsService.listS3Buckets);
const mockedListRDS = () => vi.mocked(awsService.listRDSInstances);
const mockedAlerts = () => vi.mocked(prisma.alert.findMany);
const mockedAlertUpdate = () => vi.mocked(prisma.alert.update);

describe('GET /api/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListEC2().mockResolvedValue([ec2Running, ec2Stopped]);
    mockedListS3().mockResolvedValue([s3Bucket]);
    mockedListRDS().mockResolvedValue([rdsRunning]);
  });

  it('returns 200 with all resources merged from EC2 + S3 + RDS', async () => {
    const res = await request(app).get('/api/resources');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(4); // 2 EC2 + 1 S3 + 1 RDS
  });

  it('includes all resource types in the response', async () => {
    const res = await request(app).get('/api/resources');
    const types = res.body.data.map((r: any) => r.type);
    expect(types).toContain('EC2');
    expect(types).toContain('S3');
    expect(types).toContain('RDS');
  });

  it('returns 500 when a service call throws', async () => {
    mockedListEC2().mockRejectedValue(new Error('AWS SDK error'));

    const res = await request(app).get('/api/resources');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/resources/:type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListEC2().mockResolvedValue([ec2Running, ec2Stopped]);
    mockedListS3().mockResolvedValue([s3Bucket]);
    mockedListRDS().mockResolvedValue([rdsRunning]);
  });

  it('returns EC2 instances when type is ec2 (case-insensitive)', async () => {
    const res = await request(app).get('/api/resources/ec2');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((r: any) => r.type === 'EC2')).toBe(true);
  });

  it('returns EC2 instances when type is uppercased EC2', async () => {
    const res = await request(app).get('/api/resources/EC2');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns S3 buckets when type is s3', async () => {
    const res = await request(app).get('/api/resources/s3');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('S3');
    expect(res.body.data[0].name).toBe('my-app-assets');
  });

  it('returns RDS instances when type is rds', async () => {
    const res = await request(app).get('/api/resources/rds');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('RDS');
  });

  it('returns 400 for unknown resource type', async () => {
    const res = await request(app).get('/api/resources/ec3');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/ec2, s3, or rds/i);
  });

  it('returns 400 for completely invalid type', async () => {
    const res = await request(app).get('/api/resources/lambda');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns empty array when no resources of that type exist', async () => {
    mockedListRDS().mockResolvedValue([]);

    const res = await request(app).get('/api/resources/rds');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /api/resources/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with unresolved alerts from DB', async () => {
    mockedAlerts().mockResolvedValue([dbAlertRow] as any);

    const res = await request(app).get('/api/resources/alerts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('alert-001');
  });

  it('returns empty array when there are no unresolved alerts', async () => {
    mockedAlerts().mockResolvedValue([]);

    const res = await request(app).get('/api/resources/alerts');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 500 when DB query fails', async () => {
    mockedAlerts().mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/api/resources/alerts');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/resources/alerts/:id/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with the resolved alert', async () => {
    const resolvedRow = { ...dbAlertRow, resolved: true, resolvedAt: new Date() };
    mockedAlertUpdate().mockResolvedValue(resolvedRow as any);

    const res = await request(app).patch('/api/resources/alerts/alert-001/resolve');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/resolved/i);
  });

  it('returns 500 when alert ID does not exist (Prisma throws)', async () => {
    const notFound = new Error('Record not found');
    (notFound as any).code = 'P2025';
    mockedAlertUpdate().mockRejectedValue(notFound);

    const res = await request(app).patch('/api/resources/alerts/nonexistent/resolve');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
