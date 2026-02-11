#!/bin/bash
set -e
set -o pipefail

# Load .env configuration
if [ -f "/opt/temple/.env" ]; then
    export $(grep -v '^#' /opt/temple/.env | xargs)
elif [ -f "$(dirname "$0")/../.env" ]; then
    export $(grep -v '^#' "$(dirname "$0")/../.env" | xargs)
fi

# Export PGPASSWORD for pg_dump authentication
export PGPASSWORD="${DB_PASSWORD}"

# Configuration - Absolute paths for cron
BACKUP_DIR="${BACKUP_DIR:-/var/backups/temple}"

# Determine log location
if [ -w "/var/log" ]; then
    DEFAULT_LOG_FILE="/var/log/temple/backups.log"
else
    # Fallback to local logs directory for non-root execution
    DEFAULT_LOG_FILE="./logs/backups.log"
fi
LOG_FILE="${LOG_FILE:-$DEFAULT_LOG_FILE}"

BACKUP_DB="${BACKUP_DB:-${DB_NAME:-web_temple}}"
BACKUP_USER="${BACKUP_USER:-${DB_USER:-temple_user}}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
ENCRYPTED_FILE="$BACKUP_FILE.enc"
RETENTION_DAYS=30
S3_DAILY_PREFIX="${S3_DAILY_PREFIX:-backups/daily}"
S3_MONTHLY_PREFIX="${S3_MONTHLY_PREFIX:-backups/monthly}"

# Logging Configuration
mkdir -p "$(dirname "$LOG_FILE")"

log_event() {
    local status=$1
    local message=$2
    local size=${3:-0}
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Log to JSON file
    echo "{\"timestamp\": \"$timestamp\", \"status\": \"$status\", \"message\": \"$message\", \"size_bytes\": $size}" >> "$LOG_FILE"
    
    # Also print to stdout
    echo "[$timestamp] [$status] $message"
}

handle_error() {
    local message=$1
    log_event "ERROR" "$message"
    echo "Triggering alert..."
    # Call alert script (if it exists)
    if [ -f "./scripts/alert_backup.js" ]; then
        node ./scripts/alert_backup.js "$LOG_FILE" "$message"
    elif [ -f "/opt/temple/scripts/alert_backup.js" ]; then
         node /opt/temple/scripts/alert_backup.js "$LOG_FILE" "$message"
    fi
    exit 1
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Check for encryption key
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
    handle_error "BACKUP_ENCRYPTION_KEY environment variable is not set."
fi

# Check for S3 Bucket
if [ -z "$S3_BACKUP_BUCKET" ]; then
    handle_error "S3_BACKUP_BUCKET environment variable is not set."
fi
S3_BUCKET="$S3_BACKUP_BUCKET"
S3_REGION="${S3_REGION:-us-east-1}"

log_event "START" "Starting backup process for $BACKUP_DB"

# 1. Create Encrypted Database Dump
# Pipe pg_dump directly to openssl to avoid intermediate plaintext file
echo "Creating and encrypting PostgreSQL dump for database: $BACKUP_DB..."

FILE_SIZE=0
if pg_dump -U "$BACKUP_USER" -h "${DB_HOST:-localhost}" "$BACKUP_DB" | openssl enc -aes-256-cbc -salt -pbkdf2 -out "$ENCRYPTED_FILE" -pass env:BACKUP_ENCRYPTION_KEY; then
    FILE_SIZE=$(stat -c%s "$ENCRYPTED_FILE" 2>/dev/null || stat -f%z "$ENCRYPTED_FILE")
    log_event "INFO" "Encrypted backup created successfully: $ENCRYPTED_FILE" "$FILE_SIZE"
    
    # Create symlink for latest metadata access
    ln -sf "$ENCRYPTED_FILE" "$BACKUP_DIR/latest.sql.enc"
else
    # Ensure no partial file remains
    [ -f "$ENCRYPTED_FILE" ] && rm "$ENCRYPTED_FILE"
    handle_error "Backup pipeline failed (pg_dump | openssl)"
fi

# 3. Cloud Upload to S3
echo "Uploading to AWS S3..."

if aws s3 cp "$ENCRYPTED_FILE" "s3://$S3_BUCKET/$S3_DAILY_PREFIX/$(basename $ENCRYPTED_FILE)" \
    --region "$S3_REGION" \
    --sse AES256 \
    --metadata "backup-date=$(date -u +%Y-%m-%d),backup-type=full"; then
    log_event "INFO" "Upload successful: s3://$S3_BUCKET/$S3_DAILY_PREFIX/$(basename $ENCRYPTED_FILE)"
else
    handle_error "S3 upload failed"
fi

# 3b. Monthly Retention Copy (first day of month, UTC)
if [ "$(date -u +%d)" = "01" ]; then
    echo "Creating monthly retention copy..."
    if aws s3 cp "$ENCRYPTED_FILE" "s3://$S3_BUCKET/$S3_MONTHLY_PREFIX/$(basename $ENCRYPTED_FILE)" \
        --region "$S3_REGION" \
        --sse AES256 \
        --metadata "backup-date=$(date -u +%Y-%m-%d),backup-type=monthly"; then
        log_event "INFO" "Monthly upload successful: s3://$S3_BUCKET/$S3_MONTHLY_PREFIX/$(basename $ENCRYPTED_FILE)"
    else
        handle_error "Monthly S3 upload failed"
    fi
fi

# 4. Cleanup Old Backups
echo "Cleaning up local backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "db_backup_*.sql.enc" -type f -mtime +$RETENTION_DAYS -delete

log_event "SUCCESS" "Backup process completed successfully" "$FILE_SIZE"
exit 0
