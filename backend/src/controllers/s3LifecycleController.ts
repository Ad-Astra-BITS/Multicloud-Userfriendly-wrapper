import { Request, Response, NextFunction } from 'express';
import {
  listBucketsWithRecommendations,
  applyTierChange,
  applyAllTierChanges,
} from '../services/s3LifecycleService';
import { S3Tier, ApiResponse } from '../types';

/** GET /api/s3-lifecycle — all buckets with tier recommendations */
export async function listBuckets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await listBucketsWithRecommendations();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** POST /api/s3-lifecycle/:bucketName/apply — apply a specific tier to one bucket */
export async function applyBucket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { bucketName } = req.params;
    const { targetTier } = req.body as { targetTier: S3Tier };

    const validTiers: S3Tier[] = ['Intelligent Tiering', 'Glacier', 'Glacier Deep Archive'];
    if (!validTiers.includes(targetTier)) {
      res.status(400).json({ success: false, error: `targetTier must be one of: ${validTiers.join(', ')}` });
      return;
    }

    await applyTierChange(bucketName, targetTier);
    res.json({ success: true, message: `Lifecycle policy applied: ${bucketName} → ${targetTier}` } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** POST /api/s3-lifecycle/apply-all — apply all pending tier recommendations */
export async function applyAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await applyAllTierChanges();
    res.json({
      success: true,
      data: result,
      message: `Applied ${result.applied} bucket(s). Failed: ${result.failed.length}`,
    } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}
