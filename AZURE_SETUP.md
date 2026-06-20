# Azure Integration Setup Guide

This guide explains how to properly configure your Microsoft Azure account to connect with the Ad Astra Multicloud Dashboard.

Ad Astra uses an **Azure Service Principal** (App Registration) to securely authenticate and manage your resources without requiring personal login credentials.

---

## Required Credentials
To connect Azure to Ad Astra, you will need four pieces of information:
1. **Subscription ID**: Identifies your Azure billing and resource container.
2. **Tenant (Directory) ID**: Identifies your Azure Active Directory instance.
3. **Application (Client) ID**: Identifies the Service Principal Ad Astra uses.
4. **Client Secret**: The password for the Service Principal.

---

## Method 1: Using the Azure Portal (Web UI)

### Step 1: Create an App Registration
1. Go to the [Azure Portal](https://portal.azure.com/).
2. Search for and select **Microsoft Entra ID** (formerly Azure Active Directory).
3. In the left menu, select **App registrations**, then click **+ New registration**.
4. Name the application (e.g., `AdAstra-Integration`).
5. Under Supported account types, select "Accounts in this organizational directory only (Default Directory only - Single tenant)".
6. Click **Register**.
7. **Copy** the **Application (client) ID** and **Directory (tenant) ID** displayed on the overview page. You will need these for the Ad Astra dashboard.

### Step 2: Create a Client Secret
1. While still on your App Registration page, select **Certificates & secrets** from the left menu.
2. Under "Client secrets", click **+ New client secret**.
3. Add a description (e.g., `ad-astra-secret`) and choose an expiration period (e.g., 12 months).
4. Click **Add**.
5. **CRITICAL**: Immediately copy the **Value** column (not the Secret ID). This is your **Client Secret**. It will be hidden forever once you leave the page.

### Step 3: Find your Subscription ID
1. Search for and select **Subscriptions** in the top search bar of the Azure Portal.
2. Click on the subscription you want Ad Astra to manage.
3. **Copy** the **Subscription ID** displayed on the overview page.

### Step 4: Assign RBAC Permissions (Crucial Step)
Without Role-Based Access Control (RBAC) permissions, Ad Astra will connect but will be forbidden (Error 403) from viewing or managing any resources.

1. Still on your **Subscription** overview page, select **Access control (IAM)** from the left menu.
2. Click **+ Add** -> **Add role assignment**.
3. Under the "Job function roles" tab, search for and select:
   - **Reader**: If you only want Ad Astra to view your resources (read-only mode).
   - **Contributor**: If you want Ad Astra to be able to start/stop VMs and delete resources.
4. Click **Next**.
5. Ensure "Assign access to" is set to **User, group, or service principal**.
6. Click **+ Select members**.
7. Search for the name of the App Registration you created in Step 1 (e.g., `AdAstra-Integration`). Select it.
8. Click **Review + assign**, and then click it again to confirm.
*(Note: It may take 1-5 minutes for Azure to fully propagate the new role assignment).*

---

## Method 2: Using the Azure CLI (Fastest)

If you have the `az` command line tool installed, you can configure everything in seconds.

**1. Login to Azure:**
```bash
az login
```

**2. Select your subscription:**
```bash
# List your subscriptions
az account list --output table

# Set the active subscription
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
```

**3. Create the Service Principal with the Contributor role:**
```bash
az ad sp create-for-rbac --name "AdAstra-Integration" \
                         --role Contributor \
                         --scopes /subscriptions/<YOUR_SUBSCRIPTION_ID>
```

**Output Example:**
```json
{
  "appId": "a4d9f3b7-...",        // This is your Application (Client) ID
  "displayName": "AdAstra-Integration",
  "password": "-Ge8Q~...",       // This is your Client Secret
  "tenant": "0091df81-..."       // This is your Tenant (Directory) ID
}
```
*Save these output values to use in the Ad Astra dashboard.*

---

## Connecting in Ad Astra

1. Open the Ad Astra dashboard (`http://localhost:3800`).
2. In the left sidebar, locate the **Microsoft Azure** section and click **Connect Azure**.
3. Enter the **Subscription ID**, **Tenant ID**, **Client ID**, and **Client Secret**.
4. Click **Connect**.
5. Once connected, your Azure VMs, Storage Accounts, and SQL Databases will populate in the sidebar.

## Troubleshooting

- **Error 403 AuthorizationFailed:** Your credentials are valid, but the Service Principal has not been assigned the proper RBAC role on the subscription. Follow **Step 4** above.
- **Error 401 AuthenticationFailed:** The Tenant ID, Client ID, or Client Secret is incorrect. Ensure you pasted the Client Secret **Value**, not the Secret ID.
- **VMs are not showing up immediately:** Azure Role Assignments can take up to 5-10 minutes to take effect. Wait a few minutes and hit the Refresh button in the dashboard.
