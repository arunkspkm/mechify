#!/bin/bash
# Mechify database restore script
# Usage: ./scripts/restore.sh <backup_file.sql.gz>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo "Available backups:"
  ls -la ${BACKUP_DIR:-/app/backups}/mechify_backup_*.sql.gz 2>/dev/null || echo "No backups found"
  exit 1
fi

BACKUP_FILE="$1"
DB_URL="${DATABASE_URL:-postgresql://mechify:mechify_secret@db:5432/mechify}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will replace ALL data in the database with the backup."
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "Restoring from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | psql "$DB_URL"

echo "Restore completed at $(date)"
