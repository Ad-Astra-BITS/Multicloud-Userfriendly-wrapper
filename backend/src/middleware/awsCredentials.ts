import { Request, Response, NextFunction } from 'express';
import { createAwsClients, AwsClients, ec2, s3, rds, costExplorer, cloudWatch, sts } from '../config/aws';

// Augment Express Request so controllers can access req.awsClients
declare global {
  namespace Express {
    interface Request {
      awsClients: AwsClients;
    }
  }
}

/**
 * Reads x-aws-access-key-id / x-aws-secret-access-key / x-aws-region headers.
 * Creates per-request AWS SDK clients from the user's credentials and attaches
 * them to req.awsClients. Falls back to the env-var singletons if no headers.
 */
export function awsCredentialsMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const accessKeyId = req.headers['x-aws-access-key-id'] as string | undefined;
  const secretAccessKey = req.headers['x-aws-secret-access-key'] as string | undefined;
  const region = (req.headers['x-aws-region'] as string | undefined) ?? 'us-east-1';

  if (accessKeyId && secretAccessKey) {
    req.awsClients = createAwsClients({ accessKeyId, secretAccessKey, region });
  } else {
    req.awsClients = { ec2, s3, rds, costExplorer, cloudWatch, sts };
  }

  next();
}
