#!/bin/bash

# Configuration
BACKUP_SCRIPT_PATH="/opt/temple/scripts/backup.sh"
LOG_FILE="/var/log/temple/backup-cron.log"
CRON_TZ_VALUE="America/New_York"
CRON_SCHEDULE="0 2 * * * cd /opt/temple && ./scripts/backup.sh >> $LOG_FILE 2>&1"

# Check if cron job exists
if crontab -l 2>/dev/null | grep -q "backup.sh"; then
    echo "✅ Backup cron job already installed."
else
    echo "Adding backup cron job..."
    # Append CRON_TZ and schedule to the end without modifying existing lines
    (crontab -l 2>/dev/null; echo "CRON_TZ=$CRON_TZ_VALUE"; echo "$CRON_SCHEDULE") | crontab -
    echo "✅ Backup cron job installed (2:00 AM daily)."
fi

# Verify
echo "Current crontab:"
crontab -l | grep backup.sh
