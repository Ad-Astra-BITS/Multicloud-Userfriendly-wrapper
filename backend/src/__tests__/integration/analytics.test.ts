import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { dashboardSummary, costTrend, costBreakdown } from '../helpers/fixtures';

vi.mock('../../services/analyticsService', () => ({
  getDashboardSummary: vi.fn(),
  getCostTrend: vi.fn(),
  getCostBreakdown: vi.fn(),
  getCostDistribution: vi.fn(),
}));

import * as analyticsService from '../../services/analyticsService';

describe('GET /api/analytics/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsService.getDashboardSummary).mockResolvedValue(dashboardSummary);
  });

  it('returns 200 with dashboard summary data', async () => {
    const res = await request(app).get('/api/analytics/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalMonthlyCost).toBe(250.50);
    expect(res.body.data.costChange).toBe(5.2);
    expect(res.body.data.activeResources.ec2).toBe(3);
    expect(res.body.data.activeResources.s3).toBe(5);
    expect(res.body.data.activeResources.rds).toBe(2);
    expect(res.body.data.potentialSavings).toBe(75.00);
    expect(res.body.data.alertCount).toBe(2);
  });

  it('passes AWS client credentials from headers to the service', async () => {
    vi.mocked(analyticsService.getDashboardSummary).mockResolvedValue(dashboardSummary);

    const res = await request(app)
      .get('/api/analytics/summary')
      .set('x-aws-access-key-id', 'AKIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'secret')
      .set('x-aws-region', 'eu-west-1');

    expect(res.status).toBe(200);
    // service should have been called once with the per-request clients
    expect(analyticsService.getDashboardSummary).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when summary service throws', async () => {
    vi.mocked(analyticsService.getDashboardSummary).mockRejectedValue(
      new Error('Cost Explorer API unavailable'),
    );

    const res = await request(app).get('/api/analytics/summary');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/analytics/trend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsService.getCostTrend).mockResolvedValue(costTrend);
  });

  it('returns 200 with monthly cost trend', async () => {
    const res = await request(app).get('/api/analytics/trend');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('month');
    expect(res.body.data[0]).toHaveProperty('cost');
  });

  it('passes the months query param to the service (default 6)', async () => {
    await request(app).get('/api/analytics/trend');
    expect(analyticsService.getCostTrend).toHaveBeenCalledWith(6, expect.anything());
  });

  it('passes a custom months query param', async () => {
    await request(app).get('/api/analytics/trend?months=3');
    expect(analyticsService.getCostTrend).toHaveBeenCalledWith(3, expect.anything());
  });

  it('caps months at 12 even if a larger value is provided', async () => {
    await request(app).get('/api/analytics/trend?months=24');
    expect(analyticsService.getCostTrend).toHaveBeenCalledWith(12, expect.anything());
  });

  it('returns 500 when trend service throws', async () => {
    vi.mocked(analyticsService.getCostTrend).mockRejectedValue(new Error('fail'));

    const res = await request(app).get('/api/analytics/trend');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/analytics/breakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsService.getCostBreakdown).mockResolvedValue(costBreakdown);
  });

  it('returns 200 with per-service cost breakdown', async () => {
    const res = await request(app).get('/api/analytics/breakdown');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty('month');
    expect(res.body.data[0]).toHaveProperty('service');
    expect(res.body.data[0]).toHaveProperty('cost');
  });

  it('defaults to 6 months when no query param provided', async () => {
    await request(app).get('/api/analytics/breakdown');
    expect(analyticsService.getCostBreakdown).toHaveBeenCalledWith(6, expect.anything());
  });

  it('passes custom months param', async () => {
    await request(app).get('/api/analytics/breakdown?months=12');
    expect(analyticsService.getCostBreakdown).toHaveBeenCalledWith(12, expect.anything());
  });

  it('caps breakdown months at 12', async () => {
    await request(app).get('/api/analytics/breakdown?months=99');
    expect(analyticsService.getCostBreakdown).toHaveBeenCalledWith(12, expect.anything());
  });
});

describe('GET /api/analytics/distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsService.getCostDistribution).mockResolvedValue(costBreakdown);
  });

  it('returns 200 with distribution data', async () => {
    const res = await request(app).get('/api/analytics/distribution');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('passes the month query param when provided', async () => {
    await request(app).get('/api/analytics/distribution?month=2024-03');
    expect(analyticsService.getCostDistribution).toHaveBeenCalledWith(
      '2024-03',
      expect.anything(),
    );
  });

  it('passes undefined month when no query param', async () => {
    await request(app).get('/api/analytics/distribution');
    expect(analyticsService.getCostDistribution).toHaveBeenCalledWith(
      undefined,
      expect.anything(),
    );
  });

  it('returns 500 when distribution service throws', async () => {
    vi.mocked(analyticsService.getCostDistribution).mockRejectedValue(new Error('fail'));

    const res = await request(app).get('/api/analytics/distribution');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
