import { Router } from 'express';
import { digitalOceanCredentialsMiddleware } from '../middleware/digitalOceanCredentials';
import {
  validateDoCredentials,
  listDroplets,
  dropletMetrics,
  terminateDroplets,
  listSpaces,
  optimizeSpace,
  deleteSpace,
  listDatabases,
  stopDatabase,
  billingHistory,
} from '../controllers/digitalOceanController';

const router = Router();

router.use(digitalOceanCredentialsMiddleware);
router.post('/validate', validateDoCredentials);
router.post('/droplets/terminate', terminateDroplets);
router.get('/droplets', listDroplets);
router.get('/droplets/:id/metrics', dropletMetrics);
router.get('/spaces', listSpaces);
router.post('/spaces/:region/:name/optimize', optimizeSpace);
router.delete('/spaces/:region/:name', deleteSpace);
router.get('/databases', listDatabases);
router.post('/databases/:id/stop', stopDatabase);
router.get('/billing', billingHistory);

export default router;
