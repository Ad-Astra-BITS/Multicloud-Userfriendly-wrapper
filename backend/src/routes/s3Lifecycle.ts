import { Router } from 'express';
import { listBuckets, applyBucket, applyAll } from '../controllers/s3LifecycleController';

const router = Router();

router.get('/', listBuckets);
router.post('/apply-all', applyAll);
router.post('/:bucketName/apply', applyBucket);

export default router;
