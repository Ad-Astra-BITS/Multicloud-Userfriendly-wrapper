import { Router } from 'express';
import { listResources, initiate, verify, execute } from '../controllers/killSwitchController';

const router = Router();

router.get('/resources', listResources);
router.post('/initiate', initiate);
router.post('/verify', verify);
router.post('/execute', execute);

export default router;
