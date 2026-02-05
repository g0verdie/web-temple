#!/bin/bash
set -e

# Configuration
BACKUP_DIR="./backups"
BACKUP_DB="${BACKUP_DB:-web-temple}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
ENCRYPTED_FILE="$BACKUP_FILE.enc"
RETENTION_DAYS=30

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check for encryption key
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
    echo "ERROR: BACKUP_ENCRYPTION_KEY environment variable is not set."
    exit 1
fi

echo "Detailed log: Starting backup process at $(date)"

# 1. Create Encrypted Database Dump
# Pipe pg_dump directly to openssl to avoid intermediate plaintext file
echo "Creating and encrypting PostgreSQL dump for database: $BACKUP_DB..."

if pg_dump -U postgres "$BACKUP_DB" | openssl enc -aes-256-cbc -salt -pbkdf2 -out "$ENCRYPTED_FILE" -pass env:BACKUP_ENCRYPTION_KEY; then
    echo "Encrypted backup created successfully: $ENCRYPTED_FILE"
else
    echo "ERROR: Backup pipeline failed"
    # Ensure no partial file remains
    [ -f "$ENCRYPTED_FILE" ] && rm "$ENCRYPTED_FILE"
    exit 1
fi

# 3. Cloud Upload to S3
echo "Uploading to AWS S3..."
S3_BUCKET="${S3_BACKUP_BUCKET:-temple-backups}"
S3_REGION="${S3_REGION:-us-east-1}"

if aws s3 cp "$ENCRYPTED_FILE" "s3://$S3_BUCKET/$(basename $ENCRYPTED_FILE)" \
    --region "$S3_REGION" \
    --sse AES256 \
    --metadata "backup-date=$(date -u +%Y-%m-%d),backup-type=full"; then
    echo "Upload successful: s3://$S3_BUCKET/$(basename $ENCRYPTED_FILE)"
else
    echo "ERROR: S3 upload failed"
    exit 1
fi

# 4. Cleanup Old Backups
echo "Cleaning up local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.enc" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup process completed successfully at $(date)"
exit 0
