import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import { readdir, stat } from "fs/promises";
import path from "path";

const execAsync = promisify(exec);
const BACKUP_DIR = process.env.BACKUP_DIR ?? path.join(process.cwd(), "backups");

// GET /api/backup — List backups
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const files = await readdir(BACKUP_DIR).catch(() => [] as string[]);
    const backups = [];

    for (const file of files) {
      if (!file.endsWith(".sql.gz") && !file.endsWith(".sql")) continue;
      const filePath = path.join(BACKUP_DIR, file);
      const fileStat = await stat(filePath);
      backups.push({
        name: file,
        size: fileStat.size,
        sizeHuman: formatBytes(fileStat.size),
        createdAt: fileStat.mtime.toISOString(),
      });
    }

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ data: backups });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

// POST /api/backup — Trigger manual backup
export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    // Create backup directory
    await execAsync(`mkdir -p "${BACKUP_DIR}"`);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `mechify_backup_${timestamp}.sql.gz`;
    const filePath = path.join(BACKUP_DIR, filename);

    // Run pg_dump
    await execAsync(`pg_dump "${dbUrl}" | gzip > "${filePath}"`);

    const fileStat = await stat(filePath);

    return NextResponse.json({
      data: {
        name: filename,
        size: fileStat.size,
        sizeHuman: formatBytes(fileStat.size),
        createdAt: fileStat.mtime.toISOString(),
      },
      message: "Backup created successfully",
    }, { status: 201 });
  } catch (err) {
    console.error("Backup error:", err);
    const message = err instanceof Error ? err.message : "Backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
