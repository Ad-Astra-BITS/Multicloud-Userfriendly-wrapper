import { Router } from 'express';
import { list, refresh, apply, dismiss } from '../controllers/recommendationsController';

const router = Router();

router.get('/', list);
router.post('/refresh', refresh);
router.post('/:id/apply', apply);
router.delete('/:id', dismiss);

export default router;
