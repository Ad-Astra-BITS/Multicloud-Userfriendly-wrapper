import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

vi.mock('../../config/aws', () => ({
  ec2: { send: vi.fn() },
  s3: { send: vi.fn() },
  rds: { send: vi.fn() },
  costExplorer: { send: vi.fn() },
  cloudWatch: { send: vi.fn() },
  sts: { send: vi.fn() },
  createAwsClients: vi.fn().mockReturnValue({
    ec2: { send: vi.fn() },
    s3: { send: vi.fn() },
    rds: { send: vi.fn() },
    costExplorer: { send: vi.fn() },
    cloudWatch: { send: vi.fn() },
    sts: { send: vi.fn() },
  }),
}));

vi.mock('../../config/azure', () => ({
  createAzureClients: vi.fn().mockReturnValue({
    compute: {},
    storage: {},
    sql: {},
    consumption: {},
    subscriptionId: '',
  }),
  defaultAzureClients: {},
  AZURE_REGIONS: [],
}));

vi.mock('../../config/gcp', () => ({
  createGcpClients: vi.fn().mockReturnValue({
    compute: {},
    zoneOperations: {},
    storage: {},
    projectId: '',
  }),
  defaultGcpClients: {},
  GCP_REGIONS: [],
}));

import { awsCredentialsMiddleware } from '../../middleware/awsCredentials';
import { digitalOceanCredentialsMiddleware } from '../../middleware/digitalOceanCredentials';
import { gcpCredentialsMiddleware } from '../../middleware/gcpCredentials';
import { azureCredentialsMiddleware } from '../../middleware/azureCredentials';
import * as awsConfig from '../../config/aws';
import * as azureConfig from '../../config/azure';
import * as gcpConfig from '../../config/gcp';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function makeNext(): NextFunction {
  return vi.fn() as NextFunction;
}

// ── awsCredentialsMiddleware ──────────────────────────────────────────────────

describe('awsCredentialsMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('falls back to singleton clients when no credential headers are present', () => {
    const req = makeReq();
    const next = makeNext();

    awsCredentialsMiddleware(req, makeRes(), next);

    // createAwsClients should NOT have been called
    expect(awsConfig.createAwsClients).not.toHaveBeenCalled();
    // next() must be called to continue the chain
    expect(next).toHaveBeenCalledOnce();
    // req.awsClients should be set to the singletons
    expect(req.awsClients).toBeDefined();
  });

  it('creates per-request clients when credential headers are present', () => {
    const req = makeReq({
      'x-aws-access-key-id': 'AKIAIOSFODNN7EXAMPLE',
      'x-aws-secret-access-key': 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      'x-aws-region': 'eu-west-1',
    });
    const next = makeNext();

    awsCredentialsMiddleware(req, makeRes(), next);

    expect(awsConfig.createAwsClients).toHaveBeenCalledWith({
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'eu-west-1',
    });
    expect(next).toHaveBeenCalledOnce();
    expect(req.awsClients).toBeDefined();
  });

  it('defaults region to us-east-1 when x-aws-region is absent but other headers present', () => {
    const req = makeReq({
      'x-aws-access-key-id': 'AKIAIOSFODNN7EXAMPLE',
      'x-aws-secret-access-key': 'some-secret',
    });

    awsCredentialsMiddleware(req, makeRes(), makeNext());

    expect(awsConfig.createAwsClients).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' }),
    );
  });

  it('always calls next()', () => {
    const next = makeNext();
    awsCredentialsMiddleware(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── digitalOceanCredentialsMiddleware ─────────────────────────────────────────

describe('digitalOceanCredentialsMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads API token from x-do-api-token header', () => {
    const req = makeReq({ 'x-do-api-token': 'dop_v1_token_abc123' });
    const next = makeNext();

    digitalOceanCredentialsMiddleware(req, makeRes(), next);

    expect(req.doCredentials.apiToken).toBe('dop_v1_token_abc123');
    expect(next).toHaveBeenCalledOnce();
  });

  it('trims whitespace from the token header', () => {
    const req = makeReq({ 'x-do-api-token': '  trimmed-token  ' });

    digitalOceanCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.doCredentials.apiToken).toBe('trimmed-token');
  });

  it('sets empty apiToken when no header is present (falls back to env var or empty string)', () => {
    const req = makeReq({});

    digitalOceanCredentialsMiddleware(req, makeRes(), makeNext());

    expect(typeof req.doCredentials.apiToken).toBe('string');
  });

  it('reads optional Spaces credentials from headers', () => {
    const req = makeReq({
      'x-do-api-token': 'token',
      'x-do-spaces-key': 'spaces-key',
      'x-do-spaces-secret': 'spaces-secret',
      'x-do-spaces-region': 'nyc3',
      'x-do-spaces-bucket': 'my-bucket',
    });

    digitalOceanCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.doCredentials.spacesKey).toBe('spaces-key');
    expect(req.doCredentials.spacesSecret).toBe('spaces-secret');
    expect(req.doCredentials.spacesRegion).toBe('nyc3');
    expect(req.doCredentials.spacesBucket).toBe('my-bucket');
  });

  it('leaves Spaces credentials undefined when not provided', () => {
    const req = makeReq({ 'x-do-api-token': 'token' });

    digitalOceanCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.doCredentials.spacesKey).toBeUndefined();
    expect(req.doCredentials.spacesSecret).toBeUndefined();
    expect(req.doCredentials.spacesBucket).toBeUndefined();
  });

  it('always calls next()', () => {
    const next = makeNext();
    digitalOceanCredentialsMiddleware(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── gcpCredentialsMiddleware ──────────────────────────────────────────────────

describe('gcpCredentialsMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads projectId from x-gcp-project-id header', () => {
    const req = makeReq({ 'x-gcp-project-id': 'my-project-123' });

    gcpCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.gcpCredentials.projectId).toBe('my-project-123');
  });

  it('decodes base64-encoded service account JSON from x-gcp-credentials', () => {
    const serviceAccount = {
      client_email: 'sa@my-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----\n',
    };
    const encoded = Buffer.from(JSON.stringify(serviceAccount)).toString('base64');

    const req = makeReq({
      'x-gcp-project-id': 'my-project',
      'x-gcp-credentials': encoded,
    });

    gcpCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.gcpCredentials.clientEmail).toBe(serviceAccount.client_email);
    expect(req.gcpCredentials.privateKey).toBe(serviceAccount.private_key);
  });

  it('handles invalid base64 in x-gcp-credentials gracefully (no throw)', () => {
    const req = makeReq({
      'x-gcp-project-id': 'my-project',
      'x-gcp-credentials': '!!!not-valid-base64!!!',
    });

    // Should not throw — just falls through to env vars
    expect(() => gcpCredentialsMiddleware(req, makeRes(), makeNext())).not.toThrow();
    expect(req.gcpCredentials.projectId).toBe('my-project');
  });

  it('handles valid base64 but invalid JSON gracefully', () => {
    const invalidJson = Buffer.from('{ not valid json }').toString('base64');
    const req = makeReq({
      'x-gcp-project-id': 'my-project',
      'x-gcp-credentials': invalidJson,
    });

    expect(() => gcpCredentialsMiddleware(req, makeRes(), makeNext())).not.toThrow();
  });

  it('calls createGcpClients with resolved credentials', () => {
    const req = makeReq({ 'x-gcp-project-id': 'test-project' });

    gcpCredentialsMiddleware(req, makeRes(), makeNext());

    expect(gcpConfig.createGcpClients).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('always calls next()', () => {
    const next = makeNext();
    gcpCredentialsMiddleware(makeReq({ 'x-gcp-project-id': 'proj' }), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── azureCredentialsMiddleware ────────────────────────────────────────────────

describe('azureCredentialsMiddleware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads all four Azure credential headers', () => {
    const req = makeReq({
      'x-azure-subscription-id': 'sub-id',
      'x-azure-tenant-id': 'tenant-id',
      'x-azure-client-id': 'client-id',
      'x-azure-client-secret': 'client-secret',
    });

    azureCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.azureCredentials.subscriptionId).toBe('sub-id');
    expect(req.azureCredentials.tenantId).toBe('tenant-id');
    expect(req.azureCredentials.clientId).toBe('client-id');
    expect(req.azureCredentials.clientSecret).toBe('client-secret');
  });

  it('trims whitespace from header values', () => {
    const req = makeReq({
      'x-azure-subscription-id': '  sub-id  ',
      'x-azure-tenant-id': '  tenant  ',
      'x-azure-client-id': '  client  ',
      'x-azure-client-secret': '  secret  ',
    });

    azureCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.azureCredentials.subscriptionId).toBe('sub-id');
    expect(req.azureCredentials.tenantId).toBe('tenant');
  });

  it('calls createAzureClients with the extracted credentials', () => {
    const req = makeReq({
      'x-azure-subscription-id': 'sub',
      'x-azure-tenant-id': 'ten',
      'x-azure-client-id': 'cli',
      'x-azure-client-secret': 'sec',
    });

    azureCredentialsMiddleware(req, makeRes(), makeNext());

    expect(azureConfig.createAzureClients).toHaveBeenCalledWith({
      subscriptionId: 'sub',
      tenantId: 'ten',
      clientId: 'cli',
      clientSecret: 'sec',
    });
  });

  it('attaches azureCredentials and azureClients to req', () => {
    const req = makeReq({
      'x-azure-subscription-id': 'sub',
      'x-azure-tenant-id': 'ten',
      'x-azure-client-id': 'cli',
      'x-azure-client-secret': 'sec',
    });

    azureCredentialsMiddleware(req, makeRes(), makeNext());

    expect(req.azureCredentials).toBeDefined();
    expect(req.azureClients).toBeDefined();
  });

  it('always calls next()', () => {
    const next = makeNext();
    azureCredentialsMiddleware(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
