
import { Request, Response, NextFunction } from 'express';
import { DoCredentials, DOSpacesRegion } from '../config/digitalocean';

// ── Express Request type augmentation ─────────────────────────────────────────
// Merges with the existing Express.Request augmentation in awsCredentials.ts.
declare global {
  namespace Express {
    interface Request {
      doCredentials: DoCredentials;
    }
  }
}

export function digitalOceanCredentialsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const normalize = (value?: string): string | undefined => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const apiToken =
    normalize(req.headers['x-do-api-token'] as string | undefined) ??
    normalize(process.env.DO_API_TOKEN) ??
    '';

  // Spaces credentials are optional at the middleware level; services that need
  // them will throw a DigitalOceanApiError(401) with a clear message if absent.
  const spacesKey =
    normalize(req.headers['x-do-spaces-key'] as string | undefined) ??
    normalize(process.env.DO_SPACES_KEY);

  const spacesSecret =
    normalize(req.headers['x-do-spaces-secret'] as string | undefined) ??
    normalize(process.env.DO_SPACES_SECRET);

  const spacesRegion = (
    (req.headers['x-do-spaces-region'] as string | undefined) ??
    process.env.DO_SPACES_REGION ??
    'nyc3'
  ) as DOSpacesRegion;

  req.doCredentials = { apiToken, spacesKey, spacesSecret, spacesRegion };
  next();
}
