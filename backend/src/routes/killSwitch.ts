import { Router } from 'express';
import { initiate, verify, execute } from '../controllers/killSwitchController';

const router = Router();

router.post('/initiate', initiate);
router.post('/verify', verify);
router.post('/execute', execute);

export default router;
