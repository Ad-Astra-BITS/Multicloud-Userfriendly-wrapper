import { Request, Response, NextFunction } from 'express';
import { createGoogleCloudService, GcpApiError } from '../services/gcpResourceService';
import { ApiResponse } from '../types';

export async function validateGcpCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.headers['x-gcp-project-id'] as string | undefined;
    if (!projectId) { res.status(400).json({ success: false, error: 'Missing required header: x-gcp-project-id' } satisfies ApiResponse); return; }
    const service = createGoogleCloudService(req.gcpCredentials);
    await service.getInstances();
    res.json({ success: true, data: { projectId }, message: `Successfully connected to GCP project (${projectId})` } satisfies ApiResponse);
  } catch (err) { handleGcpError(err, res, next); }
}

export async function listInstances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { const service = createGoogleCloudService(req.gcpCredentials); res.json({ success: true, data: await service.getInstances() } satisfies ApiResponse); }
  catch (err) { handleGcpError(err, res, next); }
}

export async function stopInstance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zone = req.params.zone as string;
    const name = req.params.name as string;
    const service = createGoogleCloudService(req.gcpCredentials);
    await service.stopInstance(zone, name);
    res.json({ success: true, message: `Instance '${name}' in zone '${zone}' stopped.` } satisfies ApiResponse);
  } catch (err) { handleGcpError(err, res, next); }
}

export async function startInstance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const zone = req.params.zone as string;
    const name = req.params.name as string;
    const service = createGoogleCloudService(req.gcpCredentials);
    await service.startInstance(zone, name);
    res.json({ success: true, message: `Instance '${name}' in zone '${zone}' started.` } satisfies ApiResponse);
  } catch (err) { handleGcpError(err, res, next); }
}

export async function deleteInstances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { instances } = req.body as { instances?: unknown };
    if (!Array.isArray(instances) || instances.length === 0) { res.status(400).json({ success: false, error: 'instances must be a non-empty array of { zone, name }' } satisfies ApiResponse); return; }
    for (const inst of instances) { if (!inst?.zone || !inst?.name) { res.status(400).json({ success: false, error: 'Each entry must have zone and name' } satisfies ApiResponse); return; } }
    const service = createGoogleCloudService(req.gcpCredentials);
    await service.deleteInstances(instances);
    res.json({ success: true, message: `${instances.length} instance(s) deleted.` } satisfies ApiResponse);
  } catch (err) { handleGcpError(err, res, next); }
}

export async function listBuckets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await createGoogleCloudService(req.gcpCredentials).getBuckets() } satisfies ApiResponse); }
  catch (err) { handleGcpError(err, res, next); }
}

export async function deleteBucket(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const name = String(req.params.name);
    await createGoogleCloudService(req.gcpCredentials).deleteBucket(name);
    res.json({ success: true, message: `Bucket '${name}' emptied and deleted.` } satisfies ApiResponse);
  } catch (err) { handleGcpError(err, res, next); }
}

export async function listSqlInstances(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await createGoogleCloudService(req.gcpCredentials).getSqlInstances() } satisfies ApiResponse); }
  catch (err) { handleGcpError(err, res, next); }
}

export async function billingEstimate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { res.json({ success: true, data: await createGoogleCloudService(req.gcpCredentials).getBillingEstimate() } satisfies ApiResponse); }
  catch (err) { handleGcpError(err, res, next); }
}

function handleGcpError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof GcpApiError) { res.status(err.status >= 400 && err.status < 600 ? err.status : 500).json({ success: false, error: err.message } satisfies ApiResponse); return; }
  next(err);
}
