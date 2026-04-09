# Mechify — Windows 10 Deployment Guide

## Prerequisites

1. **Docker Desktop for Windows**
   - Download from: https://www.docker.com/products/docker-desktop/
   - During installation, enable **WSL 2** backend (recommended)
   - After install, open Docker Desktop and wait for it to fully start (green icon in system tray)

2. **Git for Windows** (optional, for cloning)
   - Download from: https://git-scm.com/download/win

---

## Step 1: Get the Code

**Option A — Git clone:**
```cmd
cd C:\
git clone <your-repo-url> mechify
cd mechify
```

**Option B — Copy folder:**
- Copy the entire `mechify-v2` folder to `C:\mechify`

---

## Step 2: Create Data Directory

Create a folder to store all Mechify data (database, uploads, backups):

```cmd
mkdir C:\mechify-data
mkdir C:\mechify-data\postgres
mkdir C:\mechify-data\uploads
mkdir C:\mechify-data\backups
```

This folder contains all your business data. Back it up regularly.

---

## Step 3: Configure Environment

Create a file called `.env` in the `C:\mechify` folder with this content:

```env
DB_PASSWORD=YourStrongPassword123
NEXTAUTH_SECRET=YourRandomSecretKeyHere_MakeItLong
NEXTAUTH_URL=http://localhost:3000
DATA_PATH=C:/mechify-data
```

> **Note:** Use forward slashes `/` in `DATA_PATH` even on Windows — Docker requires this format.

**Important:** Change `DB_PASSWORD` and `NEXTAUTH_SECRET` to your own secure values.

To generate a random secret, open PowerShell and run:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

---

## Step 4: Build & Start

Open **Command Prompt** or **PowerShell** in the `C:\mechify` folder:

```cmd
cd C:\mechify
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
- Download PostgreSQL 16
- Build the Mechify application
- Start both containers
- First build takes 3-5 minutes

Check if running:
```cmd
docker compose -f docker-compose.prod.yml ps
```

You should see two containers: `mechify-db-1` (healthy) and `mechify-app-1` (running).

---

## Step 5: Run Database Migrations

```cmd
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

---

## Step 6: Seed Default Data

```cmd
docker compose -f docker-compose.prod.yml exec app npx prisma db seed
```

This creates:
- Default admin user: **admin** / **admin123** (change password immediately!)
- Default master data (units, categories, payment methods, etc.)

---

## Step 7: Access the App

Open your browser and go to:

```
http://localhost:3000
```

Login with:
- Username: `admin`
- Password: `admin123`

**First things to do after login:**
1. Go to **Settings** → Set your shop name, address, phone, GST number
2. Go to **Users** → Change the admin password
3. Go to **Users** → Create a counter operator account
4. Go to **Master Data** → Review/add categories, brands, units
5. Go to **Products** → Import existing inventory from Excel

---

## Accessing from Other Computers on LAN

Find your Windows PC's IP address:
```cmd
ipconfig
```

Look for `IPv4 Address` (e.g., `192.168.1.100`).

Other computers on the same network can access:
```
http://192.168.1.100:3000
```

**Tip:** Set a static IP on the Windows machine so the address doesn't change.

---

## Data Storage

All data is stored in `C:\mechify-data` (or the path you set in `DATA_PATH`):

```
C:\mechify-data\
  ├── postgres\    # PostgreSQL database files
  ├── uploads\     # Product images
  └── backups\     # SQL backup files (.sql.gz)
```

You can browse, copy, or move this folder directly from Windows Explorer.

---

## Daily Operations

### Start Mechify (after PC restart)
Docker Desktop starts automatically with Windows. If not:
1. Open Docker Desktop
2. Wait for it to start
3. Mechify containers auto-start (configured with `restart: always`)

If containers didn't start:
```cmd
cd C:\mechify
docker compose -f docker-compose.prod.yml up -d
```

### Stop Mechify
```cmd
cd C:\mechify
docker compose -f docker-compose.prod.yml down
```

### View Logs
```cmd
docker compose -f docker-compose.prod.yml logs -f app
```

Press `Ctrl+C` to stop viewing logs.

---

## Backup & Restore

### Option 1: In-App Backup (Recommended — safe while running)

Run the backup script inside the container:
```cmd
docker compose -f docker-compose.prod.yml exec app sh scripts/backup.sh
```

Backups are saved to `C:\mechify-data\backups\`. Each backup is a compressed SQL file like `mechify_backup_20260407_220000.sql.gz`.

### Option 2: Copy Data Folder (Full backup — stop first)

For a complete backup including images:
```cmd
:: Stop containers first to avoid database corruption
docker compose -f docker-compose.prod.yml down

:: Copy entire data folder
xcopy C:\mechify-data D:\backup\mechify-data /E /I /H

:: Start again
docker compose -f docker-compose.prod.yml up -d
```

### Option 3: Copy Just the Backups Folder

If you only need the database backup (not images):
```cmd
xcopy C:\mechify-data\backups D:\backup\mechify-backups /E /I
```

### Automated Daily Backup

Set up Windows Task Scheduler:
1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Name: `Mechify Daily Backup`
4. Trigger: Daily, at 10:00 PM
5. Action: Start a program
6. Program: `docker`
7. Arguments: `compose -f C:\mechify\docker-compose.prod.yml exec -T app sh scripts/backup.sh`
8. Start in: `C:\mechify`

### Restore from Backup

**Restore SQL backup (in-app backup file):**
```cmd
docker compose -f docker-compose.prod.yml exec app sh -c "gunzip -c /app/backups/mechify_backup_YYYYMMDD_HHMMSS.sql.gz | psql postgresql://mechify:YourStrongPassword123@db:5432/mechify"
```

**Restore full data folder:**
```cmd
:: Stop containers
docker compose -f docker-compose.prod.yml down

:: Replace data folder
rmdir /S /Q C:\mechify-data
xcopy D:\backup\mechify-data C:\mechify-data /E /I /H

:: Start containers
docker compose -f docker-compose.prod.yml up -d
```

---

## Updating Mechify

When you get new code updates:

```cmd
cd C:\mechify
git pull                          # if using git

:: Rebuild and restart (data is preserved — it's in C:\mechify-data)
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build

:: Apply new database migrations
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

---

## Troubleshooting

### "Docker is not running"
- Open Docker Desktop and wait for it to fully start
- Check system tray for the Docker whale icon

### "Port 3000 already in use"
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
docker compose -f docker-compose.prod.yml up -d
```

### "Cannot connect from other computers"
1. Check Windows Firewall — allow port 3000:
   ```cmd
   netsh advfirewall firewall add rule name="Mechify" dir=in action=allow protocol=TCP localport=3000
   ```
2. Ensure both machines are on the same network
3. Try `http://<IP>:3000` (not `localhost`)

### "Database connection failed"
```cmd
docker compose -f docker-compose.prod.yml logs db
```
Check if PostgreSQL started correctly. Try restarting:
```cmd
docker compose -f docker-compose.prod.yml restart db
docker compose -f docker-compose.prod.yml restart app
```

### "Permission denied on data folder"
If Docker can't write to `C:\mechify-data`:
1. Right-click the folder → Properties → Security
2. Add `Everyone` with Full Control (or your Windows user)

### "Slow performance"
- In Docker Desktop → Settings → Resources, allocate:
  - Memory: 4 GB minimum
  - CPUs: 2 minimum
- Ensure WSL 2 backend is enabled (faster than Hyper-V)
- Use SSD for `C:\mechify-data` location

### Reset Everything (DANGER: deletes all data)
```cmd
cd C:\mechify
docker compose -f docker-compose.prod.yml down
rmdir /S /Q C:\mechify-data
mkdir C:\mechify-data\postgres
mkdir C:\mechify-data\uploads
mkdir C:\mechify-data\backups
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml exec app npx prisma db seed
```

---

## Moving to a New Computer

1. Stop Mechify on old computer:
   ```cmd
   docker compose -f docker-compose.prod.yml down
   ```

2. Copy two things to the new computer:
   - `C:\mechify` (application code)
   - `C:\mechify-data` (all your data)

3. Install Docker Desktop on new computer

4. Copy `.env` file to `C:\mechify\.env`

5. Start on new computer:
   ```cmd
   cd C:\mechify
   docker compose -f docker-compose.prod.yml up -d --build
   ```

All your data, invoices, products, and settings will be intact.

---

## Hardware Recommendations

For a shop billing counter running Mechify:
- **Processor:** Any modern Intel i3/i5 or AMD Ryzen 3/5
- **RAM:** 8 GB minimum (4 GB for Windows + 4 GB for Docker)
- **Storage:** SSD recommended (faster database)
- **Network:** Connected to LAN (wired preferred over WiFi)
- **UPS:** Recommended to prevent data loss during power cuts
