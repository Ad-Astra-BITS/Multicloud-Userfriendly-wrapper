import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';

describe('GET /api/health', () => {
  it('returns 200 with status ok and a timestamp', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
  });
});

describe('Unknown routes', () => {
  it('returns 404 for unregistered GET route', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 404 for unregistered POST route', async () => {
    const res = await request(app).post('/api/totally-unknown');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for top-level unregistered route', async () => {
    const res = await request(app).get('/not-api-at-all');

    expect(res.status).toBe(404);
  });
});
