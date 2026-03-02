import { Router } from 'express';
import { summary, trend, breakdown, distribution } from '../controllers/analyticsController';

const router = Router();

router.get('/summary', summary);
router.get('/trend', trend);
router.get('/breakdown', breakdown);
router.get('/distribution', distribution);

export default router;
