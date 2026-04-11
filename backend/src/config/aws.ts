import { EC2Client } from '@aws-sdk/client-ec2';
import { S3Client } from '@aws-sdk/client-s3';
import { RDSClient } from '@aws-sdk/client-rds';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { STSClient } from '@aws-sdk/client-sts';

const region = process.env.AWS_REGION ?? 'us-east-1';

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
};

// Cost Explorer is a global service — endpoint always in us-east-1
export const ec2 = new EC2Client({ region, credentials });
export const s3 = new S3Client({ region, credentials });
export const rds = new RDSClient({ region, credentials });
export const costExplorer = new CostExplorerClient({ region: 'us-east-1', credentials });
export const cloudWatch = new CloudWatchClient({ region, credentials });
export const sts = new STSClient({ region: 'us-east-1', credentials });

// ── Per-request client factory ────────────────────────────────────────────────
// Used when a user provides their own AWS credentials via the Connect flow.

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface AwsClients {
  ec2: EC2Client;
  s3: S3Client;
  rds: RDSClient;
  costExplorer: CostExplorerClient;
  cloudWatch: CloudWatchClient;
  sts: STSClient;
}

/**
 * Creates a fresh set of AWS SDK clients scoped to the provided credentials.
 * Call this per-request when credentials come from the frontend Connect flow.
 */
export function createAwsClients(creds: AwsCredentials): AwsClients {
  const c = { accessKeyId: creds.accessKeyId, secretAccessKey: creds.secretAccessKey };
  return {
    ec2: new EC2Client({ region: creds.region, credentials: c }),
    s3: new S3Client({ region: creds.region, credentials: c }),
    rds: new RDSClient({ region: creds.region, credentials: c }),
    costExplorer: new CostExplorerClient({ region: 'us-east-1', credentials: c }),
    cloudWatch: new CloudWatchClient({ region: creds.region, credentials: c }),
    sts: new STSClient({ region: 'us-east-1', credentials: c }),
  };
}
