/**
 * analyticsService.ts
 * Aggregates cost data from AWS Cost Explorer and persists snapshots to the DB.
 */

import { prisma } from '../config/database';
import { getMonthlyCostsByService, getTotalCostPerMonth } from './awsResourceService';
import { DashboardSummary, CostRecord } from '../types';

/**
 * Fetches live cost data from Cost Explorer, upserts into cost_records,
 * and returns per-service breakdown for the last N months.
 */
export async function getCostBreakdown(months = 6): Promise<CostRecord[]> {
  const records = await getMonthlyCostsByService(months);

  // Persist/update each record so the dashboard can render offline too
  for (const record of records) {
    await prisma.costRecord.upsert({
      where: { month_service: { month: record.month, service: record.service } },
      update: { cost: record.cost },
      create: { month: record.month, service: record.service, cost: record.cost },
    });
  }

  return records;
}

/**
 * Returns total monthly cost trend (all services combined) for the last N months.
 */
export async function getCostTrend(months = 6): Promise<{ month: string; cost: number }[]> {
  return getTotalCostPerMonth(months);
}

/**
 * Computes a high-level dashboard summary from Cost Explorer + DB.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const trend = await getTotalCostPerMonth(2);
  const current = trend[trend.length - 1]?.cost ?? 0;
  const previous = trend[trend.length - 2]?.cost ?? 0;
  const costChange = previous > 0 ? round2(((current - previous) / previous) * 100) : 0;

  const [ec2Count, s3Count, rdsCount, alertCount, pendingRecs] = await Promise.all([
    prisma.resource.count({ where: { type: 'EC2', status: { not: 'TERMINATED' } } }),
    prisma.resource.count({ where: { type: 'S3' } }),
    prisma.resource.count({ where: { type: 'RDS', status: { not: 'TERMINATED' } } }),
    prisma.alert.count({ where: { resolved: false } }),
    prisma.recommendation.aggregate({
      where: { status: 'PENDING' },
      _sum: { estimatedSavings: true },
    }),
  ]);

  return {
    totalMonthlyCost: current,
    costChange,
    activeResources: { ec2: ec2Count, s3: s3Count, rds: rdsCount },
    potentialSavings: round2(pendingRecs._sum.estimatedSavings ?? 0),
    alertCount,
  };
}

/** Returns cost distribution per service for a given month (defaults to current). */
export async function getCostDistribution(month?: string): Promise<CostRecord[]> {
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  const records = await prisma.costRecord.findMany({
    where: { month: targetMonth },
    orderBy: { cost: 'desc' },
  });

  return records.map((r) => ({ month: r.month, service: r.service, cost: r.cost }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
