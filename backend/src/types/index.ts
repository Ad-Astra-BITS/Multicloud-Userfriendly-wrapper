// ── Primitives ────────────────────────────────────────────────────────────────

export type ResourceType = 'EC2' | 'S3' | 'RDS';
export type ResourceStatus = 'running' | 'stopped' | 'warning' | 'terminated';
export type S3Tier = 'Standard' | 'Intelligent Tiering' | 'Glacier' | 'Glacier Deep Archive';
export type Priority = 'high' | 'medium' | 'low';
export type Severity = 'critical' | 'warning' | 'info';
export type RecommendationStatus = 'pending' | 'applied' | 'dismissed';

// ── Domain Models ─────────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  awsId: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  region: string;
  monthlyCost: number;
  tags?: Record<string, string>;
}

export interface S3Bucket {
  id: string;
  awsBucketName: string;
  currentTier: S3Tier;
  recommendedTier?: S3Tier;
  sizeBytes: number;
  estimatedSavings: number;
  lastAccessed?: string;
  lifecycleApplied: boolean;
}

export interface Recommendation {
  id: string;
  resourceId: string;
  title: string;
  description: string;
  currentTier: string;
  recommendedTier: string;
  estimatedSavings: number;
  priority: Priority;
  status: RecommendationStatus;
  appliedAt?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  resourceId?: string;
  title: string;
  description: string;
  severity: Severity;
  resolved: boolean;
  createdAt: string;
}

export interface CostRecord {
  month: string;
  service: string;
  cost: number;
}

export interface DashboardSummary {
  totalMonthlyCost: number;
  costChange: number;
  activeResources: { ec2: number; s3: number; rds: number };
  potentialSavings: number;
  alertCount: number;
}

// ── API Envelope ──────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
