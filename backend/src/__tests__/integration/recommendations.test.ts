import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { recommendationFixture } from '../helpers/fixtures';

vi.mock('../../services/recommendationsService', () => ({
  getAllPending: vi.fn(),
  generateRecommendations: vi.fn(),
  applyRecommendation: vi.fn(),
  dismissRecommendation: vi.fn(),
}));

import * as recService from '../../services/recommendationsService';

describe('GET /api/recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recService.getAllPending).mockResolvedValue([recommendationFixture]);
  });

  it('returns 200 with all pending recommendations', async () => {
    const res = await request(app).get('/api/recommendations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(recommendationFixture.id);
    expect(res.body.data[0].priority).toBe('high');
    expect(res.body.data[0].status).toBe('pending');
  });

  it('returns empty array when no recommendations exist', async () => {
    vi.mocked(recService.getAllPending).mockResolvedValue([]);

    const res = await request(app).get('/api/recommendations');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(recService.getAllPending).mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/recommendations');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/recommendations/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recService.generateRecommendations).mockResolvedValue([recommendationFixture]);
  });

  it('returns 200 with freshly generated recommendations', async () => {
    const res = await request(app).post('/api/recommendations/refresh');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.message).toMatch(/1 recommendation/i);
  });

  it('includes the count in the message', async () => {
    vi.mocked(recService.generateRecommendations).mockResolvedValue([
      recommendationFixture,
      { ...recommendationFixture, id: 'rec-002' },
    ]);

    const res = await request(app).post('/api/recommendations/refresh');

    expect(res.body.message).toMatch(/2 recommendation/i);
  });

  it('returns 500 when generation fails', async () => {
    vi.mocked(recService.generateRecommendations).mockRejectedValue(
      new Error('AWS throttle'),
    );

    const res = await request(app).post('/api/recommendations/refresh');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/recommendations/:id/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recService.applyRecommendation).mockResolvedValue({
      ...recommendationFixture,
      status: 'applied',
      appliedAt: '2024-01-15T12:00:00.000Z',
    });
  });

  it('returns 200 with the applied recommendation', async () => {
    const res = await request(app).post(
      `/api/recommendations/${recommendationFixture.id}/apply`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('applied');
    expect(res.body.message).toMatch(/applied/i);
  });

  it('passes the correct ID to the service', async () => {
    await request(app).post('/api/recommendations/my-rec-id/apply');
    expect(recService.applyRecommendation).toHaveBeenCalledWith('my-rec-id');
  });

  it('returns 500 when recommendation ID does not exist', async () => {
    vi.mocked(recService.applyRecommendation).mockRejectedValue(
      new Error('Record to update not found'),
    );

    const res = await request(app).post('/api/recommendations/nonexistent/apply');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('DELETE /api/recommendations/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(recService.dismissRecommendation).mockResolvedValue({
      ...recommendationFixture,
      status: 'dismissed',
    });
  });

  it('returns 200 with the dismissed recommendation', async () => {
    const res = await request(app).delete(
      `/api/recommendations/${recommendationFixture.id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('dismissed');
    expect(res.body.message).toMatch(/dismissed/i);
  });

  it('passes the correct ID to the service', async () => {
    await request(app).delete('/api/recommendations/some-id');
    expect(recService.dismissRecommendation).toHaveBeenCalledWith('some-id');
  });

  it('returns 500 when record not found', async () => {
    vi.mocked(recService.dismissRecommendation).mockRejectedValue(
      new Error('Not found'),
    );

    const res = await request(app).delete('/api/recommendations/ghost');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
