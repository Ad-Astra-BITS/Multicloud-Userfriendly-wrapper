import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import {
  doDroplet,
  doSpace,
  doDatabase,
  doBilling,
} from '../helpers/fixtures';

// Error class lives inside the factory so it is available when the factory is
// hoisted. The controller imports DigitalOceanApiError from the same module, so
// instanceof checks work correctly against the same class reference.
vi.mock('../../services/digitalOceanResourceService', () => {
  class DigitalOceanApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(`DigitalOcean API Error (${status}): ${message}`);
      this.name = 'DigitalOceanApiError';
      this.status = status;
    }
  }
  return {
    createDigitalOceanService: vi.fn(),
    DigitalOceanApiError,
  };
});

// Mock createDoApiClient used by the validate endpoint
vi.mock('../../config/digitalocean', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/digitalocean')>();
  return { ...actual, createDoApiClient: vi.fn() };
});

import * as doService from '../../services/digitalOceanResourceService';
import * as doConfig from '../../config/digitalocean';

const { DigitalOceanApiError } = doService as any;
const DO_HEADERS = { 'x-do-api-token': 'dop_v1_test_token_abc123' };

function makeMockService(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    getDroplets: vi.fn().mockResolvedValue([doDroplet]),
    getDropletMetrics: vi.fn().mockResolvedValue({
      dropletId: 123456,
      cpuPercent: 12.5,
      memoryPercent: 45.2,
      timestamp: new Date().toISOString(),
    }),
    terminateDroplets: vi.fn().mockResolvedValue(undefined),
    getSpaces: vi.fn().mockResolvedValue([doSpace]),
    optimizeSpace: vi.fn().mockResolvedValue(undefined),
    deleteSpace: vi.fn().mockResolvedValue(undefined),
    getDatabases: vi.fn().mockResolvedValue([doDatabase]),
    stopDatabase: vi.fn().mockResolvedValue({
      action: 'manual_required',
      message: 'Dry run',
      dbId: 'db-uuid-1234',
    }),
    getBillingHistory: vi.fn().mockResolvedValue(doBilling),
    ...overrides,
  };
}

describe('POST /api/do/validate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 when x-do-api-token header is missing', async () => {
    const res = await request(app).post('/api/do/validate');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/x-do-api-token/i);
  });

  it('returns 200 with account info when token is valid', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        account: {
          email: 'user@example.com',
          uuid: 'uuid-1234-5678',
          status: 'active',
          droplet_limit: 25,
          floating_ip_limit: 5,
          email_verified: true,
        },
      },
    });
    vi.mocked(doConfig.createDoApiClient).mockReturnValue({ get: mockGet } as any);

    const res = await request(app).post('/api/do/validate').set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('user@example.com');
    expect(res.body.data.uuid).toBe('uuid-1234-5678');
    expect(res.body.data.dropletLimit).toBe(25);
    expect(res.body.message).toMatch(/user@example.com/);
  });

  it('returns 500 when createDoApiClient.get throws an unexpected error', async () => {
    const mockGet = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.mocked(doConfig.createDoApiClient).mockReturnValue({ get: mockGet } as any);

    const res = await request(app).post('/api/do/validate').set(DO_HEADERS);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/do/droplets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with a list of droplets', async () => {
    const res = await request(app).get('/api/do/droplets').set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].id).toBe(doDroplet.id);
    expect(res.body.data[0].name).toBe('web-droplet-1');
  });

  it('returns 500 when service throws an unexpected error', async () => {
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(
      makeMockService({ getDroplets: vi.fn().mockRejectedValue(new Error('network fail')) }) as any,
    );

    const res = await request(app).get('/api/do/droplets').set(DO_HEADERS);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('returns proper error status for DigitalOceanApiError', async () => {
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(
      makeMockService({
        getDroplets: vi.fn().mockRejectedValue(new DigitalOceanApiError(403, 'Forbidden')),
      }) as any,
    );

    const res = await request(app).get('/api/do/droplets').set(DO_HEADERS);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/do/droplets/:id/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 400 for a non-numeric droplet ID', async () => {
    const res = await request(app)
      .get('/api/do/droplets/not-a-number/metrics')
      .set(DO_HEADERS);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/numeric/i);
  });

  it('returns 200 with CPU and memory metrics for a valid numeric ID', async () => {
    const res = await request(app)
      .get('/api/do/droplets/123456/metrics')
      .set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('cpuPercent');
    expect(res.body.data).toHaveProperty('memoryPercent');
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('calls getDropletMetrics with the parsed integer ID', async () => {
    const mockService = makeMockService();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(mockService as any);

    await request(app).get('/api/do/droplets/123456/metrics').set(DO_HEADERS);

    expect(mockService.getDropletMetrics).toHaveBeenCalledWith(123456);
  });

  it('returns 404 when droplet is not found', async () => {
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(
      makeMockService({
        getDropletMetrics: vi.fn().mockRejectedValue(new DigitalOceanApiError(404, 'Droplet not found')),
      }) as any,
    );

    const res = await request(app).get('/api/do/droplets/9999/metrics').set(DO_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/do/droplets/terminate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 400 when dropletIds is missing', async () => {
    const res = await request(app).post('/api/do/droplets/terminate').set(DO_HEADERS).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('returns 400 when dropletIds is an empty array', async () => {
    const res = await request(app)
      .post('/api/do/droplets/terminate')
      .set(DO_HEADERS)
      .send({ dropletIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when dropletIds contains non-integer values (strings)', async () => {
    const res = await request(app)
      .post('/api/do/droplets/terminate')
      .set(DO_HEADERS)
      .send({ dropletIds: ['123', '456'] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/integers/i);
  });

  it('returns 400 when dropletIds contains floats', async () => {
    const res = await request(app)
      .post('/api/do/droplets/terminate')
      .set(DO_HEADERS)
      .send({ dropletIds: [1.5, 2.7] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when valid integer droplet IDs are provided', async () => {
    const res = await request(app)
      .post('/api/do/droplets/terminate')
      .set(DO_HEADERS)
      .send({ dropletIds: [123456, 789012] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/2 Droplet/);
  });
});

describe('GET /api/do/spaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with list of Spaces', async () => {
    const res = await request(app).get('/api/do/spaces').set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('my-space-bucket');
  });
});

describe('POST /api/do/spaces/:region/:name/optimize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with lifecycle expiry confirmation', async () => {
    const res = await request(app)
      .post('/api/do/spaces/nyc3/my-space-bucket/optimize')
      .set(DO_HEADERS)
      .send({ expiryDays: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/my-space-bucket/);
    expect(res.body.message).toMatch(/30 days/);
  });

  it('uses default 90 days when expiryDays is not provided', async () => {
    const res = await request(app)
      .post('/api/do/spaces/nyc3/my-bucket/optimize')
      .set(DO_HEADERS)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/90 days/);
  });

  it('returns 400 when expiryDays is not a positive integer', async () => {
    const res = await request(app)
      .post('/api/do/spaces/nyc3/my-bucket/optimize')
      .set(DO_HEADERS)
      .send({ expiryDays: -5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/positive integer/i);
  });

  it('returns 400 when expiryDays is a string', async () => {
    const res = await request(app)
      .post('/api/do/spaces/nyc3/my-bucket/optimize')
      .set(DO_HEADERS)
      .send({ expiryDays: '30' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('DELETE /api/do/spaces/:region/:name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with deletion confirmation', async () => {
    const res = await request(app)
      .delete('/api/do/spaces/nyc3/my-space-bucket')
      .set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/my-space-bucket/);
    expect(res.body.message).toMatch(/nyc3/);
  });
});

describe('GET /api/do/databases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with list of managed databases', async () => {
    const res = await request(app).get('/api/do/databases').set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].name).toBe('prod-postgres');
    expect(res.body.data[0].engine).toBe('pg');
  });
});

describe('POST /api/do/databases/:id/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with dry-run result when confirmDestroy is not true', async () => {
    const res = await request(app)
      .post('/api/do/databases/db-uuid-1234/stop')
      .set(DO_HEADERS)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('manual_required');
  });

  it('passes confirmDestroy=true when explicitly set', async () => {
    const mockService = makeMockService({
      stopDatabase: vi.fn().mockResolvedValue({
        action: 'snapshot_and_destroy',
        message: 'Database destroyed',
        dbId: 'db-uuid-1234',
      }),
    });
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(mockService as any);

    const res = await request(app)
      .post('/api/do/databases/db-uuid-1234/stop')
      .set(DO_HEADERS)
      .send({ confirmDestroy: true });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('snapshot_and_destroy');
    expect(mockService.stopDatabase).toHaveBeenCalledWith('db-uuid-1234', true);
  });

  it('does not treat string "true" as confirmDestroy=true', async () => {
    const mockService = makeMockService();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(mockService as any);

    await request(app)
      .post('/api/do/databases/db-uuid-1234/stop')
      .set(DO_HEADERS)
      .send({ confirmDestroy: 'true' });

    expect(mockService.stopDatabase).toHaveBeenCalledWith('db-uuid-1234', false);
  });
});

describe('GET /api/do/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doService.createDigitalOceanService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with billing history including invoices', async () => {
    const res = await request(app).get('/api/do/billing').set(DO_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.monthToDate).toBe(45.60);
    expect(Array.isArray(res.body.data.invoices)).toBe(true);
    expect(res.body.data.invoices[0].invoiceUuid).toBe('inv-001');
  });
});
