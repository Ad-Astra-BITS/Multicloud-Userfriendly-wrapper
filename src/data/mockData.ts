/**
 * Mock data for Ad Astra cloud management dashboard
 * This file contains all the dummy data used throughout the application
 */

import {
  Resource,
  Recommendation,
  S3Bucket,
  Alert,
  MonthlyCost,
  ResourceUsage,
  ServerComparison,
  DashboardSummary,
} from '@/types';

// ============================================
// Dashboard Summary Data
// ============================================

export const dashboardSummary: DashboardSummary = {
  totalMonthlyCost: 12458.32,
  costChange: -5.2, // percentage change from last month
  activeResources: {
    ec2: 24,
    s3: 18,
    rds: 6,
  },
  potentialSavings: 2847.50,
  alertCount: 5,
};

// ============================================
// Resources Data
// ============================================

export const resources: Resource[] = [
  { id: 'ec2-001', name: 'prod-web-server-1', type: 'EC2', status: 'running', monthlyCost: 156.40, region: 'us-east-1' },
  { id: 'ec2-002', name: 'prod-web-server-2', type: 'EC2', status: 'running', monthlyCost: 156.40, region: 'us-east-1' },
  { id: 'ec2-003', name: 'dev-test-server', type: 'EC2', status: 'warning', monthlyCost: 89.20, region: 'us-west-2' },
  { id: 'ec2-004', name: 'staging-api-server', type: 'EC2', status: 'stopped', monthlyCost: 45.00, region: 'eu-west-1' },
  { id: 's3-001', name: 'user-uploads', type: 'S3', status: 'running', monthlyCost: 234.50, region: 'us-east-1' },
  { id: 's3-002', name: 'user-logs', type: 'S3', status: 'warning', monthlyCost: 567.80, region: 'us-east-1' },
  { id: 's3-003', name: 'backup-archive', type: 'S3', status: 'running', monthlyCost: 123.45, region: 'us-west-2' },
  { id: 'rds-001', name: 'prod-database', type: 'RDS', status: 'running', monthlyCost: 445.60, region: 'us-east-1' },
  { id: 'rds-002', name: 'analytics-db', type: 'RDS', status: 'running', monthlyCost: 312.80, region: 'us-east-1' },
];

// ============================================
// Recommendations Data
// ============================================

export const recommendations: Recommendation[] = [
  {
    id: 'rec-001',
    resourceName: 'user-logs',
    resourceType: 'S3',
    currentTier: 'Standard',
    recommendedTier: 'Glacier Deep Archive',
    estimatedSavings: 45.00,
    description: "Move S3 bucket 'user-logs' from Standard tier to Glacier Deep Archive to save $45/month. This bucket hasn't been accessed in 90 days.",
    priority: 'high',
  },
  {
    id: 'rec-002',
    resourceName: 'dev-test-server',
    resourceType: 'EC2',
    currentTier: 't3.large',
    recommendedTier: 't3.medium',
    estimatedSavings: 35.50,
    description: "Downsize EC2 instance 'dev-test-server' from t3.large to t3.medium. CPU utilization has been below 20% for the past 30 days.",
    priority: 'medium',
  },
  {
    id: 'rec-003',
    resourceName: 'backup-archive',
    resourceType: 'S3',
    currentTier: 'Standard',
    recommendedTier: 'Glacier',
    estimatedSavings: 28.75,
    description: "Move S3 bucket 'backup-archive' to Glacier tier. Files are accessed less than once per quarter.",
    priority: 'medium',
  },
  {
    id: 'rec-004',
    resourceName: 'staging-api-server',
    resourceType: 'EC2',
    currentTier: 'On-Demand',
    recommendedTier: 'Reserved Instance',
    estimatedSavings: 67.20,
    description: "Convert 'staging-api-server' to a Reserved Instance. Consistent usage pattern suggests 40% savings with 1-year commitment.",
    priority: 'high',
  },
  {
    id: 'rec-005',
    resourceName: 'analytics-db',
    resourceType: 'RDS',
    currentTier: 'db.r5.large',
    recommendedTier: 'db.r5.medium',
    estimatedSavings: 89.40,
    description: "Downsize RDS instance 'analytics-db' to db.r5.medium. Memory utilization averages 35%.",
    priority: 'low',
  },
];

// ============================================
// S3 Bucket Lifecycle Recommendations
// ============================================

export const s3Buckets: S3Bucket[] = [
  {
    id: 's3-001',
    name: 'user-logs',
    currentTier: 'Standard',
    recommendedTier: 'Glacier Deep Archive',
    size: '2.4 TB',
    estimatedSavings: 45.00,
    lastAccessed: '92 days ago',
  },
  {
    id: 's3-002',
    name: 'backup-archive',
    currentTier: 'Standard',
    recommendedTier: 'Glacier',
    size: '850 GB',
    estimatedSavings: 28.75,
    lastAccessed: '45 days ago',
  },
  {
    id: 's3-003',
    name: 'media-assets',
    currentTier: 'Standard',
    recommendedTier: 'Intelligent Tiering',
    size: '1.2 TB',
    estimatedSavings: 18.50,
    lastAccessed: '12 days ago',
  },
  {
    id: 's3-004',
    name: 'compliance-docs',
    currentTier: 'Intelligent Tiering',
    recommendedTier: 'Glacier',
    size: '340 GB',
    estimatedSavings: 12.30,
    lastAccessed: '180 days ago',
  },
  {
    id: 's3-005',
    name: 'old-reports',
    currentTier: 'Standard',
    recommendedTier: 'Glacier Deep Archive',
    size: '560 GB',
    estimatedSavings: 22.40,
    lastAccessed: '365 days ago',
  },
];

// ============================================
// Alerts Data
// ============================================

export const alerts: Alert[] = [
  {
    id: 'alert-001',
    title: 'Unused EC2 Instance Detected',
    description: "Instance 'staging-api-server' has been stopped for 14 days. Consider terminating to avoid storage costs.",
    severity: 'warning',
    timestamp: '2 hours ago',
    resourceId: 'ec2-004',
  },
  {
    id: 'alert-002',
    title: 'High S3 Storage Costs',
    description: "Bucket 'user-logs' is using Standard tier for 2.4TB of rarely accessed data.",
    severity: 'critical',
    timestamp: '5 hours ago',
    resourceId: 's3-002',
  },
  {
    id: 'alert-003',
    title: 'Underutilized RDS Instance',
    description: "Database 'analytics-db' CPU usage below 15% for the past week.",
    severity: 'info',
    timestamp: '1 day ago',
    resourceId: 'rds-002',
  },
  {
    id: 'alert-004',
    title: 'Unattached EBS Volume',
    description: "Volume 'vol-0abc123' has been unattached for 30 days. $23.50/month wasted.",
    severity: 'warning',
    timestamp: '2 days ago',
  },
  {
    id: 'alert-005',
    title: 'Reserved Instance Expiring',
    description: "Reserved instance for 'prod-web-server-1' expires in 15 days. Review and renew.",
    severity: 'info',
    timestamp: '3 days ago',
    resourceId: 'ec2-001',
  },
];

// ============================================
// Analytics Data - Monthly Costs
// ============================================

export const monthlyCosts: MonthlyCost[] = [
  { month: 'Jul', cost: 11234 },
  { month: 'Aug', cost: 12890 },
  { month: 'Sep', cost: 11567 },
  { month: 'Oct', cost: 13456 },
  { month: 'Nov', cost: 12234 },
  { month: 'Dec', cost: 13145 },
  { month: 'Jan', cost: 12458 },
];

// ============================================
// Analytics Data - Resource Usage Distribution
// ============================================

export const resourceUsage: ResourceUsage[] = [
  { name: 'EC2', value: 5840, color: '#3b82f6' },
  { name: 'S3', value: 3245, color: '#10b981' },
  { name: 'RDS', value: 2156, color: '#f59e0b' },
  { name: 'Other', value: 1217, color: '#6b7280' },
];

// ============================================
// Server Comparison Data
// ============================================

// Base prices for different configurations (per provider)
const serverPrices: Record<string, Record<string, number>> = {
  'AWS': { '1-2-50': 18.50, '2-4-50': 36.80, '4-8-50': 73.20, '2-2-50': 28.40, '4-4-50': 55.60, '1-4-50': 24.20, '4-2-50': 42.80, '1-8-50': 32.40, '2-8-50': 48.60 },
  'Azure': { '1-2-50': 19.20, '2-4-50': 38.40, '4-8-50': 76.80, '2-2-50': 29.80, '4-4-50': 58.20, '1-4-50': 25.60, '4-2-50': 44.80, '1-8-50': 34.20, '2-8-50': 51.40 },
  'DigitalOcean': { '1-2-50': 12.00, '2-4-50': 24.00, '4-8-50': 48.00, '2-2-50': 18.00, '4-4-50': 36.00, '1-4-50': 18.00, '4-2-50': 30.00, '1-8-50': 24.00, '2-8-50': 36.00 },
  'GCP': { '1-2-50': 17.80, '2-4-50': 35.20, '4-8-50': 70.40, '2-2-50': 27.20, '4-4-50': 53.40, '1-4-50': 23.40, '4-2-50': 41.20, '1-8-50': 31.60, '2-8-50': 47.20 },
};

// Instance type names per provider
const instanceTypes: Record<string, Record<string, string>> = {
  'AWS': { '1': 't3.micro', '2': 't3.small', '4': 't3.medium' },
  'Azure': { '1': 'B1s', '2': 'B2s', '4': 'B4ms' },
  'DigitalOcean': { '1': 's-1vcpu', '2': 's-2vcpu', '4': 's-4vcpu' },
  'GCP': { '1': 'e2-micro', '2': 'e2-small', '4': 'e2-medium' },
};

// Regions per provider
const providerRegions: Record<string, string> = {
  'AWS': 'us-east-1',
  'Azure': 'East US',
  'DigitalOcean': 'NYC1',
  'GCP': 'us-central1',
};

/**
 * Generates server comparison data based on selected specs
 */
export function getServerComparisons(cpu: number, ram: number): ServerComparison[] {
  const key = `${cpu}-${ram}-50`;
  const providers: Array<'AWS' | 'Azure' | 'DigitalOcean' | 'GCP'> = ['AWS', 'Azure', 'DigitalOcean', 'GCP'];

  const comparisons = providers.map((provider) => ({
    id: `${provider.toLowerCase()}-${cpu}-${ram}`,
    provider,
    instanceType: instanceTypes[provider][cpu.toString()] || 'custom',
    cpu: `${cpu} vCPU`,
    ram: `${ram} GB`,
    storage: '50 GB SSD',
    monthlyPrice: serverPrices[provider][key] || 30.00,
    region: providerRegions[provider],
    isBestChoice: false,
  }));

  // Find the cheapest option and mark it as best choice
  const minPrice = Math.min(...comparisons.map((c) => c.monthlyPrice));
  comparisons.forEach((c) => {
    c.isBestChoice = c.monthlyPrice === minPrice;
  });

  return comparisons;
}

// Default comparison data (2 vCPU, 4 GB RAM)
export const defaultServerComparisons: ServerComparison[] = getServerComparisons(2, 4);
