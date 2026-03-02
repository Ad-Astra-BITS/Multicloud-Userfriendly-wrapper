/**
 * s3LifecycleService.ts
 *
 * Business logic for S3 storage-tier management.
 * Maps frontend tier names to AWS StorageClass values and delegates real
 * API calls to awsResourceService.
 */

import { prisma } from '../config/database';
import {
  listS3Buckets,
  getS3LifecycleRules,
  applyGlacierLifecycle,
  applyIntelligentTiering,
} from './awsResourceService';
import { S3Bucket, S3Tier } from '../types';

// Savings multipliers (approximate cost reduction vs Standard)
const SAVINGS_RATE: Record<S3Tier, number> = {
  Standard: 0,
  'Intelligent Tiering': 0.3,
  Glacier: 0.72,
  'Glacier Deep Archive': 0.95,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Lists all S3 buckets, checks their current lifecycle rules, and returns
 * enriched objects with tier recommendations and estimated savings.
 */
export async function listBucketsWithRecommendations(): Promise<S3Bucket[]> {
  const resources = await listS3Buckets();
  const enriched: S3Bucket[] = [];

  for (const r of resources) {
    const rules = await getS3LifecycleRules(r.awsId).catch(() => []);
    const currentTier = inferTierFromRules(rules);
    const recommendedTier = suggestTier(currentTier);
    const sizeBytes = await getBucketSizeFromDB(r.awsId);
    const monthlyCostUSD = estimateMonthlyCost(sizeBytes);
    const estimatedSavings = round2(
      monthlyCostUSD * (SAVINGS_RATE[recommendedTier] - SAVINGS_RATE[currentTier]),
    );

    enriched.push({
      id: r.id,
      awsBucketName: r.awsBucketName ?? r.name,
      currentTier,
      recommendedTier: estimatedSavings > 0 ? recommendedTier : undefined,
      sizeBytes,
      estimatedSavings: Math.max(0, estimatedSavings),
      lifecycleApplied: rules.length > 0,
    });
  }

  return enriched;
}

/**
 * Applies the recommended storage-tier transition to a single bucket.
 * Persists the change to the DB.
 */
export async function applyTierChange(bucketName: string, targetTier: S3Tier): Promise<void> {
  switch (targetTier) {
    case 'Glacier':
      await applyGlacierLifecycle(bucketName, 30);
      break;
    case 'Glacier Deep Archive':
      await applyGlacierLifecycle(bucketName, 30, 90);
      break;
    case 'Intelligent Tiering':
      await applyIntelligentTiering(bucketName);
      break;
    default:
      throw new Error(`Cannot downgrade to ${targetTier} via lifecycle policy`);
  }

  await prisma.s3Bucket.upsert({
    where: { awsBucketName: bucketName },
    update: {
      currentTier: tierToEnum(targetTier),
      lifecycleApplied: true,
    },
    create: {
      awsBucketName: bucketName,
      currentTier: tierToEnum(targetTier),
      sizeBytes: 0n,
      lifecycleApplied: true,
    },
  });
}

/**
 * Applies the recommended tier change to every bucket that has a recommendation.
 */
export async function applyAllTierChanges(): Promise<{ applied: number; failed: string[] }> {
  const buckets = await listBucketsWithRecommendations();
  let applied = 0;
  const failed: string[] = [];

  for (const bucket of buckets) {
    if (!bucket.recommendedTier || bucket.lifecycleApplied) continue;
    try {
      await applyTierChange(bucket.awsBucketName, bucket.recommendedTier);
      applied++;
    } catch {
      failed.push(bucket.awsBucketName);
    }
  }

  return { applied, failed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferTierFromRules(rules: { Transitions?: { StorageClass?: string }[] }[]): S3Tier {
  for (const rule of rules) {
    for (const t of rule.Transitions ?? []) {
      if (t.StorageClass === 'DEEP_ARCHIVE') return 'Glacier Deep Archive';
      if (t.StorageClass === 'GLACIER') return 'Glacier';
      if (t.StorageClass === 'INTELLIGENT_TIERING') return 'Intelligent Tiering';
    }
  }
  return 'Standard';
}

function suggestTier(current: S3Tier): S3Tier {
  const ladder: S3Tier[] = ['Standard', 'Intelligent Tiering', 'Glacier', 'Glacier Deep Archive'];
  const idx = ladder.indexOf(current);
  return ladder[Math.min(idx + 1, ladder.length - 1)];
}

function tierToEnum(tier: S3Tier): 'STANDARD' | 'INTELLIGENT_TIERING' | 'GLACIER' | 'GLACIER_DEEP_ARCHIVE' {
  const map: Record<S3Tier, ReturnType<typeof tierToEnum>> = {
    Standard: 'STANDARD',
    'Intelligent Tiering': 'INTELLIGENT_TIERING',
    Glacier: 'GLACIER',
    'Glacier Deep Archive': 'GLACIER_DEEP_ARCHIVE',
  };
  return map[tier];
}

async function getBucketSizeFromDB(bucketName: string): Promise<number> {
  const row = await prisma.s3Bucket.findUnique({ where: { awsBucketName: bucketName } });
  return Number(row?.sizeBytes ?? 0);
}

/** Rough estimate: Standard S3 is $0.023/GB/month */
function estimateMonthlyCost(sizeBytes: number): number {
  const gb = sizeBytes / 1_073_741_824;
  return round2(gb * 0.023);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
