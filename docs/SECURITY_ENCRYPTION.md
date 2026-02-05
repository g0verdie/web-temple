# Security & Encryption Strategy

This document outlines the comprehensive security strategy for the Temple Web Platform, covering encryption at rest, in transit, authentication, and audit logging.

## Table of Contents

1. [Database Encryption at Rest](#1-database-encryption-at-rest-volume-level)
2. [Backup Encryption](#2-backup-encryption)
3. [Application-Level Encryption](#3-application-level-encryption)
4. [Authentication Security](#4-authentication-security)
5. [Audit Logging](#5-audit-logging)
6. [Key Management](#6-key-management)
7. [PostgreSQL Security Hardening](#7-postgresql-security-hardening)
8. [Disaster Recovery](#8-disaster-recovery)
9. [Key Rotation Procedure](#9-key-rotation-procedure)

---

## 1. Database Encryption at Rest (Volume Level)

Since we are self-hosting on Linux, we utilize **LUKS (Linux Unified Key Setup)** to encrypt the disk volume where PostgreSQL stores its data. This ensures that if the physical drive or server is compromised, the raw data remains inaccessible without the passphrase.

### Implementation Checklist

- [ ] Identify partition for database storage (e.g., `/dev/sdb1`)
- [ ] Backup any existing data
- [ ] Format partition with LUKS encryption
- [ ] Mount encrypted volume to `/var/lib/postgresql`
- [ ] Verify PostgreSQL data directory is on encrypted volume
- [ ] Test reboot with encrypted volume mounting
- [ ] Document LUKS UUID and configuration
- [ ] Store LUKS passphrase in secure vault (1Password/LastPass)

### Step-by-Step Setup

1.  **Prepare the Partition:**
    ```bash
    lsblk  # List block devices to identify partition
    # Example: /dev/sdb1 (new partition for database)
    ```

2.  **Format with LUKS:**
    ```bash
    sudo cryptsetup luksFormat /dev/sdb1
    # You will be prompted to set a strong passphrase. Store this securely in vault!
    ```

3.  **Open the Encrypted Volume:**
    ```bash
    sudo cryptsetup luksOpen /dev/sdb1 postgres_data
    ```

4.  **Create Filesystem:**
    ```bash
    sudo mkfs.ext4 /dev/mapper/postgres_data
    ```

5.  **Mount the Volume:**
    ```bash
    sudo mkdir -p /var/lib/postgresql
    sudo mount /dev/mapper/postgres_data /var/lib/postgresql
    sudo chown -R postgres:postgres /var/lib/postgresql
    sudo chmod 700 /var/lib/postgresql
    ```

6.  **Persistence (Reboot):**
    
    **Option A: Manual passphrase on boot** (More secure, requires manual intervention)
    ```bash
    # /etc/crypttab
    postgres_data /dev/sdb1 none luks
    
    # /etc/fstab
    /dev/mapper/postgres_data /var/lib/postgresql ext4 defaults,nofail 0 2
    ```

    **Option B: Automated unlock with keyfile** (Less secure, for production servers)
    ```bash
    # Generate keyfile
    sudo dd if=/dev/urandom of=/root/.luks-key bs=1024 count=4
    sudo chmod 400 /root/.luks-key
    
    # Add key to LUKS
    sudo cryptsetup luksAddKey /dev/sdb1 /root/.luks-key
    
    # /etc/crypttab
    postgres_data /dev/sdb1 /root/.luks-key luks
    ```

7.  **Verify Encryption Status:**
    ```bash
    # Verify LUKS encryption is active
    sudo cryptsetup luksDump /dev/sdb1
    # Look for: Key Slot 0: ENABLED
    
    # Verify mount
    mount | grep postgres_data
    # Should show: /dev/mapper/postgres_data on /var/lib/postgresql
    
    # Verify permissions
    ls -la /var/lib/postgresql
    # Should be: drwx------  postgres postgres
    ```

---

## 2. Backup Encryption

Automated daily backups are encrypted with AES-256 and uploaded to AWS S3 with server-side encryption.

### Backup Configuration

```bash
# Environment variables for backup.sh
export BACKUP_ENCRYPTION_KEY="<32+ character random key>"
export S3_BACKUP_BUCKET="temple-backups"
export S3_REGION="us-east-1"
export BACKUP_DB="web-temple"
```

### Encryption Process

- **Method:** AES-256-CBC with PBKDF2 key derivation
- **Key Management:** `BACKUP_ENCRYPTION_KEY` environment variable
- **Format:** `backup-YYYYMMDD_HHMMSS.sql.enc`
- **Retention:** 30 daily + 12 monthly backups

### Decrypting a Backup

```bash
# Decrypt and restore
openssl enc -d -aes-256-cbc -pbkdf2 \
    -in backup-20260205_020000.sql.enc \
    -out restore.sql \
    -pass pass:$(cat /etc/temple-backup-key.txt)

# Verify file is valid SQL
head -20 restore.sql

# Restore to database
sudo -u postgres psql -d web-temple < restore.sql
```

---

## 3. Application-Level Encryption

### Passwords (Bcrypt Hashing)

All user passwords are hashed using **Bcrypt** with salt rounds of 10:

```javascript
// src/utils/authHelper.js
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

const hashPassword = async (password) => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

const comparePassword = async (password, hash) => {
    return bcrypt.compare(password, hash);
};
```

Implementation in auth service:

```javascript
// src/services/authService.js - User Registration
const hashPassword = async (password) => {
    const password_hash = await bcrypt.hash(password, 10);
    await db.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2)',
        [email, password_hash]
    );
};

// User Login
const match = await bcrypt.compare(loginPassword, storedHash);
if (!match) throw new Error('Invalid credentials');
```

### Donation Data Encryption (AES-256-CBC)

High-sensitivity fields are encrypted at the application level before storage:

```javascript
// src/utils/encryptionHelper.js
const { encrypt, decrypt } = require('../utils/encryptionHelper');

// Encrypt sensitive fields before insert
const encrypted_amount = encrypt(donationAmount.toString());
const encrypted_email = encrypt(donorEmail);

await db.query(
    'INSERT INTO donations (encrypted_amount_cents, encrypted_donor_email) VALUES ($1, $2)',
    [encrypted_amount, encrypted_email]
);

// Decrypt when retrieving
const donation = await db.query(
    'SELECT encrypted_amount_cents FROM donations WHERE id = $1',
    [donationId]
);
const amount = parseInt(decrypt(donation.rows[0].encrypted_amount_cents));
```

**Encryption Details:**
- Algorithm: AES-256-CBC
- Key: SHA-256 hash of `ENCRYPTION_KEY` environment variable
- IV: Random 16-byte initialization vector per encryption
- Storage: `base64(IV:ciphertext)`

---

## 4. Authentication Security

### Password Policy (NFR-S3)

- **Minimum length:** 12 characters
- **Complexity:** Mix of uppercase, lowercase, numbers, symbols
- **History:** Passwords cannot be reused from last 5 changes
- **No expiry:** But forced reset on security incidents

### Session Management

- **Member sessions:** 30 days of inactivity timeout
- **Admin sessions:** 30 minutes of inactivity timeout (enhanced security)
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Strict` flags

### Implementation

```javascript
// src/services/authService.js
const registerUser = async (userData) => {
    // Validate password strength
    if (userData.password.length < 12) {
        throw new Error('Password must be at least 12 characters');
    }
    
    const password_hash = await hashPassword(userData.password);
    await db.query(
        'INSERT INTO users (..., password_hash) VALUES (...)',
        [password_hash]
    );
    
    // Log audit event
    await logAudit({
        user_id: newUser.id,
        action: AUDIT_ACTIONS.USER_REGISTERED,
        ip_address: req.ip,
    });
};
```

---

## 5. Audit Logging

### Audit Log Table

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    description TEXT,
    before_state JSONB,           -- Previous state for updates
    after_state JSONB,            -- New state
    ip_address INET,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Append-only enforcement
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_insert_only ON audit_logs
    FOR INSERT WITH CHECK (true);
```

### Logged Events (NFR-S8)

All sensitive actions are logged:

- **Authentication:** User registration, login, logout, password changes
- **Announcements:** Created, edited, deleted, featured
- **Calendar:** Events created, edited, deleted
- **Donations:** Received, failed, refunded, tax receipts sent
- **Messages:** Received, replied, deleted
- **Admin:** Login, logout, role changes, settings modified

### Implementation

```javascript
// src/utils/auditHelper.js
const { logAudit, AUDIT_ACTIONS } = require('../utils/auditHelper');

// Log user registration
await logAudit({
    user_id: newUser.id,
    action: AUDIT_ACTIONS.USER_REGISTERED,
    entity_type: 'user',
    entity_id: newUser.id,
    description: `User registered: ${email}`,
    ip_address: req.ip,
});

// Query audit logs
const logs = await queryAuditLogs({
    action: 'DONATION_RECEIVED',
    since: '2026-02-01',
    limit: 100,
});
```

---

## 6. Key Management

### Key Storage Strategy

| Key | Storage | Access | Rotation |
|-----|---------|--------|----------|
| LUKS Passphrase | 1Password/LastPass Vault | SysAdmin only | Annually |
| Backup Encryption Key | `/etc/temple-backup-key.txt` (root) | Root, backup cron | Annually |
| Application Encryption Key | Environment variable | App runtime only | On incident |

### Implementation

```bash
# Generate secure keys
BACKUP_KEY=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Store backup key
echo "$BACKUP_KEY" | sudo tee /etc/temple-backup-key.txt > /dev/null
sudo chmod 400 /etc/temple-backup-key.txt

# Store in vault (1Password/LastPass)
# - Label: "Temple Backup Encryption Key"
# - Content: $BACKUP_KEY
# - Access: SysAdmin only

# Store app encryption key in environment
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" | sudo tee -a /etc/environment > /dev/null
```

### Access Control

- **SysAdmin Role:** Can access all keys (LUKS, Backup, Application)
- **Application Runtime:** Runs with access to `ENCRYPTION_KEY` only
- **Developers:** Do NOT have production keys in code repo

---

## 7. PostgreSQL Security Hardening

### User & Permission Management

```bash
# Create restricted PostgreSQL user
sudo -u postgres psql -c "CREATE USER app_user WITH ENCRYPTED PASSWORD 'strong_password';"

# Grant minimal permissions
sudo -u postgres psql -c "GRANT CONNECT ON DATABASE web-temple TO app_user;"
sudo -u postgres psql -c "GRANT USAGE ON SCHEMA public TO app_user;"
sudo -u postgres psql -c "GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;"

# Prevent privilege escalation
sudo -u postgres psql -c "ALTER ROLE app_user NOCREATEDB NOCREATEROLE;"
```

### Connection Security

```bash
# /etc/postgresql/14/main/postgresql.conf
listen_addresses = 'localhost'              # Only local connections
password_encryption = scram-sha-256         # Modern auth
ssl = on                                    # Require SSL
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
```

### Access Control Policy

```bash
# /etc/postgresql/14/main/pg_hba.conf
local   all             all                                     md5
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               reject        # Reject external
```

---

## 8. Disaster Recovery

### Recovery Objectives

- **RTO:** < 1 hour to restore full database
- **RPO:** < 1 day of data loss

### Step-by-Step Recovery

```bash
# 1. Retrieve backup from S3
aws s3 cp s3://temple-backups/db_backup_20260205_020000.sql.enc .

# 2. Decrypt backup
BACKUP_KEY=$(cat /etc/temple-backup-key.txt)
openssl enc -d -aes-256-cbc -pbkdf2 \
    -in db_backup_20260205_020000.sql.enc \
    -out restore.sql \
    -pass pass:$BACKUP_KEY

# 3. Verify backup integrity
head -20 restore.sql
psql -f restore.sql < /dev/null | head  # Syntax check

# 4. Stop application
sudo systemctl stop temple-app

# 5. Backup current database (just in case)
sudo -u postgres pg_dump web-temple > current_backup.sql

# 6. Restore database
sudo -u postgres psql -d web-temple < restore.sql

# 7. Verify restoration
sudo -u postgres psql -d web-temple -c "SELECT COUNT(*) FROM users;"

# 8. Restart application
sudo systemctl start temple-app

# 9. Verify application health
curl https://localhost:3000/api/health
```

### Testing Recovery

- **Frequency:** Monthly
- **Environment:** Staging or test server
- **Procedure:** Follow exact recovery steps
- **Verification:** Verify data completeness and integrity

---

## 9. Key Rotation Procedure

### Backup Encryption Key Rotation

**Frequency:** Annually or after security incident

```bash
# 1. Generate new key
NEW_BACKUP_KEY=$(openssl rand -base64 32)
echo "Generated new key. Store in vault immediately."

# 2. Re-encrypt all existing backups
OLD_KEY=$(cat /etc/temple-backup-key.txt)

for backup in backups/*.sql.enc; do
    # Decrypt with old key
    openssl enc -d -aes-256-cbc -pbkdf2 -in "$backup" \
        -out "$backup.tmp" -pass pass:$OLD_KEY
    
    # Re-encrypt with new key
    openssl enc -aes-256-cbc -pbkdf2 -in "$backup.tmp" \
        -out "$backup.new" -pass pass:$NEW_BACKUP_KEY
    
    # Replace
    mv "$backup.new" "$backup"
    rm "$backup.tmp"
done

# 3. Verify re-encrypted backups
openssl enc -d -aes-256-cbc -pbkdf2 -in backups/db_backup_latest.sql.enc \
    -pass pass:$NEW_BACKUP_KEY | head

# 4. Update system key file
echo "$NEW_BACKUP_KEY" | sudo tee /etc/temple-backup-key.txt > /dev/null
sudo chmod 400 /etc/temple-backup-key.txt

# 5. Update environment
echo "BACKUP_ENCRYPTION_KEY=$NEW_BACKUP_KEY" | sudo tee -a /etc/environment > /dev/null

# 6. Store old key in vault with note: "Retired: 2026-02-05"

# 7. Restart backup services
sudo systemctl restart cron
```

### Application Encryption Key Rotation

**Warning:** Complex operation requiring downtime

```bash
# 1. Generate new key
NEW_APP_KEY=$(openssl rand -base64 32)

# 2. Create re-encryption script
# - Decrypt all fields with old key
# - Re-encrypt with new key
# - Update in database

# 3. Test on staging first

# 4. Schedule maintenance window

# 5. Execute on production:
# - Update ENCRYPTION_KEY environment variable
# - Run re-encryption script
# - Verify all data decrypts correctly

# 6. Restart application
sudo systemctl restart temple-app
```

---

## Security Checklist

- [ ] LUKS volume encryption enabled for PostgreSQL
- [ ] Backup encryption key stored securely
- [ ] Application encryption key in environment (not in code)
- [ ] LUKS passphrase in vault
- [ ] PostgreSQL user permissions restricted
- [ ] PostgreSQL SSL/TLS enabled
- [ ] Bcrypt password hashing integrated in auth
- [ ] Audit logging enabled for all sensitive actions
- [ ] Monthly backup restoration testing scheduled
- [ ] Annual key rotation schedule established

---

## Contact & Support

- **SysAdmin:** For LUKS, PostgreSQL, backup infrastructure questions
- **Developer:** For application encryption, Bcrypt, audit logging
- **Security Team:** For key management, incident response, compliance
