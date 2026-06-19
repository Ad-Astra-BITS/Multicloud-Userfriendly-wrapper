import { Router } from 'express';
import { gcpCredentialsMiddleware } from '../middleware/gcpCredentials';
import {
  validateGcpCredentials,
  listInstances,
  stopInstance,
  startInstance,
  deleteInstances,
  listBuckets,
  deleteBucket,
  listSqlInstances,
  billingEstimate,
} from '../controllers/gcpController';

const router = Router();

router.use(gcpCredentialsMiddleware);
router.post('/validate', validateGcpCredentials);

// Compute Engine
router.get('/instances', listInstances);
router.post('/instances/:zone/:name/stop', stopInstance);
router.post('/instances/:zone/:name/start', startInstance);
router.post('/instances/delete', deleteInstances);

// Cloud Storage
router.get('/buckets', listBuckets);
router.delete('/buckets/:name', deleteBucket);

// Cloud SQL
router.get('/sql', listSqlInstances);

// Billing
router.get('/billing', billingEstimate);

export default router;
