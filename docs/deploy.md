# Deploying to a VPS

This guide runs Daroon on a Linux server with Docker: PostgreSQL, the API, and Caddy serving the app with automatic HTTPS.

## Before you start

- **Server location.** The Claude API is not available in Iran, and Docker Hub blocks Iranian IP addresses, so the server must be outside Iran (for example Germany, the Netherlands or Finland). Users in Iran can reach the app without trouble.
- **Size.** 2 GB of RAM and 1 vCPU are enough (Ubuntu 24.04 recommended).
- **Domain.** An A record pointing at the server's IP, e.g. `daroon.example.com`.
- **Mail.** An SMTP service for login codes, such as Mailgun, Postmark, Amazon SES, or your mail host's SMTP.
- **Google (optional).** In Google Cloud Console create an OAuth client of type "Web application" and add `https://DOMAIN` to Authorized JavaScript origins. Google sign-in may not work for users in Iran without a VPN; email sign-in always does.
- **Claude (optional).** An API key from console.anthropic.com for weekly stories.

## Steps

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Code
sudo mkdir -p /opt/daroon && sudo chown $USER /opt/daroon
git clone https://github.com/MJAlaeddini/daroon.git /opt/daroon
cd /opt/daroon

# 3. Settings
cp deploy/.env.example deploy/.env
nano deploy/.env        # DOMAIN, ACME_EMAIL, secrets, SMTP_URL, ...
#   generate secrets with:  openssl rand -base64 48

# 4. Start
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# 5. Check
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
curl https://DOMAIN/api/health      # should return {"ok":true}
```

Database migrations run automatically when the API starts. Caddy obtains the HTTPS certificate from Let's Encrypt itself; ports 80 and 443 must be open.

## Updating

```bash
cd /opt/daroon
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Users see "a new version of Daroon is ready" and update when they choose.

## Backups

```bash
sudo crontab -e
# add this line: every night at 03:15, keeping the last fourteen
15 3 * * * /opt/daroon/deploy/backup.sh >> /var/log/daroon-backup.log 2>&1
```

Restoring a backup:

```bash
gunzip -c /var/backups/daroon/daroon-YYYYMMDD-HHMM.sql.gz | \
  docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db psql -U daroon daroon
```

It's a good idea to copy the backup folder somewhere else as well (for example to cloud storage with `rclone`).

## Logs

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env logs -f api
```
