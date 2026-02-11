# Setup Guide - Temple B'nai Israel Website

**Last Updated:** February 10, 2026  
**Version:** 1.1  
**Target Time:** Deploy from scratch in <4 hours  
**Maintainer:** System Administrator

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Application Installation](#3-application-installation)
4. [Database Configuration](#4-database-configuration)
5. [SSL/TLS Certificate Setup](#5-ssltls-certificate-setup)
6. [PM2 Process Manager Setup](#6-pm2-process-manager-setup)
7. [Backup Configuration](#7-backup-configuration)
8. [Monitoring Setup](#8-monitoring-setup)
9. [Verification & Testing](#9-verification--testing)
10. [Post-Deployment Configuration](#10-post-deployment-configuration)

---

## 1. Prerequisites

### 1.1 System Requirements

**Hardware:**
- CPU: 2+ cores recommended (1 core minimum)
- RAM: 2GB minimum, 4GB+ recommended
- Disk: 20GB minimum, 50GB+ recommended
- Network: Stable internet connection (5G broadband or better)

**Software:**
- Operating System: Ubuntu 22.04 LTS (or compatible Linux distribution)
  - **Note:** This guide uses Ubuntu/Debian-specific commands (`apt`, `systemctl`). For RHEL/CentOS, translate commands to `yum`/`dnf` and adjust service management accordingly.
- Node.js: v18.0.0 or higher
- PostgreSQL: v14+ (or compatible database)
- Redis: v7+ (cache/queue)
- Nginx: Latest stable version (for reverse proxy)
- Git: v2.30+

**Required Access:**
- Root or sudo access to server
- Domain name with DNS management
- SSH key pair for secure access

### 1.2 External Services

Before starting setup, obtain credentials for:

1. **PayPal Business Account**
   - Client ID
   - Client Secret
   - Webhook configuration

2. **Facebook Developer Account**
   - App ID
   - Access Token for Page
   - Page ID for Live streaming

3. **Email Service** (SMTP)
   - SMTP server hostname
   - Port (usually 587 or 465)
   - Username/password
   - From email address

4. **AWS S3** (for backups, optional but recommended)
   - Access Key ID
   - Secret Access Key
   - Bucket name
   - Region

5. **Redis Server** (for caching and queue)
   - Plan for local installation OR
   - Remote Redis service credentials (host, port, password)

### 1.3 Pre-Installation Checklist

- ☐ Server provisioned and accessible via SSH
- ☐ Domain name registered and DNS accessible
- ☐ PayPal credentials obtained
- ☐ Facebook app configured
- ☐ Email service credentials ready
- ☐ S3 bucket created (if using backups)
- ☐ SSL certificate plan decided (Let's Encrypt recommended)

---

## 2. Initial Server Setup

**Estimated Time:** 30 minutes

### 2.1 Connect to Server

```bash
# Connect via SSH
ssh root@your-server-ip

# Update system packages
apt update && apt upgrade -y
```

### 2.2 Create Application User

```bash
# Create dedicated user for application
adduser temple
# Follow prompts to set password

# Add user to sudo group (optional, for admin tasks)
usermod -aG sudo temple

# Switch to new user
su - temple
```

### 2.3 Configure SSH Access

```bash
# On your local machine, generate SSH key (if not exists)
ssh-keygen -t ed25519 -C "temple-admin@example.com"

# Copy public key to server
ssh-copy-id temple@your-server-ip

# Test SSH key authentication
ssh temple@your-server-ip

# (Optional) Disable password authentication for security
sudo vi /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd
```

### 2.4 Configure Firewall

```bash
# Install ufw (Uncomplicated Firewall)
sudo apt install ufw

# Allow SSH (important - do this first!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify rules
sudo ufw status
```

### 2.5 Install System Dependencies

```bash
# Install build essentials
sudo apt install -y build-essential curl git wget

# Install Node.js v18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Install Redis
sudo apt install -y redis-server

# Start and enable Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis
redis-cli ping  # Expect: PONG
```

---

## 3. Application Installation

**Estimated Time:** 30 minutes

### 3.1 Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/temple
sudo chown temple:temple /opt/temple

# Navigate to directory
cd /opt/temple

# Clone repository (replace with actual repository URL)
git clone https://github.com/your-org/web-temple.git .

# Or if using existing code, upload via scp:
# On local machine:
# tar -czf web-temple.tar.gz /path/to/web-temple
# scp web-temple.tar.gz temple@your-server-ip:/opt/temple/
# On server:
# cd /opt/temple
# tar -xzf web-temple.tar.gz --strip-components=1
# rm web-temple.tar.gz
```

### 3.2 Install Application Dependencies

```bash
cd /opt/temple

# Install dependencies
npm install --production

# Verify installation succeeded
if [ $? -eq 0 ]; then
  echo "✅ Dependencies installed successfully"
else
  echo "❌ Dependency installation failed"
  exit 1
fi

# Create required directories
mkdir -p logs logs/archive
mkdir -p backups
mkdir -p public/uploads

# Set permissions
chmod 755 logs logs/archive backups public/uploads
```

### 3.3 Configure Environment Variables

```bash
cd /opt/temple

# Copy example environment file
cp .env.example .env

# Edit configuration
vi .env
```

**Required `.env` Configuration:**

```bash
# === Application Settings ===
NODE_ENV=production
PORT=3000

# === Database Configuration ===
DB_HOST=localhost
DB_PORT=5432
DB_NAME=web_temple
DB_USER=temple_user
DB_PASSWORD=STRONG_PASSWORD_HERE
# Use connection pooling
DB_POOL_MIN=2
DB_POOL_MAX=10

# === Session & Security ===
SESSION_SECRET=GENERATE_RANDOM_64_CHAR_STRING
COOKIE_SECRET=GENERATE_RANDOM_64_CHAR_STRING

# === Email Configuration ===
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@temple-domain.com
SMTP_PASSWORD=EMAIL_PASSWORD_HERE
EMAIL_FROM=Temple B'nai Israel <noreply@temple-domain.com>

# === PayPal Configuration ===
PAYPAL_MODE=live  # or 'sandbox' for testing
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID
PAYPAL_SECRET=YOUR_PAYPAL_SECRET

# === Facebook Configuration ===
FACEBOOK_APP_ID=YOUR_FACEBOOK_APP_ID
FACEBOOK_ACCESS_TOKEN=YOUR_PAGE_ACCESS_TOKEN
FACEBOOK_PAGE_ID=YOUR_FACEBOOK_PAGE_ID

# === AWS S3 Backup Configuration ===
S3_ENABLED=true
S3_BUCKET=temple-backups
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
S3_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY

# === Backup Encryption ===
BACKUP_ENCRYPTION_KEY=GENERATE_RANDOM_64_CHAR_STRING

# === Logging ===
LOG_LEVEL=info
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
LOG_ARCHIVE_DAYS=365d

# === Redis Cache/Queue ===
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# === Application URL ===
BASE_URL=https://temple-domain.com
```

**Generate Random Secrets:**
```bash
# Generate session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate cookie secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate backup encryption key (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Important:** Never commit `.env` to version control. Ensure `.gitignore` includes:
```
.env
.env.*
!.env.example
```

---

## 4. Database Configuration

**Estimated Time:** 30 minutes

### 4.1 Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
sudo systemctl status postgresql
```

### 4.2 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
```

```sql
-- Create database user
CREATE USER temple_user WITH PASSWORD 'STRONG_PASSWORD_HERE';

-- Create database
CREATE DATABASE web_temple OWNER temple_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE web_temple TO temple_user;

-- Exit PostgreSQL
\q
```

### 4.3 Configure PostgreSQL for Remote Access (if needed)

```bash
# Edit postgresql.conf
sudo vi /etc/postgresql/14/main/postgresql.conf

# Find and modify:
listen_addresses = 'localhost'  # For local access only
# OR
listen_addresses = '*'  # For remote access

# Edit pg_hba.conf for authentication
sudo vi /etc/postgresql/14/main/pg_hba.conf

# Add line for temple_user (local access):
local   web_temple      temple_user                     md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 4.4 Run Database Migrations

```bash
cd /opt/temple

# Run migration script
npm run migrate

# Verify tables created
psql -U temple_user -d web_temple -c "\dt"

# Expected tables:
# - users
# - static_pages
# - messages
# - audit_logs
# - donations
# - password_resets
```

**If migration script doesn't exist, run manually:**

```bash
cd /opt/temple

# Run each migration file
for file in migrations/*.sql; do
  echo "Running $file..."
  psql -U temple_user -d web_temple -f "$file"
done
```

### 4.5 Create Admin User

```bash
cd /opt/temple

# Run admin creation script (if exists)
ADMIN_EMAIL=admin@temple-domain.com \
ADMIN_USERNAME=admin \
ADMIN_PASSWORD='STRONG_ADMIN_PASSWORD' \
npm run create-admin

# OR create manually via psql:
psql -U temple_user -d web_temple
```

```sql
-- Generate password hash (use bcrypt in Node.js)
-- For example password 'Admin@2026!', bcrypt hash:
INSERT INTO users (username, email, password, role, is_active, created_at, updated_at)
VALUES (
  'admin',
  'admin@temple-domain.com',
  '$2b$10$...',  -- Replace with actual bcrypt hash
  'admin',
  true,
  NOW(),
  NOW()
);
```

**Generate bcrypt hash:**
```bash
node -e "console.log(require('bcrypt').hashSync('Admin@2026!', 10))"
```

---

## 5. SSL/TLS Certificate Setup

**Estimated Time:** 20 minutes

### 5.1 Point Domain to Server

Before obtaining SSL certificate:

1. Log in to domain registrar
2. Update DNS A record:
   - Name: `@` or `temple-domain.com`
   - Type: `A`
   - Value: `your-server-ip`
   - TTL: `3600` (or default)
3. Optionally add www subdomain:
   - Name: `www`
   - Type: `CNAME`
   - Value: `temple-domain.com`

**Verify DNS propagation:**
```bash
dig temple-domain.com
nslookup temple-domain.com
```

### 5.2 Install Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate (with Nginx plugin)
sudo certbot --nginx -d temple-domain.com -d www.temple-domain.com

# Follow prompts:
# - Enter email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

**Certbot will automatically:**
- Generate SSL certificate
- Configure Nginx to use certificate
- Set up HTTPS redirect
- Add renewal cron job

### 5.3 Configure Nginx Reverse Proxy

```bash
# Edit Nginx site configuration
sudo vi /etc/nginx/sites-available/temple
```

**Nginx Configuration:**

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name temple-domain.com www.temple-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    server_name temple-domain.com www.temple-domain.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/temple-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/temple-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/temple_access.log;
    error_log /var/log/nginx/temple_error.log;

    # Static files
    location /css/ {
        alias /opt/temple/public/css/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /js/ {
        alias /opt/temple/public/js/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /images/ {
        alias /opt/temple/public/images/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

**Enable site and restart Nginx:**

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/temple /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### 5.4 Test SSL Certificate

```bash
# Test SSL connection
curl -I https://temple-domain.com

# Check certificate details
echo | openssl s_client -servername temple-domain.com -connect temple-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Automatic Renewal:**
Certbot installs a cron job to renew certificates automatically. Verify:

```bash
# Check certbot timer
sudo systemctl status certbot.timer

# Test renewal (dry run)
sudo certbot renew --dry-run
```

---

## 6. PM2 Process Manager Setup

**Estimated Time:** 15 minutes

### 6.1 Start Application with PM2

```bash
cd /opt/temple

# Start application
pm2 start npm --name "web-temple" -- start

# Alternative: Start with ecosystem file (if exists)
pm2 start ecosystem.config.js

# Check status
pm2 status
pm2 logs web-temple --lines 50
```

### 6.2 Configure PM2 Startup Script

```bash
# Generate startup script
pm2 startup

# This will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u temple --hp /home/temple

# Copy and run that command (with sudo)

# Save PM2 process list
pm2 save
```

### 6.3 Configure PM2 Ecosystem File

```bash
cd /opt/temple

# Create ecosystem config
vi ecosystem.config.js
```

**ecosystem.config.js:**

```javascript
module.exports = {
  apps: [{
    name: 'web-temple',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
```

**Apply configuration:**

```bash
# Restart with new config
pm2 delete web-temple
pm2 start ecosystem.config.js
pm2 save
```

### 6.4 PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs web-temple

# View metrics
pm2 show web-temple
```

---

## 7. Backup Configuration

**Estimated Time:** 20 minutes

### 7.1 Configure S3 Backup (Optional but Recommended)

Already configured in `.env` (Section 3.3). Verify credentials:

```bash
# Test S3 access
aws s3 ls s3://temple-backups
# If aws-cli not installed:
sudo apt install -y awscli
aws configure  # Enter credentials from .env
```

### 7.2 Configure Backup Script

```bash
cd /opt/temple

# Make backup script executable
chmod +x scripts/backup.sh

# Test manual backup
./scripts/backup.sh
```

**Verify backup script contents:**

```bash
#!/bin/bash

# Temple B'nai Israel Website - Backup Script

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/opt/temple/backups"
DB_NAME="web_temple"
DB_USER="temple_user"
S3_BUCKET="s3://temple-backups"

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Database backup
echo "Backing up database..."
pg_dump -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/db_backup_$DATE.dump

# Application files backup (exclude node_modules, logs)
echo "Backing up application files..."
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
  --exclude='node_modules' \
  --exclude='logs' \
  --exclude='backups' \
  -C /opt temple

# Upload to S3 if enabled
if [ ! -z "$S3_BUCKET" ]; then
  echo "Uploading to S3..."
  aws s3 cp $BACKUP_DIR/db_backup_$DATE.dump $S3_BUCKET/database/
  aws s3 cp $BACKUP_DIR/app_backup_$DATE.tar.gz $S3_BUCKET/application/
fi

# Clean up local backups older than 7 days
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### 7.3 Schedule Automated Backups

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/temple/scripts/backup.sh >> /opt/temple/logs/backup.log 2>&1

# Add weekly full backup on Sundays at 3 AM
0 3 * * 0 /opt/temple/scripts/backup.sh >> /opt/temple/logs/backup.log 2>&1
```

**Verify cron job:**
```bash
crontab -l
```

### 7.4 Test Backup Restoration

```bash
cd /opt/temple/backups

# List backups
ls -lh

# Test database restore (on test database)
createdb -U temple_user test_restore
pg_restore -U temple_user -d test_restore -v db_backup_YYYY-MM-DD_HH-MM-SS.dump

# Verify restoration
psql -U temple_user -d test_restore -c "\dt"

# Drop test database
dropdb -U temple_user test_restore
```

---

## 8. Monitoring Setup

**Estimated Time:** 15 minutes

### 8.1 Application Logging

Already configured via Winston (in `src/utils/logger.js`). Verify:

```bash
# Check logs directory
ls -lh /opt/temple/logs/

# View application logs
tail -f /opt/temple/logs/application-$(date +%Y-%m-%d).log

# View error logs
tail -f /opt/temple/logs/error-$(date +%Y-%m-%d).log
```

### 8.2 System Monitoring (Optional: Install Monitoring Tools)

**Option A: Simple monitoring with PM2:**
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

**Option B: Install monitoring service (optional):**

```bash
# Install Node.js monitoring agent (example: PM2 Plus)
# Or install system monitoring (example: Netdata)
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

### 8.3 Log Rotation Configuration

Winston already handles log rotation. For system logs:

```bash
# Verify logrotate for Nginx
cat /etc/logrotate.d/nginx

# Add custom logrotate for application (if needed)
sudo vi /etc/logrotate.d/temple
```

**logrotate configuration:**

```
/opt/temple/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 temple temple
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 8.4 Set Up Alerts (Optional)

Configure email alerts for critical errors:

```bash
# Install mail utilities
sudo apt install -y mailutils

# Test email sending
echo "Test email from temple server" | mail -s "Test" admin@temple-domain.com
```

Add alerting logic to backup script or create monitoring script:

```bash
vi /opt/temple/scripts/alert_backup.js
```

*(File already exists in project - verify it's configured)*

---

## 9. Verification & Testing

**Estimated Time:** 30 minutes

### 9.1 Health Check

```bash
# Check application is running
pm2 status

# Check application response
curl http://localhost:3000
curl https://temple-domain.com

# Check database connection
psql -U temple_user -d web_temple -c "SELECT COUNT(*) FROM users;"
```

### 9.2 Test Key Features

**Homepage:**
```bash
curl -I https://temple-domain.com
# Should return: HTTP/1.1 200 OK
```

**Static Pages (if created):**
```bash
curl -I https://temple-domain.com/about
curl -I https://temple-domain.com/contact
```

**Admin Login:**
- Navigate to: https://temple-domain.com/admin/login
- Login with admin credentials created in Section 4.5
- Verify dashboard loads

**Contact Form:**
- Navigate to contact page
- Submit test message
- Verify email received (check SMTP logs)

**PayPal Donation (Test Mode):**
- Navigate to donation page
- Click donation button
- Verify PayPal popup opens
- Complete test transaction (if in sandbox mode)

**Facebook Live Stream:**
- Navigate to services page
- Verify Facebook stream embed displays
- Check browser console for errors

### 9.3 Performance Testing

```bash
# Install Apache Bench for load testing
sudo apt install -y apache2-utils

# Test homepage load
ab -n 100 -c 10 https://temple-domain.com/

# Review response times
# Expected: <500ms for 95% of requests
```

### 9.4 SSL/Security Testing

```bash
# Test SSL configuration
curl -I https://temple-domain.com

# Check SSL Labs rating (external tool)
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=temple-domain.com
# Expected: A or A+ rating
```

### 9.5 Backup Verification

```bash
# Trigger manual backup
./scripts/backup.sh

# Verify backup files created
ls -lh /opt/temple/backups/

# Check S3 upload (if configured)
aws s3 ls s3://temple-backups/database/
aws s3 ls s3://temple-backups/application/
```

### 9.6 Log Verification

```bash
# Check logs are being written
tail -f /opt/temple/logs/application-$(date +%Y-%m-%d).log

# Generate test log entry
curl https://temple-domain.com/test-endpoint

# Check for request in logs
grep "test-endpoint" /opt/temple/logs/application-$(date +%Y-%m-%d).log
```

---

## 10. Post-Deployment Configuration

**Estimated Time:** 20 minutes

### 10.1 Update DNS (if needed)

If DNS not updated in Section 5.1, do so now and wait for propagation (up to 48 hours).

### 10.2 Configure External Services

**PayPal Webhooks:**
1. Log in to PayPal Developer Dashboard
2. Navigate to Webhooks
3. Add webhook URL: `https://temple-domain.com/api/paypal/webhook`
4. Select events: Payment capture completed, Refund completed
5. Save and test webhook

**Facebook App Settings:**
1. Log in to Facebook Developers
2. Update app domain: `temple-domain.com`
3. Add OAuth redirect URI: `https://temple-domain.com/auth/facebook/callback`
4. Update privacy policy URL
5. Submit app for review if needed

### 10.3 Content Management

**Create Initial Pages:**
1. Log in to admin dashboard: `https://temple-domain.com/admin`
2. Navigate to "Pages"
3. Create key pages:
   - About Us
   - Contact
   - Services
   - Donations
   - Events
4. Publish pages

**Upload Media:**
1. Upload temple logo and images
2. Optimize images for web (use Image Optimization Guide)
3. Verify responsive display

### 10.4 Security Hardening

**Update Firewall Rules:**
```bash
# Limit SSH to specific IPs (optional but recommended)
sudo ufw delete allow 22/tcp
sudo ufw allow from YOUR_IP_ADDRESS to any port 22

# Rate limit SSH connections
sudo ufw limit 22/tcp
```

**Fail2Ban (Optional - prevents brute force attacks):**
```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure for Nginx
sudo vi /etc/fail2ban/jail.local
```

Add:
```
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log

[nginx-badbots]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
```

Restart Fail2Ban:
```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status
```

**Disable Root Login:**
```bash
sudo vi /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 10.5 Documentation

**Update RUNBOOK.md:**
- Add server-specific details (IP address, hostnames)
- Document any custom configurations
- Add emergency contact information

**Update this SETUP.md:**
- Note any deviations from standard setup
- Document lessons learned
- Update version number

### 10.6 Monitoring & Alerts

**Set Up Uptime Monitoring:**
- Use external service (e.g., UptimeRobot, Pingdom)
- Monitor: `https://temple-domain.com`
- Set alert email/SMS for downtime

**Configure Log Alerts:**
```bash
# Create script to monitor critical errors
vi /opt/temple/scripts/alert_errors.sh
```

```bash
#!/bin/bash
# Alert on critical errors in logs

LOG_FILE="/opt/temple/logs/error-$(date +%Y-%m-%d).log"
ALERT_EMAIL="admin@temple-domain.com"

# Check for critical errors in last hour
ERROR_COUNT=$(grep -c "CRITICAL\|FATAL" $LOG_FILE)

if [ $ERROR_COUNT -gt 0 ]; then
  echo "Found $ERROR_COUNT critical errors in last hour" | \
    mail -s "Temple Website: Critical Errors Detected" $ALERT_EMAIL
fi
```

Add to cron:
```bash
crontab -e
# Add: */30 * * * * /opt/temple/scripts/alert_errors.sh
```

---

## Deployment Checklist

Use this checklist to track setup progress:

### Server Setup
- ☐ Server provisioned and accessible
- ☐ Application user created
- ☐ SSH key authentication configured
- ☐ Firewall configured (ufw)
- ☐ Node.js v18+ installed
- ☐ PM2 installed globally
- ☐ Nginx installed

### Application
- ☐ Repository cloned to `/opt/temple`
- ☐ Dependencies installed (`npm install`)
- ☐ `.env` configured with all credentials
- ☐ Directory structure created (logs, backups)
- ☐ Permissions set correctly

### Database
- ☐ PostgreSQL installed and running
- ☐ Database created (`web_temple`)
- ☐ User created (`temple_user`)
- ☐ Migrations run successfully
- ☐ Admin user created
- ☐ Database connection tested

### SSL/TLS
- ☐ Domain DNS pointing to server
- ☐ Certbot installed
- ☐ SSL certificate obtained
- ☐ Nginx configured as reverse proxy
- ☐ HTTPS redirect enabled
- ☐ SSL Labs test passed (A+ rating)

### Process Management
- ☐ PM2 configured with ecosystem file
- ☐ Application started with PM2
- ☐ PM2 startup script configured
- ☐ PM2 process list saved
- ☐ Application auto-restart verified

### Backups
- ☐ Backup script configured
- ☐ S3 credentials configured (if using)
- ☐ Manual backup tested
- ☐ Backup restoration tested
- ☐ Automated backup cron job added

### Monitoring & Logging
- ☐ Application logs working (Winston)
- ☐ Log rotation configured
- ☐ PM2 logs configured
- ☐ System monitoring set up (optional)
- ☐ Error alerting configured

### Testing
- ☐ Homepage loads successfully
- ☐ Admin dashboard accessible
- ☐ Static pages load correctly
- ☐ Contact form sends email
- ☐ PayPal donation button works
- ☐ Facebook stream displays
- ☐ Performance test passed
- ☐ SSL test passed

### Post-Deployment
- ☐ PayPal webhooks configured
- ☐ Facebook app settings updated
- ☐ Initial content created
- ☐ Security hardening complete
- ☐ Uptime monitoring configured
- ☐ Documentation updated
- ☐ Team notified of deployment

---

## Troubleshooting

If you encounter issues during setup, refer to:
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Comprehensive troubleshooting guide
- [RUNBOOK.md](./RUNBOOK.md) - Operational procedures

**Common Setup Issues:**

**1. Cannot connect to database:**
- Check PostgreSQL is running: `systemctl status postgresql`
- Verify credentials in `.env`
- Test connection: `psql -U temple_user -d web_temple -c "SELECT 1;"`

**2. PM2 app crashes immediately:**
- Check logs: `pm2 logs web-temple --err`
- Verify `.env` file exists and has correct format
- Ensure all dependencies installed: `npm install`

**3. SSL certificate not obtained:**
- Verify domain DNS points to server: `dig temple-domain.com`
- Check firewall allows port 80: `sudo ufw status`
- Review Certbot logs: `sudo tail /var/log/letsencrypt/letsencrypt.log`

**4. Nginx shows "Bad Gateway":**
- Check application is running: `pm2 status`
- Test app locally: `curl http://localhost:3000`
- Check Nginx error logs: `sudo tail /var/log/nginx/error.log`

---

## Rollback Procedure

If deployment fails and you need to rollback:

### 1. Stop New Application
```bash
pm2 stop web-temple
pm2 delete web-temple
```

### 2. Restore Previous Database (if needed)
```bash
# List backups
ls -lh /opt/temple/backups/

# Restore database
pg_restore -U temple_user -d web_temple -c -v db_backup_PREVIOUS_DATE.dump
```

### 3. Restore Previous Application Code (if needed)
```bash
cd /opt/temple

# Revert to previous git commit
git log --oneline -10
git checkout PREVIOUS_COMMIT_HASH

# Or restore from backup
cd /tmp
tar -xzf /opt/temple/backups/app_backup_PREVIOUS_DATE.tar.gz
sudo rsync -av temple/ /opt/temple/

# Reinstall dependencies
cd /opt/temple
npm install
```

### 4. Restart Application
```bash
pm2 start ecosystem.config.js
pm2 logs web-temple
```

### 5. Verify Rollback
```bash
curl https://temple-domain.com
# Check admin dashboard
# Verify key features working
```

---

## Next Steps

After successful deployment:

1. **Monitor First 24 Hours:**
   - Check logs regularly: `pm2 logs web-temple`
   - Monitor system resources: `pm2 monit`
   - Watch for errors: `tail -f /opt/temple/logs/error-*.log`

2. **User Acceptance Testing:**
   - Have stakeholders test all features
   - Verify email delivery
   - Test donation flow end-to-end
   - Check Facebook stream integration

3. **Performance Optimization:**
   - Review application metrics after first week
   - Optimize slow database queries
   - Consider CDN for static assets (future enhancement)

4. **Documentation:**
   - Document any custom configurations
   - Update emergency contacts in RUNBOOK.md
   - Train team members on admin dashboard

5. **Ongoing Maintenance:**
   - Schedule regular backups verification (weekly)
   - Update dependencies monthly: `npm update`
   - Review logs for anomalies
   - Monitor SSL certificate expiry (automatic with Certbot)

---

**Setup Guide Version:**
- v1.0 (2026-02-07): Initial comprehensive setup guide for production deployment

**Support:**
For questions or issues, contact:
- System Administrator: admin@temple-domain.com
- Technical Support: support@temple-domain.com
- Emergency: See RUNBOOK.md emergency contacts
