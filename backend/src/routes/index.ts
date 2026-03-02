import { Router } from 'express';
import resourcesRouter from './resources';
import analyticsRouter from './analytics';
import recommendationsRouter from './recommendations';
import s3LifecycleRouter from './s3Lifecycle';
import killSwitchRouter from './killSwitch';

const router = Router();

router.use('/resources', resourcesRouter);
router.use('/analytics', analyticsRouter);
router.use('/recommendations', recommendationsRouter);
router.use('/s3-lifecycle', s3LifecycleRouter);
router.use('/kill-switch', killSwitchRouter);

/** Health check */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
