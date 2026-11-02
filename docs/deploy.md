# Deploying to a VPS

This guide runs Daroon on a Linux server with Docker: PostgreSQL, the API, and Caddy serving the app with automatic HTTPS.

## Before you start

- **Server location.** Docker Hub blocks Iranian IP addresses (and many model APIs do too), so the server is simplest outside Iran (for example Germany, the Netherlands or Finland). Users in Iran can reach the app without trouble.
- **Size.** 2 GB of RAM and 1 vCPU are enough (Ubuntu 24.04 recommended).
- **Domain.** An A record pointing at the server's IP, e.g. `daroon.example.com`. Not needed for the temporary port mode below.
- **Mail.** An SMTP service for login codes, such as Mailgun, Postmark, Amazon SES, or your mail host's SMTP.
- **Google (optional).** In Google Cloud Console create an OAuth client of type "Web application" and add `https://DOMAIN` to Authorized JavaScript origins. Google sign-in may not work for users in Iran without a VPN; email sign-in always does.
- **Weekly stories (optional).** Any OpenAI-compatible chat API: OpenAI, OpenRouter, Groq, a gateway, or a model you run yourself with Ollama or vLLM. Set `STORY_API_URL`, `STORY_MODEL` and, if the service needs one, `STORY_API_KEY` in `deploy/.env` (examples in `deploy/.env.example`), then run `./deploy/update.sh`. Without them the week's story is a plain summary written on the device.

## Quick install (next to an existing site)

After the repository is cloned (see the deploy key below), one script does the rest: installs Docker if needed, writes `deploy/.env` with fresh secrets, builds and starts everything on a port of your choice, opens the firewall and checks that the app answers.

```bash
cd /opt/daroon && ./deploy/install.sh
```

It asks for the port (default 8080), the server address (detected), an optional SMTP URL and an optional story API (URL, model, key). Without SMTP, login codes are written to the log (`docker compose ... logs api | grep 'LOGIN CODE'`). If Docker Hub is unreachable (as from servers in Iran) it offers to configure a registry mirror. Running it again keeps the existing settings and secrets. Later updates: `./deploy/update.sh`.

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

## Moving to your own domain (HTTPS)

1. In the domain's DNS panel add an **A record** for the name you want (e.g. `daroon` for `daroon.example.com`, or `@` for the bare domain) pointing to the server's IP. Wait until `getent hosts DOMAIN` on the server shows that IP (minutes, sometimes an hour).
2. On the server:

   ```bash
   cd /opt/daroon && git pull && ./deploy/domain.sh DOMAIN you@example.com
   ```

The script checks that the domain points at the server, then:

- if nothing else uses ports 80 and 443, Daroon takes them and Caddy gets the Let's Encrypt certificate itself (Mode A);
- if nginx already serves another site there, it adds a server block for the domain that proxies to Daroon on `127.0.0.1:PORT` and runs certbot for it; the other site is untouched;
- if another app already has port 80 but 443 is free, Daroon takes 443 only and gets its certificate over 443 (TLS-ALPN); the other app is not touched, and plain `http://DOMAIN` keeps reaching it;
- if another app's **container** publishes port 443 (its own nginx, Caddy or Traefik in Docker), it changes nothing and prints what to add to that front server: send the domain to `http://172.17.0.1:PORT` (the host's Docker bridge address) and get a certificate for it there. Once `https://DOMAIN` reaches Daroon, `BEHIND=1 ./deploy/domain.sh DOMAIN EMAIL` switches Daroon's own settings;
- with another web server in front, it prints what to add there.

If starting Daroon on 80/443 fails, the previous `deploy/.env` is put back and the app restarted, so it keeps running on its old port.

It sets `APP_ORIGIN=https://DOMAIN` and `COOKIE_SECURE=true`, moves a sender address that still uses the IP to the domain, keeps every secret, and saves the old `deploy/.env` beside it. `deploy/update.sh` checks health over HTTPS once the domain is set, so automatic deploys keep working. Ports 80 and 443 must be reachable from the internet (also in the provider's firewall) for the certificate.

With HTTPS the app can be installed on phones and works offline, and Google sign-in becomes possible (add `https://DOMAIN` to the OAuth client's JavaScript origins and set `GOOGLE_CLIENT_ID`).

## Automatic deploys from GitHub

The last CI job on `main` (the reusable `Deploy` workflow) runs `deploy/update.sh` on the server over SSH once every check passes (or when started by hand from the Actions tab). On the server, create a key that can do only that:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/gha_deploy -N ""
echo "command=\"cd /opt/daroon && ./deploy/update.sh\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat ~/.ssh/gha_deploy.pub)" >> ~/.ssh/authorized_keys
cat ~/.ssh/gha_deploy        # the private key, for the DEPLOY_KEY secret
rm ~/.ssh/gha_deploy ~/.ssh/gha_deploy.pub
```

The `command=` prefix means this key can run the update and nothing else, even if it leaks. Then in GitHub: repository → **Settings → Secrets and variables → Actions → New repository secret**, add `DEPLOY_HOST` (server address), `DEPLOY_USER` (e.g. `root`), `DEPLOY_KEY` (the whole private key, including the BEGIN/END lines) and, if SSH is not on port 22, `DEPLOY_PORT`.

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
