/**
 * analyticsService.ts
 * Aggregates cost data from AWS Cost Explorer and persists snapshots to the DB.
 * All functions now accept an optional AwsClients parameter so controllers can
 * pass per-request credentials from the frontend instead of using env-var singletons.
 */

import { prisma } from '../config/database';
import { getMonthlyCostsByService, getTotalCostPerMonth, listEC2Instances, listS3Buckets, listRDSInstances } from './awsResourceService';
import { DashboardSummary, CostRecord } from '../types';
import { AwsClients } from '../config/aws';

type Clients = Partial<AwsClients>;

export async function getCostBreakdown(months = 6, clients?: Clients): Promise<CostRecord[]> {
  const records = await getMonthlyCostsByService(months, clients);

  for (const record of records) {
    await prisma.costRecord.upsert({
      where: { month_service: { month: record.month, service: record.service } },
      update: { cost: record.cost },
      create: { month: record.month, service: record.service, cost: record.cost },
    });
  }

  return records;
}

export async function getCostTrend(months = 6, clients?: Clients): Promise<{ month: string; cost: number }[]> {
  return getTotalCostPerMonth(months, clients);
}

export async function getDashboardSummary(clients?: Clients): Promise<DashboardSummary> {
  // Cost trend (calls Cost Explorer — uses user's credentials)
  const trend = await getTotalCostPerMonth(2, clients).catch(() => []);
  const current = trend[trend.length - 1]?.cost ?? 0;
  const previous = trend[trend.length - 2]?.cost ?? 0;
  const costChange = previous > 0 ? round2(((current - previous) / previous) * 100) : 0;

  // Resource counts: try live AWS first, fall back to DB cache
  let ec2Count = 0, s3Count = 0, rdsCount = 0;
  try {
    const [ec2, s3, rds] = await Promise.all([
      listEC2Instances(clients),
      listS3Buckets(clients),
      listRDSInstances(clients),
    ]);
    ec2Count = ec2.filter((r) => r.status !== 'terminated').length;
    s3Count = s3.length;
    rdsCount = rds.filter((r) => r.status !== 'terminated').length;
  } catch {
    // Fall back to DB if AWS call fails
    [ec2Count, s3Count, rdsCount] = await Promise.all([
      prisma.resource.count({ where: { type: 'EC2', status: { not: 'TERMINATED' } } }),
      prisma.resource.count({ where: { type: 'S3' } }),
      prisma.resource.count({ where: { type: 'RDS', status: { not: 'TERMINATED' } } }),
    ]);
  }

  const [alertCount, pendingRecs] = await Promise.all([
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

export async function getCostDistribution(month?: string, clients?: Clients): Promise<CostRecord[]> {
  const targetMonth = month ?? new Date().toISOString().slice(0, 7);

  // Try to get fresh data from Cost Explorer; fall back to DB cache
  try {
    const records = await getMonthlyCostsByService(1, clients);
    const thisMonth = records.filter((r) => r.month === targetMonth);
    if (thisMonth.length > 0) return thisMonth;
  } catch { /* fall through to DB cache */ }

  const rows = await prisma.costRecord.findMany({
    where: { month: targetMonth },
    orderBy: { cost: 'desc' },
  });

  return rows.map((r) => ({ month: r.month, service: r.service, cost: r.cost }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
