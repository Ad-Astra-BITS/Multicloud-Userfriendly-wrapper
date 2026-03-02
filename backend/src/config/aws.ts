import { EC2Client } from '@aws-sdk/client-ec2';
import { S3Client } from '@aws-sdk/client-s3';
import { RDSClient } from '@aws-sdk/client-rds';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

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
