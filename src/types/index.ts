/**
 * TypeScript type definitions for Ad Astra cloud management dashboard
 */

// ============================================
// Resource Types
// ============================================

export interface Resource {
  id: string;
  name: string;
  type: 'EC2' | 'S3' | 'RDS';
  status: 'running' | 'stopped' | 'warning';
  monthlyCost: number;
  region: string;
}

// ============================================
// Recommendation Types
// ============================================

export interface Recommendation {
  id: string;
  resourceName: string;
  resourceType: 'EC2' | 'S3' | 'RDS';
  currentTier: string;
  recommendedTier: string;
  estimatedSavings: number;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export type S3Tier = 'Standard' | 'Intelligent Tiering' | 'Glacier' | 'Glacier Deep Archive';

export interface S3Bucket {
  id: string;
  name: string;
  currentTier: S3Tier;
  recommendedTier: S3Tier;
  size: string;
  estimatedSavings: number;
  lastAccessed: string;
}

// ============================================
// Alert Types
// ============================================

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
  resourceId?: string;
}

// ============================================
// Analytics Types
// ============================================

export interface MonthlyCost {
  month: string;
  cost: number;
}

export interface ResourceUsage {
  name: string;
  value: number;
  color: string;
}

// ============================================
// Server Comparison Types
// ============================================

export interface ServerSpec {
  cpu: number;
  ram: number;
  storage: number;
}

export interface ServerComparison {
  id: string;
  provider: 'AWS' | 'Azure' | 'DigitalOcean' | 'GCP';
  instanceType: string;
  cpu: string;
  ram: string;
  storage: string;
  monthlyPrice: number;
  region: string;
  isBestChoice: boolean;
}

// ============================================
// Dashboard Summary Types
// ============================================

export interface DashboardSummary {
  totalMonthlyCost: number;
  costChange: number;
  activeResources: {
    ec2: number;
    s3: number;
    rds: number;
  };
  potentialSavings: number;
  alertCount: number;
}
