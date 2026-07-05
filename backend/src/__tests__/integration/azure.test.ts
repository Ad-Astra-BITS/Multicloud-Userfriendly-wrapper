import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { azureVM, azureStorage, azureSql, azureBilling } from '../helpers/fixtures';

// hoisted so it's available inside vi.mock factories (which are hoisted before imports)
const mockGetToken = vi.hoisted(() => vi.fn().mockResolvedValue({ token: 'mock-bearer-token' }));

// Error class inside factory to avoid TDZ issues
vi.mock('../../services/azureResourceService', () => {
  class AzureApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(`Azure API Error (${status}): ${message}`);
      this.name = 'AzureApiError';
      this.status = status;
    }
  }
  return { createAzureService: vi.fn(), AzureApiError };
});

// Prevent azureCredentialsMiddleware from constructing real Azure ARM SDK clients
vi.mock('../../config/azure', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/azure')>();
  const fakeClients = { compute: {}, storage: {}, sql: {}, consumption: {}, subscriptionId: '' };
  return {
    ...actual,
    createAzureClients: vi.fn().mockReturnValue(fakeClients),
    defaultAzureClients: fakeClients,
  };
});

// Use class syntax so `new ClientSecretCredential(...)` in the validate controller works
vi.mock('@azure/identity', () => ({
  ClientSecretCredential: class MockClientSecretCredential {
    getToken = mockGetToken;
  },
  DefaultAzureCredential: class MockDefaultAzureCredential {
    getToken = vi.fn().mockResolvedValue({ token: 'env-token' });
  },
}));

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...(actual as any).default,
      get: vi.fn(),
      create: vi.fn().mockReturnValue({ get: vi.fn(), post: vi.fn() }),
    },
    isAxiosError: vi.fn().mockReturnValue(false),
  };
});

import * as azureService from '../../services/azureResourceService';
import axios from 'axios';

const { AzureApiError } = azureService as any;

const AZURE_HEADERS = {
  'x-azure-subscription-id': 'sub-12345678-abcd-1234-abcd-123456789012',
  'x-azure-tenant-id': 'tenant-12345678',
  'x-azure-client-id': 'client-12345678',
  'x-azure-client-secret': 'super-secret-value',
};

function makeMockService(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  return {
    getVirtualMachines: vi.fn().mockResolvedValue([azureVM]),
    deallocateVM: vi.fn().mockResolvedValue(undefined),
    startVM: vi.fn().mockResolvedValue(undefined),
    deleteVMs: vi.fn().mockResolvedValue(undefined),
    getStorageAccounts: vi.fn().mockResolvedValue([azureStorage]),
    deleteStorageAccount: vi.fn().mockResolvedValue(undefined),
    getSqlDatabases: vi.fn().mockResolvedValue([azureSql]),
    getBillingInfo: vi.fn().mockResolvedValue(azureBilling),
    ...overrides,
  };
}

describe('POST /api/azure/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue({ token: 'mock-bearer-token' });
  });

  it('returns 400 when x-azure-subscription-id is missing', async () => {
    const res = await request(app)
      .post('/api/azure/validate')
      .set('x-azure-tenant-id', 'tenant-id')
      .set('x-azure-client-id', 'client-id')
      .set('x-azure-client-secret', 'secret');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/x-azure-subscription-id/i);
  });

  it('returns 400 when tenant/client/secret headers are missing', async () => {
    const res = await request(app)
      .post('/api/azure/validate')
      .set('x-azure-subscription-id', 'sub-id');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/tenant|client/i);
  });

  it('returns 200 with subscription info on valid credentials', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: { displayName: 'My Test Subscription' },
    });

    const res = await request(app).post('/api/azure/validate').set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscriptionId).toBe(AZURE_HEADERS['x-azure-subscription-id']);
    expect(res.body.data.displayName).toBe('My Test Subscription');
    expect(res.body.message).toMatch(/successfully connected/i);
  });

  it('returns 401 when ClientSecretCredential.getToken throws an auth error', async () => {
    const authErr = new Error('AADSTS700016: Application not found in tenant') as any;
    authErr.name = 'AuthenticationError';
    mockGetToken.mockRejectedValueOnce(authErr);

    const res = await request(app).post('/api/azure/validate').set(AZURE_HEADERS);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/authentication failed/i);
  });

  it('returns 404 when subscription ID is not found', async () => {
    const notFound = Object.assign(new Error('Not found'), {
      response: { status: 404, data: { error: { code: 'SubscriptionNotFound' } } },
    });
    vi.mocked(axios.get).mockRejectedValueOnce(notFound);

    const res = await request(app).post('/api/azure/validate').set(AZURE_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/subscription not found/i);
  });
});

describe('GET /api/azure/vms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with a list of VMs', async () => {
    const res = await request(app).get('/api/azure/vms').set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].name).toBe('my-vm');
    expect(res.body.data[0].status).toBe('Running');
    expect(res.body.data[0].location).toBe('eastus');
  });

  it('returns 403 when AzureApiError with status 403 is thrown', async () => {
    vi.mocked(azureService.createAzureService).mockReturnValue(
      makeMockService({
        getVirtualMachines: vi.fn().mockRejectedValue(new AzureApiError(403, 'AuthorizationFailed')),
      }) as any,
    );

    const res = await request(app).get('/api/azure/vms').set(AZURE_HEADERS);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(azureService.createAzureService).mockReturnValue(
      makeMockService({
        getVirtualMachines: vi.fn().mockRejectedValue(new Error('Network error')),
      }) as any,
    );

    const res = await request(app).get('/api/azure/vms').set(AZURE_HEADERS);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/azure/vms/:resourceGroup/:name/deallocate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with confirmation message', async () => {
    const res = await request(app)
      .post('/api/azure/vms/my-rg/my-vm/deallocate')
      .set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/my-vm/);
    expect(res.body.message).toMatch(/my-rg/);
    expect(res.body.message).toMatch(/deallocated/i);
  });

  it('calls deallocateVM with correct params', async () => {
    const mockService = makeMockService();
    vi.mocked(azureService.createAzureService).mockReturnValue(mockService as any);

    await request(app).post('/api/azure/vms/prod-rg/api-server/deallocate').set(AZURE_HEADERS);

    expect(mockService.deallocateVM).toHaveBeenCalledWith('prod-rg', 'api-server');
  });
});

describe('POST /api/azure/vms/:resourceGroup/:name/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with start confirmation', async () => {
    const res = await request(app)
      .post('/api/azure/vms/my-rg/my-vm/start')
      .set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/started/i);
  });

  it('calls startVM with correct resource group and name', async () => {
    const mockService = makeMockService();
    vi.mocked(azureService.createAzureService).mockReturnValue(mockService as any);

    await request(app).post('/api/azure/vms/staging-rg/worker-vm/start').set(AZURE_HEADERS);

    expect(mockService.startVM).toHaveBeenCalledWith('staging-rg', 'worker-vm');
  });
});

describe('POST /api/azure/vms/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 400 when vms is not an array', async () => {
    const res = await request(app)
      .post('/api/azure/vms/delete')
      .set(AZURE_HEADERS)
      .send({ vms: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/non-empty array/i);
  });

  it('returns 400 when vms is an empty array', async () => {
    const res = await request(app)
      .post('/api/azure/vms/delete')
      .set(AZURE_HEADERS)
      .send({ vms: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when a VM entry is missing resourceGroup', async () => {
    const res = await request(app)
      .post('/api/azure/vms/delete')
      .set(AZURE_HEADERS)
      .send({ vms: [{ name: 'my-vm' }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/resourceGroup/i);
  });

  it('returns 400 when a VM entry is missing name', async () => {
    const res = await request(app)
      .post('/api/azure/vms/delete')
      .set(AZURE_HEADERS)
      .send({ vms: [{ resourceGroup: 'my-rg' }] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when valid VMs are provided', async () => {
    const res = await request(app)
      .post('/api/azure/vms/delete')
      .set(AZURE_HEADERS)
      .send({ vms: [{ resourceGroup: 'my-rg', name: 'my-vm' }, { resourceGroup: 'my-rg', name: 'my-vm-2' }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/2 VM/);
  });
});

describe('GET /api/azure/storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with list of storage accounts', async () => {
    const res = await request(app).get('/api/azure/storage').set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].name).toBe('mystorage');
    expect(res.body.data[0].kind).toBe('StorageV2');
  });
});

describe('DELETE /api/azure/storage/:resourceGroup/:name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with deletion confirmation', async () => {
    const res = await request(app)
      .delete('/api/azure/storage/my-rg/mystorage')
      .set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/mystorage/);
  });

  it('calls deleteStorageAccount with correct params', async () => {
    const mockService = makeMockService();
    vi.mocked(azureService.createAzureService).mockReturnValue(mockService as any);

    await request(app).delete('/api/azure/storage/prod-rg/prod-storage').set(AZURE_HEADERS);

    expect(mockService.deleteStorageAccount).toHaveBeenCalledWith('prod-rg', 'prod-storage');
  });
});

describe('GET /api/azure/sql', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with list of SQL databases', async () => {
    const res = await request(app).get('/api/azure/sql').set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].name).toBe('my-db');
    expect(res.body.data[0].serverName).toBe('my-server');
    expect(res.body.data[0].status).toBe('Online');
  });
});

describe('GET /api/azure/billing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(azureService.createAzureService).mockReturnValue(makeMockService() as any);
  });

  it('returns 200 with billing info', async () => {
    const res = await request(app).get('/api/azure/billing').set(AZURE_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.monthToDate).toBe(85.20);
    expect(Array.isArray(res.body.data.monthlyCosts)).toBe(true);
    expect(res.body.data.monthlyCosts).toHaveLength(2);
  });
});
