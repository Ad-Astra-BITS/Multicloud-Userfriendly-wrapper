import { Request, Response, NextFunction } from 'express';
import {
  getCostBreakdown,
  getCostTrend,
  getDashboardSummary,
  getCostDistribution,
} from '../services/analyticsService';
import { ApiResponse } from '../types';

/** GET /api/analytics/summary — dashboard headline numbers */
export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getDashboardSummary(req.awsClients);
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** GET /api/analytics/trend?months=6 — total monthly cost over time */
export async function trend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const months = Math.min(parseInt(String(req.query.months ?? '6'), 10), 12);
    const data = await getCostTrend(months, req.awsClients);
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** GET /api/analytics/breakdown?months=6 — per-service cost breakdown */
export async function breakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const months = Math.min(parseInt(String(req.query.months ?? '6'), 10), 12);
    const data = await getCostBreakdown(months, req.awsClients);
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** GET /api/analytics/distribution?month=2024-01 — pie chart data for a month */
export async function distribution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const month = req.query.month as string | undefined;
    const data = await getCostDistribution(month, req.awsClients);
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}
