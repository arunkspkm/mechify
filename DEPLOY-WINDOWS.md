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

## Step 2: Configure Environment

Create a file called `.env` in the `C:\mechify` folder with this content:

```env
DB_PASSWORD=YourStrongPassword123
NEXTAUTH_SECRET=YourRandomSecretKeyHere_MakeItLong
NEXTAUTH_URL=http://localhost:3000
```

**Important:** Change `DB_PASSWORD` and `NEXTAUTH_SECRET` to your own secure values.

To generate a random secret, open PowerShell and run:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

---

## Step 3: Build & Start

Open **Command Prompt** or **PowerShell** in the `C:\mechify` folder:

```cmd
cd C:\mechify
docker compose up -d --build
```

This will:
- Download PostgreSQL 16
- Build the Mechify application
- Start both containers
- First build takes 3-5 minutes

Check if running:
```cmd
docker compose ps
```

You should see two containers: `mechify-db-1` (healthy) and `mechify-app-1` (running).

---

## Step 4: Run Database Migrations

```cmd
docker compose exec app npx prisma migrate deploy
```

---

## Step 5: Seed Default Data

```cmd
docker compose exec app npx prisma db seed
```

This creates:
- Default admin user: **admin** / **admin123** (change password immediately!)
- Default master data (units, categories, payment methods, etc.)

---

## Step 6: Access the App

Open your browser and go to:

```
http://localhost:3000
```

Login with:
- Username: `admin`
- Password: `admin123`

**First things to do after login:**
1. Go to **Settings** → Set your shop name, address, phone
2. Go to **Users** → Change the admin password
3. Go to **Users** → Create a counter operator account

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

## Daily Operations

### Start Mechify (after PC restart)
Docker Desktop starts automatically with Windows. If not:
1. Open Docker Desktop
2. Wait for it to start
3. Mechify containers auto-start (configured with `restart: always`)

If containers didn't start:
```cmd
cd C:\mechify
docker compose up -d
```

### Stop Mechify
```cmd
cd C:\mechify
docker compose down
```

### View Logs
```cmd
docker compose logs -f app
```

Press `Ctrl+C` to stop viewing logs.

---

## Backup & Restore

### Manual Backup
```cmd
docker compose exec app sh scripts/backup.sh
```

Backups are stored in a Docker volume. To copy to your desktop:
```cmd
docker compose exec app ls /app/backups
docker compose cp app:/app/backups/mechify_backup_YYYYMMDD_HHMMSS.sql.gz C:\Users\YourName\Desktop\
```

### Automated Daily Backup
Add a Windows Task Scheduler task:
1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Name: `Mechify Daily Backup`
4. Trigger: Daily, at 10:00 PM
5. Action: Start a program
6. Program: `docker`
7. Arguments: `compose -f C:\mechify\docker-compose.yml exec -T app sh scripts/backup.sh`
8. Start in: `C:\mechify`

### Restore from Backup
```cmd
docker compose cp C:\path\to\mechify_backup_YYYYMMDD_HHMMSS.sql.gz app:/app/backups/

docker compose exec app sh -c "gunzip -c /app/backups/mechify_backup_YYYYMMDD_HHMMSS.sql.gz | psql postgresql://mechify:YourStrongPassword123@db:5432/mechify"
```

---

## Updating Mechify

When you get new code updates:

```cmd
cd C:\mechify
git pull                          # if using git
docker compose down
docker compose up -d --build      # rebuild with new code
docker compose exec app npx prisma migrate deploy   # apply new migrations
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
docker compose up -d
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
docker compose logs db
```
Check if PostgreSQL started correctly. Try restarting:
```cmd
docker compose restart db
docker compose restart app
```

### "Slow performance"
- In Docker Desktop → Settings → Resources, allocate:
  - Memory: 4 GB minimum
  - CPUs: 2 minimum
- Ensure WSL 2 backend is enabled (faster than Hyper-V)

### Reset Everything (DANGER: deletes all data)
```cmd
cd C:\mechify
docker compose down -v
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

---

## Hardware Recommendations

For a shop billing counter running Mechify:
- **Processor:** Any modern Intel i3/i5 or AMD Ryzen 3/5
- **RAM:** 8 GB minimum (4 GB for Windows + 4 GB for Docker)
- **Storage:** SSD recommended (faster database)
- **Network:** Connected to LAN (wired preferred over WiFi)
- **UPS:** Recommended to prevent data loss during power cuts
