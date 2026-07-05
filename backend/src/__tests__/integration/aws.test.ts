import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';

// Shared send mock accessible from test bodies via vi.hoisted
const mockSend = vi.hoisted(() => vi.fn());

// Mock the STS client used inside awsConnectController.
// Use class syntax so `new STSClient(...)` works correctly.
vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: class MockSTSClient {
    send = mockSend;
  },
  GetCallerIdentityCommand: class MockGetCallerIdentityCommand {},
}));

describe('POST /api/aws/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when x-aws-access-key-id header is missing', async () => {
    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-secret-access-key', 'some-secret');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/missing required headers/i);
  });

  it('returns 400 when x-aws-secret-access-key header is missing', async () => {
    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIAIOSFODNN7EXAMPLE');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/missing required headers/i);
  });

  it('returns 400 when access key does not start with AKIA or ASIA', async () => {
    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'BADKEYFORMAT12345678')
      .set('x-aws-secret-access-key', 'some-secret');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/AKIA or ASIA/i);
  });

  it('returns 200 with account info when credentials are valid (AKIA key)', async () => {
    mockSend.mockResolvedValueOnce({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/test-user',
      UserId: 'AIDASAMPLEUSERID',
    });

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
      .set('x-aws-region', 'us-east-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountId).toBe('123456789012');
    expect(res.body.data.arn).toBe('arn:aws:iam::123456789012:user/test-user');
    expect(res.body.data.userId).toBe('AIDASAMPLEUSERID');
    expect(res.body.data.region).toBe('us-east-1');
    expect(res.body.message).toMatch(/successfully connected/i);
  });

  it('accepts keys starting with ASIA (session tokens)', async () => {
    mockSend.mockResolvedValueOnce({
      Account: '111222333444',
      Arn: 'arn:aws:sts::111222333444:assumed-role/MyRole/session',
      UserId: 'AROASAMPLEUSERID:session',
    });

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'ASIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'some-secret');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accountId).toBe('111222333444');
  });

  it('defaults region to us-east-1 when x-aws-region header is absent', async () => {
    mockSend.mockResolvedValueOnce({
      Account: '123456789012',
      Arn: 'arn:aws:iam::123456789012:user/test',
      UserId: 'AIDA',
    });

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'secret');

    expect(res.status).toBe(200);
    expect(res.body.data.region).toBe('us-east-1');
  });

  it('returns 401 for InvalidClientTokenId (bad access key)', async () => {
    const error = new Error('Bad key') as any;
    error.name = 'InvalidClientTokenId';
    mockSend.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIABADKEY12345678XX')
      .set('x-aws-secret-access-key', 'some-secret');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid aws access key id/i);
  });

  it('returns 401 for InvalidAccessKeyId', async () => {
    const error = new Error('Invalid key') as any;
    error.name = 'InvalidAccessKeyId';
    mockSend.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIABADKEY12345678XX')
      .set('x-aws-secret-access-key', 'some-secret');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid aws access key id/i);
  });

  it('returns 401 for SignatureDoesNotMatch (wrong secret)', async () => {
    const error = new Error('Signature mismatch') as any;
    error.name = 'SignatureDoesNotMatch';
    mockSend.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'WRONG_SECRET');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid aws secret access key/i);
  });

  it('returns 401 for ExpiredTokenException (credentials expired)', async () => {
    const error = new Error('Token expired') as any;
    error.name = 'ExpiredTokenException';
    mockSend.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'ASIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'secret');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('returns 500 for unexpected errors (passed to error handler)', async () => {
    const error = new Error('Network timeout');
    mockSend.mockRejectedValueOnce(error);

    const res = await request(app)
      .post('/api/aws/validate')
      .set('x-aws-access-key-id', 'AKIAIOSFODNN7EXAMPLE')
      .set('x-aws-secret-access-key', 'secret');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
