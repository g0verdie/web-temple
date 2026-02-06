# Operational Runbook

## 1. Backup & Restore Procedures

### 1.1 Automated Backups
- **Schedule:** Runs daily at 2:00 AM EST via cron with `CRON_TZ=America/New_York` (configured by `scripts/setup-cron.sh`).
- **Location:** AWS S3 Bucket (defined in `S3_BACKUP_BUCKET`).
- **Retention:**
    - Local: 30 days of encrypted backups.
    - Cloud: 30 daily backups under `backups/daily/` and 12 monthly backups under `backups/monthly/` (see `docs/S3_LIFECYCLE.json`).
- **Monitoring:**
    - Admin Dashboard: `/admin`
    - API Endpoint: `GET /api/admin/backups/status`
    - Logs: `/var/log/temple/backups.log`

### 1.2 Manual Backup
To trigger an immediate backup:
```bash
/opt/temple/scripts/backup.sh
```

### 1.3 Restore Procedure
**WARNING:** Restore overwrites the current database. Ensure you have a fresh backup before proceeding.

**A. Restore Testing (Staging/Dry-Run)**
Use the automated test script to verify restore integrity without affecting production:
```bash
./scripts/test-restore-staging.sh
```

**B. Production Restore**
1.  **Download Backup:**
    ```bash
    aws s3 cp s3://temple-backups/backups/daily/db_backup_YYYYMMDD_HHMMSS.sql.enc .
    ```

2.  **Decrypt Backup:**
    ```bash
    openssl enc -d -aes-256-cbc -pbkdf2 -in temple_YYYYMMDD_HHMMSS.sql.enc -out db_restore.sql -pass env:BACKUP_ENCRYPTION_KEY
    ```

3.  **Restore Database:**
    ```bash
    # Stop application
    docker-compose stop app
    
    # Restore
    cat db_restore.sql | docker-compose exec -T db psql -U postgres web_temple
    
    # Restart
    docker-compose start app
    ```

### 1.4 Failure Recovery
If automated backups fail (alert received):
1.  Check `logs/backups.log` for error details.
2.  Common issues:
    - **S3 Upload Failed:** Check AWS credentials and internet connectivity.
    - **Encryption Failed:** Check `BACKUP_ENCRYPTION_KEY`.
    - **Disk Space:** Ensure server has enough space for dump file.
