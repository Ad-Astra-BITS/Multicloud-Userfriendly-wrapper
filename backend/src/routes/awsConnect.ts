import { Router } from 'express';
import { validateAwsCredentials } from '../controllers/awsConnectController';

const router = Router();

/**
 * POST /api/aws/validate
 * Validates AWS credentials (Access Key ID + Secret) using STS GetCallerIdentity.
 * Returns the Account ID, ARN, and User ID on success.
 */
router.post('/validate', validateAwsCredentials);

export default router;
