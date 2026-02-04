# SSL/TLS Setup Guide

This document outlines the procedures for setting up SSL/TLS certificates for the Temple B'nai Israel website using Let's Encrypt and Certbot.

## Prerequisites

-   A Linux server (production environment).
-   Domain name pointing to the server's IP address (e.g., `templebnaiisrael.org`).
-   SSH access to the server.
-   Nginx (assumed reverse proxy) installed and configured to serve the application on port 80.

## 1. Install Certbot

Usage depends on the Linux distribution. For Ubuntu/Debian:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx
```

## 2. Obtain Certificates

Run Certbot to obtain certificates and automatically configure Nginx:

```bash
sudo certbot --nginx -d templebnaiisrael.org -d www.templebnaiisrael.org
```

Follow the interactive prompts:
1.  Enter an email address for renewal notifications.
2.  Agree to the Terms of Service.
3.  Choose whether to redirect HTTP traffic to HTTPS (Recommended: Select "Redirect" or "2").

## 3. Verify Auto-Renewal

Certbot packages come with a cron job or systemd timer that will renew certificates automatically before they expire.

To verify that auto-renewal works:

```bash
sudo certbot renew --dry-run
```

If the command completes without errors, your certificates will renew automatically.

## 4. Nginx Configuration Check

Ensure your Nginx configuration passes strict transport security headers to the application if needed, or handles them directly.

Example Nginx snippet managed by Certbot:

```nginx
server {
    listen 443 ssl;
    server_name templebnaiisrael.org;

    ssl_certificate /etc/letsencrypt/live/templebnaiisrael.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/templebnaiisrael.org/privkey.pem;
    
    # ... other SSL settings ...
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. Troubleshooting

-   **Logs:** Check `/var/log/letsencrypt/letsencrypt.log` for Certbot errors.
-   **Nginx:** Check `sudo nginx -t` to verify configuration syntax.
