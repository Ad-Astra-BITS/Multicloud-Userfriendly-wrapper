import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { ec2Running, ec2Stopped, s3Bucket, rdsRunning } from '../helpers/fixtures';

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
    otpVerification: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    alert: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    resource: { count: vi.fn(), upsert: vi.fn() },
    recommendation: { aggregate: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    costRecord: { upsert: vi.fn(), findMany: vi.fn() },
    s3Bucket: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

import * as awsService from '../../services/awsResourceService';
import { prisma } from '../../config/database';

const AWS_HEADERS = {
  'x-aws-access-key-id': 'AKIAIOSFODNN7EXAMPLE',
  'x-aws-secret-access-key': 'test-secret',
  'x-aws-region': 'us-east-1',
};

describe('GET /api/kill-switch/resources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(awsService.listEC2Instances).mockResolvedValue([ec2Running, ec2Stopped]);
    vi.mocked(awsService.listS3Buckets).mockResolvedValue([s3Bucket]);
    vi.mocked(awsService.listRDSInstances).mockResolvedValue([rdsRunning]);
  });

  it('returns 200 with grouped resources (EC2/S3/RDS)', async () => {
    const res = await request(app).get('/api/kill-switch/resources').set(AWS_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('ec2');
    expect(res.body.data).toHaveProperty('s3');
    expect(res.body.data).toHaveProperty('rds');
  });

  it('only includes running EC2 instances (filters out stopped)', async () => {
    const res = await request(app).get('/api/kill-switch/resources').set(AWS_HEADERS);

    // ec2Running is 'running', ec2Stopped is 'stopped' → only 1 in the response
    expect(res.body.data.ec2).toHaveLength(1);
    expect(res.body.data.ec2[0].id).toBe(ec2Running.awsId);
  });

  it('includes all S3 buckets regardless of status', async () => {
    const res = await request(app).get('/api/kill-switch/resources').set(AWS_HEADERS);

    expect(res.body.data.s3).toHaveLength(1);
    expect(res.body.data.s3[0].name).toBe('my-app-assets');
  });

  it('only includes running RDS instances', async () => {
    const stoppedRDS = { ...rdsRunning, status: 'stopped' as const };
    vi.mocked(awsService.listRDSInstances).mockResolvedValue([rdsRunning, stoppedRDS]);

    const res = await request(app).get('/api/kill-switch/resources').set(AWS_HEADERS);

    expect(res.body.data.rds).toHaveLength(1);
    expect(res.body.data.rds[0].status).toBe('running');
  });

  it('each resource entry has id, name, status, region', async () => {
    const res = await request(app).get('/api/kill-switch/resources').set(AWS_HEADERS);
    const ec2Entry = res.body.data.ec2[0];

    expect(ec2Entry).toHaveProperty('id');
    expect(ec2Entry).toHaveProperty('name');
    expect(ec2Entry).toHaveProperty('status');
    expect(ec2Entry).toHaveProperty('region');
  });

  it('returns 500 when AWS service throws', async () => {
    vi.mocked(awsService.listEC2Instances).mockRejectedValue(new Error('Auth failed'));

    const res = await request(app).get('/api/kill-switch/resources').set(AWS_HEADERS);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/kill-switch/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.otpVerification.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.otpVerification.create).mockResolvedValue({
      id: 'otp-row-1',
      code: '123456',
      action: 'KILL_SWITCH',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      used: false,
      createdAt: new Date(),
    } as any);
  });

  it('returns 200 with a 6-digit OTP and expiry', async () => {
    const res = await request(app).post('/api/kill-switch/initiate');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.otp).toMatch(/^\d{6}$/);
    expect(res.body.data.expiresAt).toBeTruthy();
    expect(res.body.message).toBeTruthy();
  });

  it('invalidates previous unused OTPs before creating a new one', async () => {
    await request(app).post('/api/kill-switch/initiate');

    expect(prisma.otpVerification.updateMany).toHaveBeenCalledWith({
      where: { action: 'KILL_SWITCH', used: false },
      data: { used: true },
    });
  });

  it('creates a new OTP record in the database', async () => {
    await request(app).post('/api/kill-switch/initiate');

    expect(prisma.otpVerification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'KILL_SWITCH',
        }),
      }),
    );
  });

  it('returns 500 when DB create throws', async () => {
    vi.mocked(prisma.otpVerification.create).mockRejectedValue(
      new Error('DB write failed'),
    );

    const res = await request(app).post('/api/kill-switch/initiate');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/kill-switch/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when otp field is missing from body', async () => {
    const res = await request(app).post('/api/kill-switch/verify').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/otp is required/i);
  });

  it('returns 400 when otp is not a string', async () => {
    const res = await request(app)
      .post('/api/kill-switch/verify')
      .send({ otp: 123456 }); // number, not string

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when OTP is incorrect (not found in DB)', async () => {
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/kill-switch/verify')
      .send({ otp: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('returns 200 with execToken when OTP is correct', async () => {
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue({
      id: 'otp-1',
      code: '654321',
      action: 'KILL_SWITCH',
      used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.update).mockResolvedValue({} as any);

    const res = await request(app)
      .post('/api/kill-switch/verify')
      .send({ otp: '654321' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.execToken).toBe('string');
    expect(res.body.data.execToken.length).toBeGreaterThan(0);
    expect(res.body.message).toMatch(/verified/i);
  });

  it('marks the OTP as used after successful verification', async () => {
    const otpId = 'otp-to-consume';
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue({
      id: otpId,
      code: '111111',
      action: 'KILL_SWITCH',
      used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.update).mockResolvedValue({} as any);

    await request(app).post('/api/kill-switch/verify').send({ otp: '111111' });

    expect(prisma.otpVerification.update).toHaveBeenCalledWith({
      where: { id: otpId },
      data: { used: true },
    });
  });
});

describe('POST /api/kill-switch/execute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(awsService.listEC2Instances).mockResolvedValue([ec2Running]);
    vi.mocked(awsService.listS3Buckets).mockResolvedValue([s3Bucket]);
    vi.mocked(awsService.listRDSInstances).mockResolvedValue([rdsRunning]);
    vi.mocked(awsService.terminateEC2Instances).mockResolvedValue(undefined);
    vi.mocked(awsService.deleteS3Bucket).mockResolvedValue(undefined);
    vi.mocked(awsService.stopRDSInstance).mockResolvedValue(undefined);
  });

  it('returns 401 when execToken is missing', async () => {
    const res = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({ selectedResources: {} });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/execToken/i);
  });

  it('returns 401 for a made-up execToken', async () => {
    const res = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({ execToken: 'fake-token-that-does-not-exist' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('executes full kill-switch flow: initiate → verify → execute', async () => {
    // Stage 1: Initiate — get OTP
    vi.mocked(prisma.otpVerification.updateMany).mockResolvedValue({ count: 0 });
    let generatedOtp = '';
    vi.mocked(prisma.otpVerification.create).mockImplementation(async (args: any) => {
      generatedOtp = args.data.code;
      return { id: 'otp-1', ...args.data, createdAt: new Date() } as any;
    });

    const initiateRes = await request(app).post('/api/kill-switch/initiate');
    expect(initiateRes.status).toBe(200);
    const otp = initiateRes.body.data.otp;
    expect(otp).toMatch(/^\d{6}$/);

    // Stage 2: Verify — exchange OTP for execToken
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue({
      id: 'otp-1',
      code: otp,
      action: 'KILL_SWITCH',
      used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.update).mockResolvedValue({} as any);

    const verifyRes = await request(app)
      .post('/api/kill-switch/verify')
      .send({ otp });
    expect(verifyRes.status).toBe(200);
    const { execToken } = verifyRes.body.data;

    // Stage 3: Execute — use execToken to terminate resources
    const executeRes = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({
        execToken,
        selectedResources: {
          ec2: [ec2Running.awsId],
          s3: [s3Bucket.name],
          rds: [rdsRunning.awsId],
        },
      });

    expect(executeRes.status).toBe(200);
    expect(executeRes.body.success).toBe(true);
    expect(executeRes.body.data.terminatedEC2).toBe(1);
    expect(executeRes.body.data.deletedS3).toBe(1);
    expect(executeRes.body.data.stoppedRDS).toBe(1);
    expect(executeRes.body.data.errors).toHaveLength(0);
  });

  it('execToken can only be used once (single-use)', async () => {
    // Get a valid execToken through the flow
    vi.mocked(prisma.otpVerification.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.otpVerification.create).mockResolvedValue({
      id: 'otp-2', code: '999888', action: 'KILL_SWITCH',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), used: false, createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue({
      id: 'otp-2', code: '999888', action: 'KILL_SWITCH', used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.update).mockResolvedValue({} as any);

    await request(app).post('/api/kill-switch/initiate');
    const verifyRes = await request(app)
      .post('/api/kill-switch/verify')
      .send({ otp: '999888' });
    const { execToken } = verifyRes.body.data;

    // First execute — succeeds
    const first = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({ execToken });
    expect(first.status).toBe(200);

    // Second execute with the same token — must fail
    const second = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({ execToken });
    expect(second.status).toBe(401);
  });

  it('only destroys resources in the selectedResources intersection', async () => {
    vi.mocked(awsService.listEC2Instances).mockResolvedValue([ec2Running, ec2Stopped]);

    // Get a fresh execToken
    vi.mocked(prisma.otpVerification.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.otpVerification.create).mockResolvedValue({
      id: 'otp-3', code: '777666', action: 'KILL_SWITCH',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), used: false, createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue({
      id: 'otp-3', code: '777666', action: 'KILL_SWITCH', used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.update).mockResolvedValue({} as any);

    await request(app).post('/api/kill-switch/initiate');
    const verifyRes = await request(app)
      .post('/api/kill-switch/verify')
      .send({ otp: '777666' });
    const { execToken } = verifyRes.body.data;

    // Only select ec2Running — ec2Stopped is stopped so it's not in running list anyway
    const executeRes = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({
        execToken,
        selectedResources: { ec2: [ec2Running.awsId], s3: [], rds: [] },
      });

    expect(executeRes.status).toBe(200);
    expect(executeRes.body.data.terminatedEC2).toBe(1);
    expect(executeRes.body.data.deletedS3).toBe(0);
    // terminateEC2Instances should be called only with the selected running instance
    expect(awsService.terminateEC2Instances).toHaveBeenCalledWith(
      [ec2Running.awsId],
      expect.anything(),
    );
  });

  it('reports partial errors but still returns success:true', async () => {
    vi.mocked(awsService.deleteS3Bucket).mockRejectedValue(
      new Error('AccessDenied: insufficient permissions'),
    );

    // Fresh execToken
    vi.mocked(prisma.otpVerification.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.otpVerification.create).mockResolvedValue({
      id: 'otp-4', code: '555444', action: 'KILL_SWITCH',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), used: false, createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.findFirst).mockResolvedValue({
      id: 'otp-4', code: '555444', action: 'KILL_SWITCH', used: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), createdAt: new Date(),
    } as any);
    vi.mocked(prisma.otpVerification.update).mockResolvedValue({} as any);

    await request(app).post('/api/kill-switch/initiate');
    const verifyRes = await request(app).post('/api/kill-switch/verify').send({ otp: '555444' });
    const { execToken } = verifyRes.body.data;

    const executeRes = await request(app)
      .post('/api/kill-switch/execute')
      .set(AWS_HEADERS)
      .send({
        execToken,
        selectedResources: { s3: [s3Bucket.name] },
      });

    expect(executeRes.status).toBe(200);
    expect(executeRes.body.success).toBe(true); // still success even with errors
    expect(executeRes.body.data.deletedS3).toBe(0);
    expect(executeRes.body.data.errors.length).toBeGreaterThan(0);
    expect(executeRes.body.data.errors[0]).toMatch(/my-app-assets/);
    expect(executeRes.body.message).toMatch(/partial/i);
  });
});
