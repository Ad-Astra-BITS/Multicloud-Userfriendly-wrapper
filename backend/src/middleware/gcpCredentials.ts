import { Request, Response, NextFunction } from 'express';
import { GcpCredentials, GcpClients, createGcpClients } from '../config/gcp';

declare global {
  namespace Express {
    interface Request {
      gcpCredentials: GcpCredentials;
      gcpClients: GcpClients;
    }
  }
}

export function gcpCredentialsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const normalize = (value?: string): string | undefined => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const projectId =
    normalize(req.headers['x-gcp-project-id'] as string | undefined) ??
    normalize(process.env.GCP_PROJECT_ID) ??
    '';

  let clientEmail: string | undefined;
  let privateKey: string | undefined;

  const credsHeader = normalize(req.headers['x-gcp-credentials'] as string | undefined);
  if (credsHeader) {
    try {
      const decoded = Buffer.from(credsHeader, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as { client_email?: string; private_key?: string };
      clientEmail = parsed.client_email;
      privateKey = parsed.private_key;
    } catch {
      // Invalid credentials header — fall through to env vars
    }
  }

  if (!clientEmail) clientEmail = normalize(process.env.GCP_CLIENT_EMAIL);
  if (!privateKey) privateKey = normalize(process.env.GCP_PRIVATE_KEY)?.replace(/\\n/g, '\n');

  const creds: GcpCredentials = { projectId, clientEmail, privateKey };
  req.gcpCredentials = creds;
  req.gcpClients = createGcpClients(creds);
  next();
}
