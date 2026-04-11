import { Request, Response, NextFunction } from 'express';
import { listEC2Instances, listS3Buckets, listRDSInstances } from '../services/awsResourceService';
import { prisma } from '../config/database';
import { ApiResponse, Resource, ResourceType } from '../types';

/** GET /api/resources — all resources (EC2 + S3 + RDS) from live AWS */
export async function getAllResources(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [ec2, s3, rds] = await Promise.all([
      listEC2Instances(req.awsClients),
      listS3Buckets(req.awsClients),
      listRDSInstances(req.awsClients),
    ]);
    const data = [...ec2, ...s3, ...rds];
    res.json({ success: true, data } satisfies ApiResponse<Resource[]>);
  } catch (err) {
    next(err);
  }
}

/** GET /api/resources/:type — filtered by type (ec2 | s3 | rds) */
export async function getResourcesByType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = (req.params.type ?? '').toUpperCase() as ResourceType;
    let data: Resource[] = [];

    if (type === 'EC2') data = await listEC2Instances(req.awsClients);
    else if (type === 'S3') data = await listS3Buckets(req.awsClients);
    else if (type === 'RDS') data = await listRDSInstances(req.awsClients);
    else {
      res.status(400).json({ success: false, error: 'type must be ec2, s3, or rds' });
      return;
    }

    res.json({ success: true, data } satisfies ApiResponse<Resource[]>);
  } catch (err) {
    next(err);
  }
}

/** GET /api/resources/alerts — unresolved alerts from DB */
export async function getAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerts = await prisma.alert.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: alerts } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/resources/alerts/:id/resolve */
export async function resolveAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alert = await prisma.alert.update({
      where: { id: req.params.id },
      data: { resolved: true, resolvedAt: new Date() },
    });
    res.json({ success: true, data: alert, message: 'Alert resolved' } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}
