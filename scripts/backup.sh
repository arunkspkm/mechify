#!/bin/bash
# Mechify automated PostgreSQL backup script
# Called by Docker cron or manually via the backup API

set -e

BACKUP_DIR="${BACKUP_DIR:-/app/backups}"
DB_URL="${DATABASE_URL:-postgresql://mechify:mechify_secret@db:5432/mechify}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/mechify_backup_${TIMESTAMP}.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)"

# Run pg_dump and compress
pg_dump "$DB_URL" | gzip > "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Clean up old backups
echo "Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "mechify_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed at $(date)"
