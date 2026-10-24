# Deploying to a VPS

This guide runs Daroon on a Linux server with Docker: PostgreSQL, the API, and Caddy serving the app with automatic HTTPS.

## Before you start

- **Server location.** The Claude API is not available in Iran, and Docker Hub blocks Iranian IP addresses, so the server must be outside Iran (for example Germany, the Netherlands or Finland). Users in Iran can reach the app without trouble.
- **Size.** 2 GB of RAM and 1 vCPU are enough (Ubuntu 24.04 recommended).
- **Domain.** An A record pointing at the server's IP, e.g. `daroon.example.com`. Not needed for the temporary port mode below.
- **Mail.** An SMTP service for login codes, such as Mailgun, Postmark, Amazon SES, or your mail host's SMTP.
- **Google (optional).** In Google Cloud Console create an OAuth client of type "Web application" and add `https://DOMAIN` to Authorized JavaScript origins. Google sign-in may not work for users in Iran without a VPN; email sign-in always does.
- **Claude (optional).** An API key from console.anthropic.com for weekly stories.

## Quick install (next to an existing site)

After the repository is cloned (see the deploy key below), one script does the rest: installs Docker if needed, writes `deploy/.env` with fresh secrets, builds and starts everything on a port of your choice, opens the firewall and checks that the app answers.

```bash
cd /opt/daroon && ./deploy/install.sh
```

It asks for the port (default 8080), the server address (detected), an optional SMTP URL and an optional Claude API key. Without SMTP, login codes are written to the log (`docker compose ... logs api | grep 'LOGIN CODE'`). If Docker Hub is unreachable (as from servers in Iran) it offers to configure a registry mirror. Running it again keeps the existing settings and secrets. Later updates: `./deploy/update.sh`.

## Getting the code onto the server (private repository)

The server needs read access to the repository. A **deploy key** gives it access to this one repository only:

```bash
# on the server
ssh-keygen -t ed25519 -C "daroon-deploy" -f ~/.ssh/daroon_deploy -N ""
cat ~/.ssh/daroon_deploy.pub
```

On GitHub: repository → **Settings → Deploy keys → Add deploy key**, paste the public key, leave "Allow write access" off. Then tell SSH to use it for this repository:

```bash
cat >> ~/.ssh/config <<'CFG'
Host github-daroon
  HostName github.com
  User git
  IdentityFile ~/.ssh/daroon_deploy
  IdentitiesOnly yes
CFG
chmod 600 ~/.ssh/config
ssh -T github-daroon        # "Hi MJAlaeddini/daroon! You've successfully authenticated..."
```

## Steps

```bash
# 1. Docker (does not touch an existing nginx/Apache; it only opens the ports you publish)
curl -fsSL https://get.docker.com | sh

# 2. Code
sudo mkdir -p /opt/daroon && sudo chown $USER /opt/daroon
git clone github-daroon:MJAlaeddini/daroon.git /opt/daroon
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

Database migrations run automatically when the API starts.

### Mode B: next to an existing site, on its own port

If another site already uses ports 80 and 443, run Daroon on a spare port over plain HTTP for now. In `deploy/.env` use the Mode B block:

```
SITE_ADDRESS=:80
APP_ORIGIN=http://SERVER_IP:8080
COOKIE_SECURE=false
HTTP_BIND=8080
HTTPS_BIND=127.0.0.1:8443
```

Then open the port (`sudo ufw allow 8080/tcp`, and in your provider's firewall if it has one) and visit `http://SERVER_IP:8080`. Everything runs in its own containers, volumes and directory; the existing site is not touched.

Limits of this mode, since there is no HTTPS: login codes and the session cookie travel unencrypted, the app cannot be installed or work offline (browsers allow service workers only over HTTPS), and Google sign-in is unavailable. Use it for trying things out; for real use move to a subdomain with HTTPS — either Mode A, or keep this port and add a block for the subdomain to the existing web server that proxies to `http://127.0.0.1:8080` (then set `APP_ORIGIN=https://SUBDOMAIN`, `COOKIE_SECURE=true`, and `HTTP_BIND=127.0.0.1:8080`). Caddy obtains the HTTPS certificate from Let's Encrypt itself; ports 80 and 443 must be open.

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
