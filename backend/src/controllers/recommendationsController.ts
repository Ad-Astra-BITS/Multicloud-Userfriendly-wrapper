import { Request, Response, NextFunction } from 'express';
import {
  generateRecommendations,
  getAllPending,
  applyRecommendation,
  dismissRecommendation,
} from '../services/recommendationsService';
import { ApiResponse } from '../types';

/** GET /api/recommendations — returns all pending recommendations (from DB cache) */
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getAllPending();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** POST /api/recommendations/refresh — pulls fresh data from AWS and re-runs rules */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await generateRecommendations(req.awsClients);
    res.json({ success: true, data, message: `${data.length} recommendations generated` } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** POST /api/recommendations/:id/apply — marks a recommendation as applied */
export async function apply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await applyRecommendation(req.params.id);
    res.json({ success: true, data, message: 'Recommendation marked as applied' } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/recommendations/:id — dismisses a recommendation */
export async function dismiss(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await dismissRecommendation(req.params.id);
    res.json({ success: true, data, message: 'Recommendation dismissed' } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}
