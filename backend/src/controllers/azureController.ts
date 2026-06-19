import { Request, Response, NextFunction } from 'express';
import { ClientSecretCredential } from '@azure/identity';
import axios from 'axios';
import { createAzureService, AzureApiError } from '../services/azureResourceService';
import { ApiResponse } from '../types';

/**
 * POST /api/azure/validate
 * Validates Azure credentials by:
 *   1. Obtaining an access token via ClientSecretCredential (verifies auth)
 *   2. Calling the ARM subscription GET endpoint (verifies subscription access)
 */
export async function validateAzureCredentials(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subscriptionId = req.headers['x-azure-subscription-id'] as string | undefined;
    const tenantId = req.headers['x-azure-tenant-id'] as string | undefined;
    const clientId = req.headers['x-azure-client-id'] as string | undefined;
    const clientSecret = req.headers['x-azure-client-secret'] as string | undefined;

    if (!subscriptionId) {
      res.status(400).json({ success: false, error: 'Missing required header: x-azure-subscription-id' } satisfies ApiResponse);
      return;
    }
    if (!tenantId || !clientId || !clientSecret) {
      res.status(400).json({ success: false, error: 'Missing required Azure credentials (tenant ID, client ID, or client secret).' } satisfies ApiResponse);
      return;
    }

    // Step 1: Verify credentials by obtaining an access token
    // If this fails, the credentials are invalid (bad tenant/client/secret).
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    await credential.getToken('https://management.azure.com/.default');

    // Step 2 (best-effort): Fetch subscription display name via ARM REST API
    let displayName = subscriptionId;
    let warning: string | undefined;

    try {
      const tokenResponse = await credential.getToken('https://management.azure.com/.default');
      const armResponse = await axios.get(
        `https://management.azure.com/subscriptions/${subscriptionId}?api-version=2022-12-01`,
        {
          headers: { Authorization: `Bearer ${tokenResponse.token}` },
          timeout: 10_000,
        },
      );
      displayName = armResponse.data?.displayName ?? subscriptionId;
    } catch (armErr: unknown) {
      const axiosErr = armErr as { response?: { status?: number; data?: { error?: { code?: string } } } };
      const status = axiosErr.response?.status;
      const code = axiosErr.response?.data?.error?.code;

      if (status === 404 || code === 'SubscriptionNotFound') {
        res.status(404).json({
          success: false,
          error: 'Subscription not found. The credentials are valid but the Subscription ID does not exist or the service principal does not have access. Verify the Subscription ID.',
        } satisfies ApiResponse);
        return;
      }

      if (status === 403 || code === 'AuthorizationFailed') {
        // Credentials work but SP lacks RBAC on the subscription — still connect!
        warning = 'Connected, but the service principal lacks RBAC roles on this subscription. Assign at least "Reader" in Azure Portal → Subscriptions → Access control (IAM) for full functionality.';
      }
      // For other errors, continue with subscription ID as display name
    }

    res.json({
      success: true,
      data: { subscriptionId, displayName },
      message: warning
        ? `Azure credentials verified. ${warning}`
        : `Successfully connected to Azure subscription "${displayName}" (${subscriptionId})`,
    } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Virtual Machines
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/azure/vms — List all VMs */
export async function listVMs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = createAzureService(req.azureCredentials);
    res.json({ success: true, data: await service.getVirtualMachines() } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

/** POST /api/azure/vms/:resourceGroup/:name/deallocate — Deallocate a VM */
export async function deallocateVM(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resourceGroup = req.params.resourceGroup as string;
    const name = req.params.name as string;
    const service = createAzureService(req.azureCredentials);
    await service.deallocateVM(resourceGroup, name);
    res.json({ success: true, message: `VM '${name}' in resource group '${resourceGroup}' deallocated.` } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

/** POST /api/azure/vms/:resourceGroup/:name/start — Start a deallocated VM */
export async function startVM(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resourceGroup = req.params.resourceGroup as string;
    const name = req.params.name as string;
    const service = createAzureService(req.azureCredentials);
    await service.startVM(resourceGroup, name);
    res.json({ success: true, message: `VM '${name}' in resource group '${resourceGroup}' started.` } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

/** POST /api/azure/vms/delete — Delete VMs */
export async function deleteVMs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { vms } = req.body as { vms?: unknown };
    if (!Array.isArray(vms) || vms.length === 0) {
      res.status(400).json({ success: false, error: 'vms must be a non-empty array of { resourceGroup, name }' } satisfies ApiResponse);
      return;
    }
    for (const vm of vms) {
      if (!vm?.resourceGroup || !vm?.name) {
        res.status(400).json({ success: false, error: 'Each entry must have resourceGroup and name' } satisfies ApiResponse);
        return;
      }
    }
    const service = createAzureService(req.azureCredentials);
    await service.deleteVMs(vms);
    res.json({ success: true, message: `${vms.length} VM(s) permanently deleted.` } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Storage Accounts
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/azure/storage — List all Storage Accounts */
export async function listStorageAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = createAzureService(req.azureCredentials);
    res.json({ success: true, data: await service.getStorageAccounts() } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

/** DELETE /api/azure/storage/:resourceGroup/:name — Delete a Storage Account */
export async function deleteStorageAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resourceGroup = req.params.resourceGroup as string;
    const name = req.params.name as string;
    const service = createAzureService(req.azureCredentials);
    await service.deleteStorageAccount(resourceGroup, name);
    res.json({ success: true, message: `Storage account '${name}' deleted.` } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SQL Databases
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/azure/sql — List all SQL Databases */
export async function listSqlDatabases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = createAzureService(req.azureCredentials);
    res.json({ success: true, data: await service.getSqlDatabases() } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Billing
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /api/azure/billing — Get billing estimate */
export async function billingInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const service = createAzureService(req.azureCredentials);
    res.json({ success: true, data: await service.getBillingInfo() } satisfies ApiResponse);
  } catch (err) { handleAzureError(err, res, next); }
}

// ═══════════════════════════════════════════════════════════════════════════════

function handleAzureError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof AzureApiError) {
    const httpStatus = err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(httpStatus).json({ success: false, error: err.message } satisfies ApiResponse);
    return;
  }

  // Handle Azure Identity SDK errors (e.g. bad credentials, expired secret)
  const error = err as { name?: string; message?: string; statusCode?: number; code?: string };
  const name = error.name ?? '';
  const message = error.message ?? 'Unknown Azure error';
  const code = error.code ?? '';

  // Authentication errors (invalid client ID, secret, or tenant)
  if (
    name === 'CredentialUnavailableError' ||
    name === 'AuthenticationError' ||
    code === 'InvalidAuthenticationTokenTenant' ||
    code === 'unauthorized_client' ||
    code === 'invalid_client' ||
    message.includes('AADSTS7000215') ||  // client secret expired
    message.includes('AADSTS700016') ||  // app not found in tenant
    message.includes('AADSTS90002')      // tenant not found
  ) {
    let userMessage = 'Authentication failed. ';
    if (message.includes('AADSTS7000215')) {
      userMessage += 'The client secret has expired. Please create a new one in Azure Portal → App Registrations → Certificates & secrets.';
    } else if (message.includes('AADSTS700016')) {
      userMessage += 'The Application (Client) ID was not found in this tenant. Verify the Client ID and Tenant ID are correct.';
    } else if (message.includes('AADSTS90002')) {
      userMessage += 'The Tenant (Directory) ID was not found. Verify the Tenant ID is correct.';
    } else if (message.includes('invalid_client') || message.includes('unauthorized_client')) {
      userMessage += 'The Client ID or Client Secret is invalid. Double-check your credentials.';
    } else {
      userMessage += 'Verify your Tenant ID, Client ID, and Client Secret are correct.';
    }
    res.status(401).json({ success: false, error: userMessage } satisfies ApiResponse);
    return;
  }

  // Authorization errors (valid creds but no RBAC role)
  if (code === 'AuthorizationFailed' || error.statusCode === 403) {
    res.status(403).json({
      success: false,
      error: 'Authorization failed. The service principal authenticated successfully but lacks permissions. Assign at least the "Reader" role on the subscription in Azure Portal → Subscriptions → Access control (IAM).',
    } satisfies ApiResponse);
    return;
  }

  // Subscription not found
  if (code === 'SubscriptionNotFound' || error.statusCode === 404 || message.includes('SubscriptionNotFound')) {
    res.status(404).json({
      success: false,
      error: 'Subscription not found. Verify the Subscription ID is correct and the service principal has access to it.',
    } satisfies ApiResponse);
    return;
  }

  next(err);
}
