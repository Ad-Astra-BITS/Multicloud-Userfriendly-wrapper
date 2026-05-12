import { Request, Response, NextFunction } from 'express';
import {
  createDigitalOceanService,
  DigitalOceanApiError,
} from '../services/digitalOceanResourceService';
import { createDoApiClient } from '../config/digitalocean';
import { ApiResponse } from '../types';

export async function validateDoCredentials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.headers['x-do-api-token'] as string | undefined;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Missing required header: x-do-api-token',
      } satisfies ApiResponse);
      return;
    }

    const client = createDoApiClient(token);
    const accountRes = await client.get<{
      account: {
        email: string;
        uuid: string;
        status: string;
        droplet_limit: number;
        floating_ip_limit: number;
        email_verified: boolean;
      };
    }>('/account');

    const account = accountRes.data.account;

    res.json({
      success: true,
      data: {
        email: account.email,
        uuid: account.uuid,
        status: account.status,
        dropletLimit: account.droplet_limit,
        emailVerified: account.email_verified,
      },
      message: `Successfully connected to DigitalOcean account (${account.email})`,
    } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Droplets  (≈ EC2)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/do/droplets — List all Droplets in the account */
export async function listDroplets(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createDigitalOceanService(req.doCredentials);
    const data = await service.getDroplets();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

/**
 * GET /api/do/droplets/:id/metrics
 * Returns live CPU and memory utilisation for the specified Droplet.
 */
export async function dropletMetrics(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({
        success: false,
        error: 'Invalid droplet ID — must be a numeric value',
      } satisfies ApiResponse);
      return;
    }

    const service = createDigitalOceanService(req.doCredentials);
    const data = await service.getDropletMetrics(id);
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

export async function terminateDroplets(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { dropletIds } = req.body as { dropletIds?: unknown };

    if (!Array.isArray(dropletIds) || dropletIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'dropletIds must be a non-empty array of numeric Droplet IDs',
      } satisfies ApiResponse);
      return;
    }

    if (dropletIds.some((id) => typeof id !== 'number' || !Number.isInteger(id))) {
      res.status(400).json({
        success: false,
        error: 'All entries in dropletIds must be integers',
      } satisfies ApiResponse);
      return;
    }

    const service = createDigitalOceanService(req.doCredentials);
    await service.terminateDroplets(dropletIds as number[]);

    res.json({
      success: true,
      message: `${dropletIds.length} Droplet(s) permanently terminated.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}


export async function listSpaces(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createDigitalOceanService(req.doCredentials);
    const data = await service.getSpaces();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}


export async function optimizeSpace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const region = String(req.params.region);
    const name = String(req.params.name);
    const { expiryDays } = req.body as { expiryDays?: unknown };

    if (expiryDays !== undefined) {
      if (typeof expiryDays !== 'number' || !Number.isInteger(expiryDays) || expiryDays < 1) {
        res.status(400).json({
          success: false,
          error: 'expiryDays must be a positive integer',
        } satisfies ApiResponse);
        return;
      }
    }

    const service = createDigitalOceanService(req.doCredentials);
    await service.optimizeSpace(region, name, expiryDays as number | undefined);

    res.json({
      success: true,
      message:
        `Lifecycle expiry rule applied to Space '${name}' in region '${region}'. ` +
        `Objects older than ${expiryDays ?? 90} days will be automatically deleted.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

export async function deleteSpace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const region = String(req.params.region);
    const name = String(req.params.name);
    const service = createDigitalOceanService(req.doCredentials);
    await service.deleteSpace(region, name);

    res.json({
      success: true,
      message: `Space '${name}' in region '${region}' has been emptied and deleted.`,
    } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

export async function listDatabases(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createDigitalOceanService(req.doCredentials);
    const data = await service.getDatabases();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

export async function stopDatabase(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params.id);
    // Require an explicit boolean true — reject truthy strings to prevent accidents
    const confirmDestroy = req.body?.confirmDestroy === true;

    const service = createDigitalOceanService(req.doCredentials);
    const data = await service.stopDatabase(id, confirmDestroy);

    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

export async function billingHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const service = createDigitalOceanService(req.doCredentials);
    const data = await service.getBillingHistory();
    res.json({ success: true, data } satisfies ApiResponse);
  } catch (err) {
    handleDoError(err, res, next);
  }
}

function handleDoError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof DigitalOceanApiError) {
    // Clamp status to valid HTTP range; DO errors outside 4xx-5xx fall back to 500
    const httpStatus = err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(httpStatus).json({
      success: false,
      error: err.message,
    } satisfies ApiResponse);
    return;
  }
  next(err);
}
