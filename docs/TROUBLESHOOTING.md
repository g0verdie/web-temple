# Troubleshooting Guide - Temple B'nai Israel Website

**Last Updated:** February 7, 2026  
**Version:** 1.0  
**Maintainer:** System Administrator

## Table of Contents

1. [Common Failure Scenarios](#1-common-failure-scenarios)
2. [PayPal Integration Issues](#2-paypal-integration-issues)
3. [Facebook Live Stream Failures](#3-facebook-live-stream-failures)
4. [Email Delivery Problems](#4-email-delivery-problems)
5. [Database Errors](#5-database-errors)
   - [Redis/Cache Errors](#53-redis-cache-errors)
6. [Application Performance Issues](#6-application-performance-issues)
7. [SSL/TLS Certificate Problems](#7-ssltls-certificate-problems)
8. [Network Connectivity Issues](#8-network-connectivity-issues)

---

## 1. Common Failure Scenarios

### 1.1 Application Won't Start

**Symptoms:**
- `pm2 start` fails with exit code 1
- Error messages like: "Error: listen EADDRINUSE: address already in use :::3000"
- Application crashes immediately after start
- Logs show: "Application failed to start" or "Uncaught exception"

**Diagnosis:**
```bash
# Check PM2 logs for common error patterns:
# - "Error: listen EADDRINUSE" = Port in use
# - "Error: Cannot find module" = Missing dependencies  
# - "Error: connect ECONNREFUSED" = Database connection failed
# - "TypeError: Cannot read property" = Configuration issue

# Check if port is already in use
netstat -tulpn | grep 3000
# OR
lsof -i :3000

# Check PM2 status
pm2 status

# Check application logs
pm2 logs web-temple --err --lines 50
```

**Solutions:**

**A. Port Already in Use:**
```bash
# Find and kill process using port 3000
lsof -i :3000 | grep LISTEN
kill -9 <PID>

# OR change port in .env
echo "PORT=3001" >> .env
pm2 restart web-temple
```

**B. Missing Dependencies:**
```bash
cd /opt/temple
npm install
pm2 restart web-temple
```

**C. Environment Variables Missing:**
```bash
# Check .env file exists
ls -la /opt/temple/.env

# Verify required variables
grep -E "NODE_ENV|PORT|DATABASE" /opt/temple/.env

# Copy from example if missing
cp .env.example .env
# Edit with correct values
vi .env
```

**D. Database Connection Failed:**
```bash
# Test database connectivity
psql -U temple_user -d web_temple -c "SELECT 1;"

# Check database is running
systemctl status postgresql
# OR for docker
docker-compose ps db
```

### 1.2 Application Running But Not Responding

**Symptoms:**
- PM2 shows app as "online" but website doesn't load
- Timeout errors when accessing site
- 502 Bad Gateway error

**Diagnosis:**
```bash
# Check if application is listening
curl http://localhost:3000

# Check application logs
tail -f /opt/temple/logs/application-$(date +%Y-%m-%d).log

# Check system resources
free -h
df -h
top
```

**Solutions:**

**A. Application Crashed/Hung:**
```bash
pm2 restart web-temple
pm2 logs web-temple --lines 100
```

**B. Out of Memory:**
```bash
# Check memory usage
free -h

# Restart application to free memory
pm2 restart web-temple

# Increase Node.js memory limit if needed
pm2 delete web-temple
pm2 start npm --name "web-temple" --node-args="--max-old-space-size=2048" -- start
pm2 save
```

**C. Reverse Proxy Issue (Nginx):**
```bash
# Check Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### 1.3 404 Errors on Valid Pages

**Symptoms:**
- Homepage works but other pages return 404
- Static assets not loading

**Diagnosis:**
```bash
# Check route configuration
grep -r "app.use" /opt/temple/src/server.js

# Check static files directory
ls -la /opt/temple/public/

# Check application logs for route errors
grep "404" /opt/temple/logs/application-*.log
```

**Solutions:**

**A. Static Files Not Found:**
```bash
# Verify public directory exists and has correct permissions
ls -la /opt/temple/public/
chmod -R 755 /opt/temple/public/

# Restart application
pm2 restart web-temple
```

**B. Route Configuration Issue:**
```bash
# Review server.js for route definitions
cat /opt/temple/src/server.js | grep -A5 "app.use"

# Restart after fixing routes
pm2 restart web-temple
```

---

## 2. PayPal Integration Issues

### 2.1 PayPal Donation Button Not Working

**Symptoms:**
- Clicking donation button does nothing
- PayPal popup doesn't appear
- "PayPal not responding" error

**Diagnosis:**
```bash
# Check PayPal configuration in .env
grep PAYPAL /opt/temple/.env

# Check browser console for JavaScript errors
# (Ask user to open browser developer tools)

# Check application logs for PayPal API errors
grep -i "paypal" /opt/temple/logs/application-*.log | tail -20
```

**Solutions:**

**A. PayPal API Credentials Invalid:**
```bash
# Verify PayPal credentials in .env
vi /opt/temple/.env
# Update PAYPAL_CLIENT_ID and PAYPAL_SECRET

# Restart application
pm2 restart web-temple
```

**B. PayPal Service Down:**
1. Check PayPal Status Page: https://www.paypal-status.com/
2. If PayPal is down:
   - Display maintenance banner to users
   - Log incident for later follow-up
   - Queue donation requests for retry when service recovers

**C. Network/Firewall Blocking PayPal:**
```bash
# Test PayPal API connectivity
curl -v https://api-m.paypal.com/v1/oauth2/token

# Check firewall rules
sudo iptables -L -n | grep -i paypal
```

### 2.2 Donation Confirmation Emails Not Sent

**Symptoms:**
- Donation succeeds but user doesn't receive email
- "Email failed" error in logs

**Diagnosis:**
```bash
# Check email service logs
grep -i "donation.*email" /opt/temple/logs/application-*.log | tail -20

# Check email queue
# (Implementation specific - check email service code)
```

**Solutions:**

**A. Email Service Configuration:**
```bash
# Verify email configuration in .env
grep EMAIL /opt/temple/.env

# Test email sending manually
# (Use admin dashboard email test feature)
```

**B. Email Queue Backed Up:**
See [Section 4: Email Delivery Problems](#4-email-delivery-problems) for detailed email troubleshooting.

---

## 3. Facebook Live Stream Failures

### 3.1 Facebook Stream Not Displaying

**Symptoms:**
- Embedded Facebook player shows error
- "Video unavailable" message
- Stream was working but now broken

**Diagnosis:**
```bash
# Check Facebook API logs
grep -i "facebook" /opt/temple/logs/application-*.log | tail -20

# Test Facebook API connectivity
curl -v "https://graph.facebook.com/v12.0/me?access_token=YOUR_TOKEN"
```

**Solutions:**

**A. Facebook Access Token Expired:**
```bash
# Update Facebook access token in .env
vi /opt/temple/.env
# Update FACEBOOK_ACCESS_TOKEN

# Restart application
pm2 restart web-temple
```

**Instructions to Generate New Token:**
1. Go to https://developers.facebook.com/
2. Select your app
3. Go to "Tools" > "Access Token Tool"
4. Generate new page access token
5. Update `.env` file with new token
6. Restart application

**B. Facebook API Rate Limit:**
1. Check Facebook API rate limit status in logs
2. Implement backoff strategy (wait 1-5 minutes)
3. Consider caching stream status to reduce API calls

**C. Facebook Live Stream Not Active:**
1. Verify stream is actually live on Facebook
2. Check Facebook Page directly
3. If stream ended, update website to show "Stream ended" message

### 3.2 Facebook Stream Embedding Issues

**Symptoms:**
- Stream plays on Facebook but not on website
- Cross-origin errors in browser console

**Solutions:**

**A. Content Security Policy Too Restrictive:**
```bash
# Check CSP configuration in server.js
grep -A20 "contentSecurityPolicy" /opt/temple/src/server.js

# Ensure Facebook domains are whitelisted:
# frameSrc: ["'self'", "https://www.facebook.com"]
```

**B. Facebook Privacy Settings:**
1. Check Facebook Live video privacy settings
2. Must be set to "Public" for embedding
3. Update video privacy on Facebook Page

---

## 4. Email Delivery Problems

### 4.1 Emails Not Being Sent

**Symptoms:**
- Users report not receiving emails
- Email confirmation fails
- "Email service unavailable" errors

**Diagnosis:**
```bash
# Check email service logs
grep -i "email" /opt/temple/logs/application-*.log | tail -50

# Check SMTP configuration
grep SMTP /opt/temple/.env

# Test SMTP connectivity
telnet smtp.example.com 587
```

**Solutions:**

**A. SMTP Credentials Invalid:**
```bash
# Update email credentials in .env
vi /opt/temple/.env
# Update SMTP_USER, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT

# Restart application
pm2 restart web-temple

# Test email sending from admin dashboard
```

**B. Email Service Rate Limiting:**
1. Check email provider rate limits
2. Implement retry logic with exponential backoff
3. Consider upgrading email service plan

**C. Email Queue Backlog:**
```bash
# Check email queue status (if implemented)
# Review logs for queued emails
grep "email.*queue" /opt/temple/logs/application-*.log

# Manual queue processing (if available)
# Trigger queue worker manually or wait for automatic processing
```

### 4.2 Emails Going to Spam

**Symptoms:**
- Emails sent successfully but users don't see them
- Found in spam/junk folders

**Solutions:**

**A. SPF/DKIM Configuration:**
1. Verify SPF record in DNS:
   ```bash
   dig TXT temple-domain.com | grep spf
   ```
2. Verify DKIM record:
   ```bash
   dig TXT default._domainkey.temple-domain.com
   ```
3. Check DMARC policy:
   ```bash
   dig TXT _dmarc.temple-domain.com
   ```

**B. Email Content Triggers Spam Filters:**
1. Avoid spam trigger words ("free", "winner", excessive caps)
2. Include unsubscribe link
3. Use reputable email service provider
4. Add proper email headers (Reply-To, From name)

### 4.3 Email Backlog/Queue Issues

**Symptoms:**
- Emails delayed by hours
- Queue growing continuously
- System running out of disk space

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check queue size (implementation specific)
# Review logs for queue metrics
grep "queue.*size" /opt/temple/logs/application-*.log
```

**Solutions:**

**A. Clear Email Queue:**
```bash
# Option 1: Process queue manually (if tool available)
# Option 2: Restart email worker process
pm2 restart email-worker  # If separate process

# Option 3: Purge old failed emails (after review)
# Backup queue first, then remove emails older than X days
```

**B. Increase Email Processing Rate:**
1. Increase concurrent email workers
2. Optimize email sending logic
3. Consider using bulk email API if available

---

## 5. Database Errors

### 5.1 Database Connection Failed

**Symptoms:**
- "Cannot connect to database" error
- Application fails to start
- "ECONNREFUSED" or "connection timeout" errors

**Diagnosis:**
```bash
# Check if database is running
systemctl status postgresql
# OR for docker
docker-compose ps db

# Test database connection
psql -U temple_user -d web_temple -c "SELECT 1;"

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-*.log
# OR for docker
docker-compose logs db
```

**Solutions:**

**A. Database Not Running:**
```bash
# Start PostgreSQL
sudo systemctl start postgresql
# OR for docker
docker-compose start db

# Verify it's running
systemctl status postgresql
```

**B. Database Credentials Wrong:**
```bash
# Check credentials in .env
grep -E "DB_USER|DB_PASSWORD|DB_HOST|DB_NAME" /opt/temple/.env

# Test connection with credentials
psql -U temple_user -h localhost -d web_temple
```

**C. Database Port Not Accessible:**
```bash
# Check if port 5432 is open
netstat -tulpn | grep 5432

# Check firewall rules
sudo iptables -L -n | grep 5432
```

### 5.2 Database Performance Issues

**Symptoms:**
- Slow query responses
- Timeouts on database operations
- High CPU/memory usage by database

**Diagnosis:**
```bash
# Check active connections
psql -U temple_user -d web_temple -c "SELECT count(*) FROM pg_stat_activity;"

# Check long-running queries
psql -U temple_user -d web_temple -c "
  SELECT pid, now() - query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE state != 'idle' 
  ORDER BY duration DESC;"

# Check database size
psql -U temple_user -d web_temple -c "
  SELECT pg_size_pretty(pg_database_size('web_temple'));"
```

**Solutions:**

**A. Too Many Connections:**
```bash
# Kill idle connections
psql -U temple_user -d web_temple -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle' AND query_start < now() - interval '1 hour';"
```

**B. Missing Indexes:**
```sql
-- Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM table_name WHERE condition;

-- Add indexes for frequently queried columns
CREATE INDEX idx_column_name ON table_name(column_name);
```

**C. Database Needs Vacuum:**
```bash
# Run vacuum analyze
psql -U temple_user -d web_temple -c "VACUUM ANALYZE;"
```

### 5.3 Database Disk Space Full

**Symptoms:**
- "No space left on device" error
- Cannot write to database
- Application crashes with disk errors

**Diagnosis:**
```bash
# Check disk usage
df -h

# Check database directory size
du -sh /var/lib/postgresql/
# OR for docker volume
docker-compose exec db du -sh /var/lib/postgresql/data
```

**Solutions:**

**A. Clean Up Old Logs:**
```bash
# Remove old PostgreSQL logs
sudo find /var/log/postgresql/ -name "*.log" -mtime +30 -delete

# Vacuum database to reclaim space
psql -U temple_user -d web_temple -c "VACUUM FULL;"
```

**B. Archive Old Data:**
1. Identify tables with old data
2. Archive to S3 or external storage
3. Delete archived data from database

**C. Expand Disk Space:**
1. Add more disk space to server
2. Resize partition
3. Move database to larger volume

---

### 5.3 Redis/Cache Errors

**Symptoms:**
- Cache misses or stale data
- Email queue backlog grows unexpectedly
- "ECONNREFUSED" or "Redis connection error" in logs

**Diagnosis:**
```bash
# Check Redis service
sudo systemctl status redis-server

# Ping Redis
redis-cli ping

# Check Redis memory usage
redis-cli info memory | head -20

# Check application logs for Redis errors
grep -i "redis" /opt/temple/logs/application-*.log | tail -50
```

**Solutions:**

**A. Redis Not Running:**
```bash
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**B. Misconfigured Connection:**
```bash
# Verify Redis env vars
grep -E "REDIS_HOST|REDIS_PORT|REDIS_DB" /opt/temple/.env

# Restart app after updates
pm2 restart web-temple
```

**C. Cache/Queue Backlog:**
1. Restart Redis to clear transient issues: `sudo systemctl restart redis-server`
2. Review queue worker health (if applicable)
3. If needed, clear specific keys **with caution**:
   - Inspect keys: `redis-cli --scan | head -50`
   - Delete targeted keys only: `redis-cli del <key>`

---

## 6. Application Performance Issues

### 6.1 Slow Page Load Times

**Symptoms:**
- Pages take >5 seconds to load
- Timeout errors
- Users complain about slowness

**Diagnosis:**
```bash
# Check response times in logs
grep "response-time" /opt/temple/logs/application-*.log | awk '{print $NF}' | sort -n | tail -20

# Check system load
uptime
top

# Check database query performance
# See Database Performance Issues section
```

**Solutions:**

**A. High CPU/Memory Usage:**
```bash
# Identify resource-intensive processes
top
ps aux --sort=-%cpu | head -10
ps aux --sort=-%mem | head -10

# Restart application if needed
pm2 restart web-temple
```

**B. Database Query Optimization:**
1. Identify slow queries in logs
2. Add database indexes
3. Optimize query logic
4. Implement caching

**C. Enable Compression:**
```javascript
// Already enabled in server.js with compression middleware
// Verify it's working:
curl -H "Accept-Encoding: gzip" -I https://temple-domain.com
```

### 6.2 Memory Leaks

**Symptoms:**
- Memory usage grows over time
- Application becomes unresponsive
- Frequent crashes

**Diagnosis:**
```bash
# Monitor memory over time
pm2 monit

# Check memory usage trends
grep "System Metrics" /opt/temple/logs/application-*.log | grep -o "heapUsed.*" | tail -20
```

**Solutions:**

**A. Restart Application Periodically:**
```bash
# Add cron job to restart daily at low-traffic time
crontab -e
# Add: 0 3 * * * pm2 restart web-temple
```

**B. Increase Node.js Memory Limit:**
```bash
pm2 delete web-temple
pm2 start npm --name "web-temple" --node-args="--max-old-space-size=4096" -- start
pm2 save
```

**C. Profile Memory Usage:**
```bash
# Use Node.js heap snapshot
node --inspect src/server.js
# Connect Chrome DevTools and take heap snapshot
```

---

## 7. SSL/TLS Certificate Problems

### 7.1 Certificate Expired

**Symptoms:**
- "Your connection is not private" error
- SSL certificate warnings in browser
- "ERR_CERT_DATE_INVALID" error

**Diagnosis:**
```bash
# Check certificate expiry date
echo | openssl s_client -servername temple-domain.com -connect temple-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

**Solutions:**

**A. Renew Certificate:**
```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Reload web server
sudo systemctl reload nginx
# OR
sudo systemctl reload apache2
```

**B. Certificate Renewal Failed:**
```bash
# Check certbot logs
sudo tail -f /var/log/letsencrypt/letsencrypt.log

# Force renewal
sudo certbot renew --force-renewal

# Check domain DNS is pointing to server
dig temple-domain.com
```

### 7.2 Mixed Content Warnings

**Symptoms:**
- "Mixed content" warnings in browser
- Some resources not loading over HTTPS
- Broken padlock icon

**Solutions:**

**A. Update Resource URLs:**
1. Check for http:// links in HTML/CSS/JS
2. Change to https:// or protocol-relative URLs (//)
3. Use CSP upgrade-insecure-requests directive (already in server.js)

---

## 8. Network Connectivity Issues

### 8.1 Internet Connection Down

**Symptoms:**
- Cannot access external services
- PayPal, Facebook, Email all failing
- Cannot download updates

**Diagnosis:**
```bash
# Test internet connectivity
ping -c 4 8.8.8.8
ping -c 4 google.com

# Check network interfaces
ifconfig
# OR
ip addr show

# Check default gateway
route -n
```

**Solutions:**

**A. Restart Network:**
```bash
# Restart network service
sudo systemctl restart networking
# OR
sudo systemctl restart NetworkManager
```

**B. Check Router/Modem:**
1. Verify physical connections
2. Restart router/modem
3. Contact ISP if issue persists

**C. Check DNS Resolution:**
```bash
# Test DNS
nslookup google.com
dig google.com

# Use different DNS server temporarily
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
```

### 8.2 Firewall Blocking Traffic

**Symptoms:**
- Specific services unreachable
- Connections timeout
- Works locally but not remotely

**Diagnosis:**
```bash
# Check firewall rules
sudo iptables -L -n

# Check if port is open
sudo netstat -tulpn | grep LISTEN

# Test specific port
telnet temple-domain.com 443
```

**Solutions:**

**A. Open Required Ports:**
```bash
# Allow HTTP/HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Save rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4
```

---

## Quick Diagnostic Checklist

When encountering issues, run through this checklist:

1. ☐ Check application status: `pm2 status`
2. ☐ Check logs: `pm2 logs web-temple --lines 50`
3. ☐ Check system resources: `free -h`, `df -h`, `uptime`
4. ☐ Check database: `psql -U temple_user -d web_temple -c "SELECT 1;"`
5. ☐ Check network: `ping google.com`
6. ☐ Check SSL: `curl -I https://temple-domain.com`
7. ☐ Try restart: `pm2 restart web-temple`

If issues persist after these checks, contact system administrator and provide:
- Error messages from logs
- Steps to reproduce the issue
- Time when issue started
- Recent changes made to system

---

**Document Version:**
- v1.0 (2026-02-07): Initial comprehensive troubleshooting guide
