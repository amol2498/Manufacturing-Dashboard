# Azure Deployment Guide — OTD Risk Dashboard

## Overview

| Component | Technology | Azure Resource |
|---|---|---|
| Frontend | React 18 + Vite | Azure Web App (Node.js 22 LTS) |
| Backend API | Python FastAPI + uvicorn | Azure Web App (Python 3.11) |
| Hosting Plan | Shared Linux B1 | App Service Plan |

**Live URLs:**
- Frontend: https://otd-dashboard-app.azurewebsites.net
- Backend API: https://otd-dashboard-api.azurewebsites.net

---

## Prerequisites

- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed
- Node.js + npm installed (for building the frontend)
- Python installed (for creating zip files)
- An active Azure subscription

---

## One-Time Setup (First Deployment)

### 1. Login to Azure

```bash
az login
```

Verify the correct subscription is active:

```bash
az account show
```

If you need to switch subscriptions:

```bash
az account set --subscription "<subscription-name-or-id>"
```

### 2. Create Azure Resources

```bash
# Resource Group
az group create --name otd-dashboard-rg --location westus2

# App Service Plan (Linux B1 ~$13/month)
az appservice plan create \
  --name otd-dashboard-plan \
  --resource-group otd-dashboard-rg \
  --sku B1 \
  --is-linux

# Backend Web App (Python 3.11)
az webapp create \
  --name otd-dashboard-api \
  --resource-group otd-dashboard-rg \
  --plan otd-dashboard-plan \
  --runtime "PYTHON:3.11"

# Frontend Web App (Node.js 22 LTS)
az webapp create \
  --name otd-dashboard-app \
  --resource-group otd-dashboard-rg \
  --plan otd-dashboard-plan \
  --runtime "NODE:22-lts"
```

### 3. Configure Backend

Set the startup command (uvicorn instead of default gunicorn):

```bash
az webapp config set \
  --name otd-dashboard-api \
  --resource-group otd-dashboard-rg \
  --startup-file "python -m uvicorn main:app --host 0.0.0.0 --port 8000"
```

Enable Oryx build so pip installs dependencies on each deploy:

```bash
az webapp config appsettings set \
  --name otd-dashboard-api \
  --resource-group otd-dashboard-rg \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true ENABLE_ORYX_BUILD=true
```

---

## Deploying the Backend

### Step 1 — Package the backend files

Use Python to create the zip (avoids Windows backslash path issues on Azure Linux):

```bash
python -c "
import zipfile, os
src = 'backend'
dest = 'backend-deploy.zip'
files = ['main.py', 'data.py', 'requirements.txt']
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in files:
        zf.write(os.path.join(src, f), f)
print('backend-deploy.zip created')
"
```

> **Important:** Do NOT use `Compress-Archive` (PowerShell) for the backend zip.
> It embeds Windows backslash paths which break Azure's Linux rsync.
> Always use the Python `zipfile` module.

### Step 2 — Deploy

```bash
az webapp deployment source config-zip \
  --name otd-dashboard-api \
  --resource-group otd-dashboard-rg \
  --src backend-deploy.zip
```

This command uses the Kudu deployment engine which:
1. Extracts the zip to `/home/site/wwwroot`
2. Runs `pip install -r requirements.txt` (Oryx build)
3. Starts the site with the uvicorn startup command

Expected output:
```
Status: Building the app...   (pip install running, ~90s)
Status: Build successful.
Status: Starting the site...  (~30-60s)
Status: Site started successfully.
```

### Step 3 — Verify

```bash
curl https://otd-dashboard-api.azurewebsites.net/api/filters
```

Expected: `{"supplier_names":[],"stages":[],...}` — empty lists are correct (no Excel file loaded yet).

---

## Deploying the Frontend

### Step 1 — Update the API URL (if backend URL changed)

In `frontend/src/api/client.js`, set `BASE_URL` to the backend URL:

```js
const BASE_URL = 'https://otd-dashboard-api.azurewebsites.net/api'
```

### Step 2 — Build the React app

```bash
cd frontend
npm install
npm run build
```

This creates the `frontend/dist/` folder with the production build.

### Step 3 — Package with Python (forward slashes required)

```bash
python -c "
import zipfile, os

base = 'frontend'
dest = 'frontend-deploy.zip'

with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zf:
    for fname in ['package.json', 'server.js']:
        zf.write(os.path.join(base, fname), fname)
    for root, dirs, files in os.walk(os.path.join(base, 'dist')):
        for file in files:
            abs_path = os.path.join(root, file)
            rel_path = os.path.relpath(abs_path, base).replace(os.sep, '/')
            zf.write(abs_path, rel_path)
print('frontend-deploy.zip created')
"
```

### Step 4 — Deploy

```bash
az webapp deploy \
  --name otd-dashboard-app \
  --resource-group otd-dashboard-rg \
  --src-path frontend-deploy.zip \
  --type zip
```

Expected output:
```
Status: Build successful.
Status: Starting the site...
Status: Site started successfully.
```

### Step 5 — Verify

```bash
curl -o /dev/null -w "%{http_code}" https://otd-dashboard-app.azurewebsites.net
```

Expected: `200`

---

## Redeployment (Subsequent Updates)

### Backend change
```bash
# 1. Recreate the zip
python -c "..."   # (same Python script as above)

# 2. Redeploy
az webapp deployment source config-zip \
  --name otd-dashboard-api \
  --resource-group otd-dashboard-rg \
  --src backend-deploy.zip
```

### Frontend change
```bash
# 1. Rebuild
cd frontend && npm run build

# 2. Recreate the zip
python -c "..."   # (same Python script as above)

# 3. Redeploy
az webapp deploy \
  --name otd-dashboard-app \
  --resource-group otd-dashboard-rg \
  --src-path frontend-deploy.zip \
  --type zip
```

---

## CORS Configuration

The backend allows requests from these origins (defined in `backend/main.py`):

```python
allow_origins=[
    "http://localhost:5173",         # local Vite dev server
    "http://localhost:3000",         # local alternative
    "https://otd-dashboard-app.azurewebsites.net",  # Azure frontend
]
```

If you rename the frontend app, add the new URL to this list and redeploy the backend.

---

## How the Frontend Serves Files on Azure

The frontend uses a custom Node.js static file server (`frontend/server.js`) that:
- Reads the `PORT` environment variable set by Azure
- Serves all files from the `dist/` folder
- Falls back to `dist/index.html` for any unknown route (SPA routing)

This server uses only Node.js built-in modules (`http`, `fs`, `path`) — no extra dependencies needed.

---

## Using the Deployed App

1. Open https://otd-dashboard-app.azurewebsites.net
2. The dashboard loads with empty data (no pre-loaded Excel file on Azure)
3. Use the **Upload** button to upload your Excel file (`.xlsx` or `.xls`)
4. All tabs, charts, pivot tables, and filters become active after upload
5. Data resets on app restart (in-memory storage) — re-upload is needed after each cold start

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Backend 503 on startup | uvicorn not installed | Ensure `SCM_DO_BUILD_DURING_DEPLOYMENT=true` is set; use `config-zip` deploy (not `az webapp deploy`) |
| Backend 500 on `/api/filters` | Excel columns missing on empty DataFrame | Already fixed in `data.py` with empty-state guard |
| Frontend rsync error during deploy | Windows backslash paths in zip | Use the Python `zipfile` script — never `Compress-Archive` |
| `NODE:20-lts` runtime not found | Runtime name changed | Use `az webapp list-runtimes --os-type linux` to find current names |
| B1 quota error in East US | Subscription quota limit | Use `--location westus2` or another region |
| `No module named uvicorn` after deploy | Oryx build not running | Set `ENABLE_ORYX_BUILD=true` + `SCM_DO_BUILD_DURING_DEPLOYMENT=true`, then use `config-zip` |

### View live logs

```bash
az webapp log tail --name otd-dashboard-api --resource-group otd-dashboard-rg
az webapp log tail --name otd-dashboard-app --resource-group otd-dashboard-rg
```

### Download full logs

```bash
az webapp log download --name otd-dashboard-api --resource-group otd-dashboard-rg --log-file backend-logs.zip
```

---

## Tearing Down Resources

To delete everything and stop billing:

```bash
az group delete --name otd-dashboard-rg --yes
```

This deletes the resource group, both web apps, and the App Service Plan.
