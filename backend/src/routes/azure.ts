import { Router } from 'express';
import { azureCredentialsMiddleware } from '../middleware/azureCredentials';
import {
  validateAzureCredentials,
  listVMs,
  deallocateVM,
  startVM,
  deleteVMs,
  listStorageAccounts,
  deleteStorageAccount,
  listSqlDatabases,
  billingInfo,
} from '../controllers/azureController';

const router = Router();

router.use(azureCredentialsMiddleware);
router.post('/validate', validateAzureCredentials);

// Virtual Machines
router.get('/vms', listVMs);
router.post('/vms/:resourceGroup/:name/deallocate', deallocateVM);
router.post('/vms/:resourceGroup/:name/start', startVM);
router.post('/vms/delete', deleteVMs);

// Storage Accounts
router.get('/storage', listStorageAccounts);
router.delete('/storage/:resourceGroup/:name', deleteStorageAccount);

// SQL Databases
router.get('/sql', listSqlDatabases);

// Billing
router.get('/billing', billingInfo);

export default router;
