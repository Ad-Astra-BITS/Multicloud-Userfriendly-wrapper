import { Request, Response, NextFunction } from 'express';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { ApiResponse } from '../types';

export interface AccountInfo {
  accountId: string;
  arn: string;
  userId: string;
  region: string;
}

/**
 * POST /api/aws/validate
 *
 * Validates AWS credentials supplied in the request headers:
 *   x-aws-access-key-id, x-aws-secret-access-key, x-aws-region
 *
 * Uses STS GetCallerIdentity — a zero-permission API call that succeeds
 * whenever the credentials are valid, regardless of attached policies.
 * Returns the AWS Account ID so the frontend can display it.
 */
export async function validateAwsCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accessKeyId = req.headers['x-aws-access-key-id'] as string;
    const secretAccessKey = req.headers['x-aws-secret-access-key'] as string;
    const region = (req.headers['x-aws-region'] as string) || 'us-east-1';

    if (!accessKeyId || !secretAccessKey) {
      res.status(400).json({
        success: false,
        error: 'Missing required headers: x-aws-access-key-id and x-aws-secret-access-key',
      } satisfies ApiResponse);
      return;
    }

    if (!accessKeyId.startsWith('AKIA') && !accessKeyId.startsWith('ASIA')) {
      res.status(400).json({
        success: false,
        error: 'Invalid Access Key ID format. It should start with AKIA or ASIA.',
      } satisfies ApiResponse);
      return;
    }

    const stsClient = new STSClient({
      region: 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
    });

    const identity = await stsClient.send(new GetCallerIdentityCommand({}));

    const data: AccountInfo = {
      accountId: identity.Account ?? 'Unknown',
      arn: identity.Arn ?? 'Unknown',
      userId: identity.UserId ?? 'Unknown',
      region,
    };

    res.json({
      success: true,
      data,
      message: `Successfully connected to AWS account ${identity.Account}`,
    } satisfies ApiResponse<AccountInfo>);
  } catch (err: unknown) {
    const error = err as { name?: string; message?: string };

    // Surface AWS auth errors clearly to the frontend
    if (
      error.name === 'InvalidClientTokenId' ||
      error.name === 'AuthFailure' ||
      error.name === 'InvalidAccessKeyId'
    ) {
      res.status(401).json({
        success: false,
        error: 'Invalid AWS Access Key ID. Please check your credentials.',
      } satisfies ApiResponse);
      return;
    }

    if (error.name === 'SignatureDoesNotMatch') {
      res.status(401).json({
        success: false,
        error: 'Invalid AWS Secret Access Key. The signature does not match.',
      } satisfies ApiResponse);
      return;
    }

    if (error.name === 'ExpiredTokenException') {
      res.status(401).json({
        success: false,
        error: 'AWS credentials have expired. Please generate new access keys.',
      } satisfies ApiResponse);
      return;
    }

    next(err);
  }
}
