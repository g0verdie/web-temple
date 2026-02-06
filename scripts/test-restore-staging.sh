#!/bin/bash
set -e

# Configuration
TEST_DB_CONTAINER="temple_restore_test"
TEST_DB_NAME="web_temple_test"
TEST_DB_USER="postgres"
TEST_DB_PASS="postgres"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/temple}"

echo "Starting Restore Test..."

# 1. Start ephemeral Postgres container
echo "Starting temporary database container..."
docker run -d --name "$TEST_DB_CONTAINER" -e POSTGRES_PASSWORD="$TEST_DB_PASS" -e POSTGRES_DB="$TEST_DB_NAME" postgres:15-alpine

# Wait for DB to be ready
echo "Waiting for database to initialize..."
sleep 10

try_restore() {
    # 2. Get latest backup (Simulated or Real)
    # For this script to work in dev without S3, we might need to use a local backup if available
    # But strictly following the story, we should fetch from S3.
    # Added fallback to local backups for testing without S3 creds
    
    LATEST_BACKUP=""
    if [ -n "$S3_BACKUP_BUCKET" ]; then
        echo "Checking S3 for latest backup..."
        LATEST_BACKUP=$(aws s3 ls "s3://$S3_BACKUP_BUCKET/" --recursive | sort | tail -1 | awk '{print $NF}')
        if [ -n "$LATEST_BACKUP" ]; then
            echo "Downloading $LATEST_BACKUP..."
            aws s3 cp "s3://$S3_BACKUP_BUCKET/$(basename $LATEST_BACKUP)" ./latest_restore.sql.enc
        fi
    fi

    if [ ! -f ./latest_restore.sql.enc ]; then
        echo "No S3 backup found. Looking for local backup..."
        LATEST_LOCAL=$(ls -t "$BACKUP_DIR"/db_backup_*.sql.enc 2>/dev/null | head -1)
        if [ -n "$LATEST_LOCAL" ]; then
             cp "$LATEST_LOCAL" ./latest_restore.sql.enc
             echo "Using local backup: $LATEST_LOCAL"
        else
             echo "❌ No backup file found to test."
             return 1
        fi
    fi

    # 3. Decrypt
    echo "Decrypting backup..."
    openssl enc -d -aes-256-cbc -pbkdf2 -in ./latest_restore.sql.enc -out ./latest_restore.sql -pass env:BACKUP_ENCRYPTION_KEY

    # 4. Restore to Test DB
    echo "Restoring data to test container..."
    cat ./latest_restore.sql | docker exec -i "$TEST_DB_CONTAINER" psql -U "$TEST_DB_USER" "$TEST_DB_NAME" > /dev/null

    # 5. Verify Data
    echo "Verifying data integrity..."
    USER_COUNT=$(docker exec -i "$TEST_DB_CONTAINER" psql -U "$TEST_DB_USER" "$TEST_DB_NAME" -t -c "SELECT COUNT(*) FROM users;")
    echo "Users found: $USER_COUNT"

    if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" -eq 0 ]; then
        echo "❌ Verification Failed: No users found."
        return 1
    fi
    
    echo "✅ Restore Test Passed!"
}

# Run test block with cleanup trap
trap 'echo "Cleaning up..."; docker rm -f "$TEST_DB_CONTAINER"; rm -f ./latest_restore.sql ./latest_restore.sql.enc' EXIT

try_restore
