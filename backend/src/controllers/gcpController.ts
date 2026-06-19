import { Request, Response, NextFunction } from 'express';
import {
  createGoogleCloudService,
  GcpApiError,
} from '../services/gcpResourceService';
import { createGcpClients } from '../config/gcp';
import { ApiResponse } from '../types';

/**
 * POST /api/gcp/validate
 * Validates GCP credentials by attempting to list instances (lightweight call).
 */
export async function validateGcpCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const projectId = req.headers['x-gcp-project-id'] as string | undefined;
    if (!projectId) {
      res.status(400).json({
        success: false,
        error: 'Missing required header: x-gcp-project-id',
      } satisfies ApiResponse);
      return;
    }

    // Try to create clients and make a minimal API call to validate
    const service = createGoogleCloudService(req.gcpCredentials);
    // Fetching instances is a lightweight way to validate credentials + project
    await service.getInstances();

    res.json({
      success: true,
      data: {
        projectId,
      },
      message: `Successfully connected to GCP project (${projectId})`,
    } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Compute Engine Instances
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/gcp/instances — List all Compute Engine VMs */
export async function listInstances(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createGoogleCloudService(req.gcpCredentials);
    const data = await service.getInstances();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

/** POST /api/gcp/instances/:zone/:name/stop — Stop a running instance */
export async function stopInstance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const zone = String(req.params.zone);
    const name = String(req.params.name);

    const service = createGoogleCloudService(req.gcpCredentials);
    await service.stopInstance(zone, name);

    res.json({
      success: true,
      message: `Instance '${name}' in zone '${zone}' has been stopped.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

/** POST /api/gcp/instances/:zone/:name/start — Start a stopped instance */
export async function startInstance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const zone = String(req.params.zone);
    const name = String(req.params.name);

    const service = createGoogleCloudService(req.gcpCredentials);
    await service.startInstance(zone, name);

    res.json({
      success: true,
      message: `Instance '${name}' in zone '${zone}' has been started.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

/** POST /api/gcp/instances/delete — Delete instances */
export async function deleteInstances(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { instances } = req.body as { instances?: unknown };

    if (!Array.isArray(instances) || instances.length === 0) {
      res.status(400).json({
        success: false,
        error: 'instances must be a non-empty array of { zone, name } objects',
      } satisfies ApiResponse);
      return;
    }

    for (const inst of instances) {
      if (!inst || typeof inst.zone !== 'string' || typeof inst.name !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Each entry in instances must have string zone and name fields',
        } satisfies ApiResponse);
        return;
      }
    }

    const service = createGoogleCloudService(req.gcpCredentials);
    await service.deleteInstances(instances as Array<{ zone: string; name: string }>);

    res.json({
      success: true,
      message: `${instances.length} instance(s) permanently deleted.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cloud Storage Buckets
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/gcp/buckets — List all Cloud Storage buckets */
export async function listBuckets(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createGoogleCloudService(req.gcpCredentials);
    const data = await service.getBuckets();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

/** DELETE /api/gcp/buckets/:name — Delete a Cloud Storage bucket */
export async function deleteBucket(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const name = String(req.params.name);
    const service = createGoogleCloudService(req.gcpCredentials);
    await service.deleteBucket(name);

    res.json({
      success: true,
      message: `Bucket '${name}' has been emptied and deleted.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Cloud SQL Instances
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/gcp/sql — List all Cloud SQL instances */
export async function listSqlInstances(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createGoogleCloudService(req.gcpCredentials);
    const data = await service.getSqlInstances();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Billing
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/gcp/billing — Get billing estimate */
export async function billingEstimate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createGoogleCloudService(req.gcpCredentials);
    const data = await service.getBillingEstimate();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleGcpError(err, res, next);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Error handler
// ═══════════════════════════════════════════════════════════════════════════════

function handleGcpError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof GcpApiError) {
    const httpStatus = err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(httpStatus).json({
      success: false,
      error: err.message,
    } satisfies ApiResponse);
    return;
  }
  next(err);
}
