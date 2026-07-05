import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import type { S3Bucket } from '../../types';

vi.mock('../../services/s3LifecycleService', () => ({
  listBucketsWithRecommendations: vi.fn(),
  applyTierChange: vi.fn(),
  applyAllTierChanges: vi.fn(),
}));

import * as s3Service from '../../services/s3LifecycleService';

const standardBucket: S3Bucket = {
  id: 'my-app-assets',
  awsBucketName: 'my-app-assets',
  currentTier: 'Standard',
  recommendedTier: 'Intelligent Tiering',
  sizeBytes: 5_368_709_120, // 5 GB
  estimatedSavings: 3.45,
  lifecycleApplied: false,
};

const glacierBucket: S3Bucket = {
  id: 'cold-archive',
  awsBucketName: 'cold-archive',
  currentTier: 'Glacier',
  recommendedTier: 'Glacier Deep Archive',
  sizeBytes: 107_374_182_400, // 100 GB
  estimatedSavings: 41.40,
  lifecycleApplied: true,
};

describe('GET /api/s3-lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(s3Service.listBucketsWithRecommendations).mockResolvedValue([
      standardBucket,
      glacierBucket,
    ]);
  });

  it('returns 200 with all buckets and their tier recommendations', async () => {
    const res = await request(app).get('/api/s3-lifecycle');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('includes currentTier, recommendedTier, and estimatedSavings for each bucket', async () => {
    const res = await request(app).get('/api/s3-lifecycle');
    const first = res.body.data[0];

    expect(first.currentTier).toBe('Standard');
    expect(first.recommendedTier).toBe('Intelligent Tiering');
    expect(first.estimatedSavings).toBe(3.45);
    expect(first.lifecycleApplied).toBe(false);
  });

  it('returns empty array when no buckets exist', async () => {
    vi.mocked(s3Service.listBucketsWithRecommendations).mockResolvedValue([]);

    const res = await request(app).get('/api/s3-lifecycle');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(s3Service.listBucketsWithRecommendations).mockRejectedValue(
      new Error('S3 access denied'),
    );

    const res = await request(app).get('/api/s3-lifecycle');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/s3-lifecycle/:bucketName/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(s3Service.applyTierChange).mockResolvedValue(undefined);
  });

  it('returns 200 when applying Glacier tier', async () => {
    const res = await request(app)
      .post('/api/s3-lifecycle/my-app-assets/apply')
      .send({ targetTier: 'Glacier' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/my-app-assets/);
    expect(res.body.message).toMatch(/Glacier/);
  });

  it('returns 200 when applying Intelligent Tiering', async () => {
    const res = await request(app)
      .post('/api/s3-lifecycle/my-bucket/apply')
      .send({ targetTier: 'Intelligent Tiering' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 200 when applying Glacier Deep Archive', async () => {
    const res = await request(app)
      .post('/api/s3-lifecycle/archive-bucket/apply')
      .send({ targetTier: 'Glacier Deep Archive' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('calls applyTierChange with the correct bucket name and tier', async () => {
    await request(app)
      .post('/api/s3-lifecycle/my-app-assets/apply')
      .send({ targetTier: 'Glacier' });

    expect(s3Service.applyTierChange).toHaveBeenCalledWith('my-app-assets', 'Glacier');
  });

  it('returns 400 for an invalid targetTier', async () => {
    const res = await request(app)
      .post('/api/s3-lifecycle/my-bucket/apply')
      .send({ targetTier: 'Standard' }); // Standard is not a valid target

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Intelligent Tiering|Glacier/i);
  });

  it('returns 400 when targetTier is missing from body', async () => {
    const res = await request(app)
      .post('/api/s3-lifecycle/my-bucket/apply')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for completely unknown tier value', async () => {
    const res = await request(app)
      .post('/api/s3-lifecycle/my-bucket/apply')
      .send({ targetTier: 'NovaTier9000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when applyTierChange throws', async () => {
    vi.mocked(s3Service.applyTierChange).mockRejectedValue(
      new Error('S3 PutLifecycle denied'),
    );

    const res = await request(app)
      .post('/api/s3-lifecycle/locked-bucket/apply')
      .send({ targetTier: 'Glacier' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/s3-lifecycle/apply-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with applied count and failed list', async () => {
    vi.mocked(s3Service.applyAllTierChanges).mockResolvedValue({
      applied: 3,
      failed: [],
    });

    const res = await request(app).post('/api/s3-lifecycle/apply-all');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.applied).toBe(3);
    expect(res.body.data.failed).toHaveLength(0);
    expect(res.body.message).toMatch(/Applied 3/);
  });

  it('reports partial failures in the response', async () => {
    vi.mocked(s3Service.applyAllTierChanges).mockResolvedValue({
      applied: 2,
      failed: ['locked-bucket', 'versioned-bucket'],
    });

    const res = await request(app).post('/api/s3-lifecycle/apply-all');

    expect(res.status).toBe(200);
    expect(res.body.data.applied).toBe(2);
    expect(res.body.data.failed).toContain('locked-bucket');
    expect(res.body.message).toMatch(/Failed: 2/);
  });

  it('returns 500 when applyAllTierChanges throws', async () => {
    vi.mocked(s3Service.applyAllTierChanges).mockRejectedValue(
      new Error('Unexpected error'),
    );

    const res = await request(app).post('/api/s3-lifecycle/apply-all');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
