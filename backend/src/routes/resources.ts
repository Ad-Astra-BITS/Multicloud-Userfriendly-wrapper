import { Router } from 'express';
import {
  getAllResources,
  getResourcesByType,
  getAlerts,
  resolveAlert,
} from '../controllers/resourcesController';

const router = Router();

router.get('/', getAllResources);
router.get('/alerts', getAlerts);
router.patch('/alerts/:id/resolve', resolveAlert);
router.get('/:type', getResourcesByType);

export default router;
