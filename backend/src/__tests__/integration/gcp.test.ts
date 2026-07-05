import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { gcpInstance, gcpBucket, gcpSqlInstance, gcpBilling } from '../helpers/fixtures';

// Error class inside factory to avoid TDZ issues
vi.mock('../../services/gcpResourceService', () => {
  class GcpApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(`GCP API Error (${status}): ${message}`);
      this.name = 'GcpApiError';
      this.status = status;
    }
  }
  return { createGoogleCloudService: vi.fn(), GcpApiError };
});

// Prevent gcpCredentialsMiddleware from constructing real GCP SDK clients
vi.mock('../../config/gcp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/gcp')>();
  const fakeClients = { compute: {}, zoneOperations: {}, storage: {}, projectId: '' };
  return {
    ...actual,
    createGcpClients: vi.fn().mockReturnValue(fakeClients),
    defaultGcpClients: fakeClients,
  };
});

import * as gcpService from '../../services/gcpResourceService';

const { GcpApiError } = gcpService as any;

const GCP_HEADERS = {
  'x-gcp-project-id': 'my-gcp-project-id',
};

function makeMockService(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    getInstances: vi.fn().mockResolvedValue([gcpInstance]),
    stopInstance: vi.fn().mockResolvedValue(undefined),
    startInstance: vi.fn().mockResolvedValue(undefined),
    deleteInstances: vi.fn().mockResolvedValue(undefined),
    getBuckets: vi.fn().mockResolvedValue([gcpBucket]),
    deleteBucket: vi.fn().mockResolvedValue(undefined),
    getSqlInstances: vi.fn().mockResolvedValue([gcpSqlInstance]),
    getBillingEstimate: vi.fn().mockResolvedValue(gcpBilling),
    ...overrides,
  };
}

describe('POST /api/gcp/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 400 when x-gcp-project-id header is missing', async () => {
    const res = await request(app).post('/api/gcp/validate');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/x-gcp-project-id/i);
  });

  it('returns 200 with project info when credentials are valid', async () => {
    const res = await request(app).post('/api/gcp/validate').set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.projectId).toBe('my-gcp-project-id');
    expect(res.body.message).toMatch(/my-gcp-project-id/);
  });

  it('returns error status when GcpApiError is thrown', async () => {
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(
      makeMockService({
        getInstances: vi.fn().mockRejectedValue(new GcpApiError(403, 'Permission denied')),
      }) as any,
    );

    const res = await request(app).post('/api/gcp/validate').set(GCP_HEADERS);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('accepts base64-encoded GCP credentials header', async () => {
    const serviceAccount = JSON.stringify({
      client_email: 'sa@my-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----\n',
    });
    const encoded = Buffer.from(serviceAccount).toString('base64');

    const res = await request(app)
      .post('/api/gcp/validate')
      .set(GCP_HEADERS)
      .set('x-gcp-credentials', encoded);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/gcp/instances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with a list of compute instances', async () => {
    const res = await request(app).get('/api/gcp/instances').set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('instance-1');
    expect(res.body.data[0].status).toBe('RUNNING');
    expect(res.body.data[0].zone).toBe('us-central1-a');
  });

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(
      makeMockService({
        getInstances: vi.fn().mockRejectedValue(new Error('Internal GCP error')),
      }) as any,
    );

    const res = await request(app).get('/api/gcp/instances').set(GCP_HEADERS);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('returns correct GcpApiError status code', async () => {
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(
      makeMockService({
        getInstances: vi.fn().mockRejectedValue(new GcpApiError(404, 'Project not found')),
      }) as any,
    );

    const res = await request(app).get('/api/gcp/instances').set(GCP_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/gcp/instances/:zone/:name/stop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with stop confirmation', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/us-central1-a/instance-1/stop')
      .set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/instance-1/);
    expect(res.body.message).toMatch(/us-central1-a/);
    expect(res.body.message).toMatch(/stopped/i);
  });

  it('calls stopInstance with zone and name params', async () => {
    const mockService = makeMockService();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(mockService as any);

    await request(app)
      .post('/api/gcp/instances/europe-west1-b/my-instance/stop')
      .set(GCP_HEADERS);

    expect(mockService.stopInstance).toHaveBeenCalledWith('europe-west1-b', 'my-instance');
  });
});

describe('POST /api/gcp/instances/:zone/:name/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with start confirmation', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/us-central1-a/instance-1/start')
      .set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/started/i);
  });

  it('calls startInstance with correct params', async () => {
    const mockService = makeMockService();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(mockService as any);

    await request(app)
      .post('/api/gcp/instances/asia-east1-a/prod-vm/start')
      .set(GCP_HEADERS);

    expect(mockService.startInstance).toHaveBeenCalledWith('asia-east1-a', 'prod-vm');
  });
});

describe('POST /api/gcp/instances/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 400 when instances is not an array', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/delete')
      .set(GCP_HEADERS)
      .send({ instances: 'not-array' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('returns 400 when instances is an empty array', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/delete')
      .set(GCP_HEADERS)
      .send({ instances: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when an instance entry is missing zone', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/delete')
      .set(GCP_HEADERS)
      .send({ instances: [{ name: 'instance-1' }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/zone/i);
  });

  it('returns 400 when an instance entry is missing name', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/delete')
      .set(GCP_HEADERS)
      .send({ instances: [{ zone: 'us-central1-a' }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when valid instance array is provided', async () => {
    const res = await request(app)
      .post('/api/gcp/instances/delete')
      .set(GCP_HEADERS)
      .send({
        instances: [
          { zone: 'us-central1-a', name: 'instance-1' },
          { zone: 'us-central1-b', name: 'instance-2' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/2 instance/i);
  });
});

describe('GET /api/gcp/buckets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with list of Cloud Storage buckets', async () => {
    const res = await request(app).get('/api/gcp/buckets').set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('my-gcp-bucket');
    expect(res.body.data[0].location).toBe('US');
    expect(res.body.data[0].storageClass).toBe('STANDARD');
  });
});

describe('DELETE /api/gcp/buckets/:name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with deletion confirmation', async () => {
    const res = await request(app)
      .delete('/api/gcp/buckets/my-gcp-bucket')
      .set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/my-gcp-bucket/);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('calls deleteBucket with the correct bucket name', async () => {
    const mockService = makeMockService();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(mockService as any);

    await request(app).delete('/api/gcp/buckets/archive-bucket-2024').set(GCP_HEADERS);

    expect(mockService.deleteBucket).toHaveBeenCalledWith('archive-bucket-2024');
  });

  it('returns 404 for GcpApiError(404)', async () => {
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(
      makeMockService({
        deleteBucket: vi.fn().mockRejectedValue(new GcpApiError(404, 'Bucket not found')),
      }) as any,
    );

    const res = await request(app)
      .delete('/api/gcp/buckets/nonexistent-bucket')
      .set(GCP_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/gcp/sql', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with list of Cloud SQL instances', async () => {
    const res = await request(app).get('/api/gcp/sql').set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].name).toBe('my-sql');
    expect(res.body.data[0].databaseVersion).toBe('POSTGRES_15');
    expect(res.body.data[0].state).toBe('RUNNABLE');
  });
});

describe('GET /api/gcp/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(gcpService.createGoogleCloudService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with billing estimate', async () => {
    const res = await request(app).get('/api/gcp/billing').set(GCP_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.monthToDate).toBe(32.50);
    expect(Array.isArray(res.body.data.monthlyCosts)).toBe(true);
    expect(res.body.data.monthlyCosts).toHaveLength(2);
  });
});
