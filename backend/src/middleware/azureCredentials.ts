import { Request, Response, NextFunction } from 'express';
import { AzureCredentials, AzureClients, createAzureClients } from '../config/azure';

declare global {
  namespace Express {
    interface Request {
      azureCredentials: AzureCredentials;
      azureClients: AzureClients;
    }
  }
}

export function azureCredentialsMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const normalize = (value?: string): string | undefined => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const subscriptionId =
    normalize(req.headers['x-azure-subscription-id'] as string | undefined) ??
    normalize(process.env.AZURE_SUBSCRIPTION_ID) ??
    '';

  const tenantId =
    normalize(req.headers['x-azure-tenant-id'] as string | undefined) ??
    normalize(process.env.AZURE_TENANT_ID) ??
    '';

  const clientId =
    normalize(req.headers['x-azure-client-id'] as string | undefined) ??
    normalize(process.env.AZURE_CLIENT_ID) ??
    '';

  const clientSecret =
    normalize(req.headers['x-azure-client-secret'] as string | undefined) ??
    normalize(process.env.AZURE_CLIENT_SECRET) ??
    '';

  const creds: AzureCredentials = { subscriptionId, tenantId, clientId, clientSecret };
  req.azureCredentials = creds;
  req.azureClients = createAzureClients(creds);
  next();
}
