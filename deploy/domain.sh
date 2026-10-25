#!/usr/bin/env bash
# Moves a running Daroon from port mode (http://SERVER_IP:PORT) to its own domain with HTTPS.
#
#   cd /opt/daroon && ./deploy/domain.sh daroon.example.com you@example.com
#
# Before running it, point the domain's A record at this server. Then:
# - if nothing else uses ports 80 and 443, Daroon takes them and Caddy fetches the certificate itself;
# - if nginx already serves another site there, a server block for the domain is added to nginx, proxying to Daroon's
#   port on localhost, and certbot fetches the certificate (the other site is not touched);
# - with any other web server in front, it prints what to add there.
# Secrets in deploy/.env are kept; the old file is saved next to it. Run it again any time.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE=deploy/.env

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
env_get() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true; }
env_set() { # env_set KEY VALUE: replace the line or append it (the file keeps its owner and mode)
  local tmp
  tmp=$(mktemp)
  K=$1 V=$2 awk 'BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"] }
    index($0, k "=") == 1 { if (!done) print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }' "$ENV_FILE" >"$tmp"
  cat "$tmp" >"$ENV_FILE"
  rm -f "$tmp"
}

DOMAIN=${1:-${DOMAIN:-}}
EMAIL=${2:-${ACME_EMAIL:-}}
[[ -n $DOMAIN ]] || die "Usage: ./deploy/domain.sh DOMAIN [EMAIL]   e.g. ./deploy/domain.sh daroon.example.com you@example.com"
DOMAIN=${DOMAIN#http://}
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN%%/*}
[[ $DOMAIN =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "\"$DOMAIN\" does not look like a domain name."
[[ -f $ENV_FILE ]] || die "$ENV_FILE is missing; run ./deploy/install.sh first."

SUDO=""
[[ $(id -u) -eq 0 ]] || SUDO=sudo
docker info >/dev/null 2>&1 || DOCKER_SUDO=sudo
COMPOSE=(${DOCKER_SUDO:-} docker compose -f deploy/docker-compose.yml --env-file "$ENV_FILE")

# ── 1. Does the domain point here? ──────────────────────────────────────────
say "Checking that $DOMAIN points at this server…"
MY_IP=$(curl -fsS --max-time 6 https://api.ipify.org 2>/dev/null || true)
DNS_IPS=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' || true)
if [[ -z $DNS_IPS ]]; then
  target=${MY_IP:-"this server's IP"}
  die "$DOMAIN has no A record yet. In your domain's DNS panel add an A record pointing to $target, wait a few minutes, and run this again."
fi
if [[ -n $MY_IP && " $DNS_IPS " != *" $MY_IP "* ]]; then
  [[ -n ${FORCE:-} ]] || die "$DOMAIN points to $DNS_IPS, but this server is $MY_IP. Fix the A record (or run with FORCE=1 if a proxy/CDN sits in front)."
  warn "$DOMAIN points to $DNS_IPS, not $MY_IP; continuing because FORCE is set."
fi
echo "OK: $DOMAIN → $DNS_IPS"

# ── 2. Who holds ports 80 and 443? ──────────────────────────────────────────
holders=$($SUDO ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null | grep -oE 'users:\(\("[^"]+"' | cut -d'"' -f2 | sort -u | tr '\n' ' ' || true)
others=$(tr ' ' '\n' <<<"$holders" | grep -vE '^(docker-proxy|)$' | sort -u | tr '\n' ' ' || true)
others=${others% }
PORT=$(env_get HTTP_BIND)
PORT=${PORT##*:}
PORT=${PORT:-8080}
[[ $PORT == 80 ]] && PORT=8080

cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
env_set APP_ORIGIN "https://$DOMAIN"
env_set COOKIE_SECURE true
[[ -n $EMAIL ]] && env_set ACME_EMAIL "$EMAIL"
# a sender still at the server's IP moves to the domain
from=$(env_get MAIL_FROM)
ip_at='@[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+'
if [[ $from =~ $ip_at ]]; then
  env_set MAIL_FROM "${from/${BASH_REMATCH[0]}/@$DOMAIN}"
fi

if [[ -z $others ]]; then
  # ── 3a. Ports are free: Daroon serves the domain itself ──────────────────
  say "Ports 80 and 443 are free: Daroon will serve $DOMAIN itself."
  [[ -n $EMAIL || -n $(env_get ACME_EMAIL | grep -v example.com) ]] ||
    warn "No email given for Let's Encrypt notices; pass one as the second argument next time."
  env_set SITE_ADDRESS "$DOMAIN"
  env_set HTTP_BIND 80
  env_set HTTPS_BIND 443
  if command -v ufw >/dev/null && $SUDO ufw status 2>/dev/null | grep -q 'Status: active'; then
    $SUDO ufw allow 80/tcp >/dev/null && $SUDO ufw allow 443/tcp >/dev/null && echo "Opened 80 and 443 in ufw."
  fi
  "${COMPOSE[@]}" up -d --build
  say "Waiting for the certificate and the app (up to two minutes)…"
  for _ in $(seq 1 40); do
    if curl -fsS --max-time 5 --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" 2>/dev/null | grep -q '"ok":true'; then
      say "Done: https://$DOMAIN"
      echo "Port $PORT is no longer used; you can close it (sudo ufw delete allow $PORT/tcp)."
      exit 0
    fi
    sleep 3
  done
  "${COMPOSE[@]}" logs --tail 40 web
  die "HTTPS did not come up. Ports 80 and 443 must be reachable from the internet (also in your provider's firewall) for Let's Encrypt."
fi

# ── 3b. Another web server is in front: Daroon stays on localhost:PORT ─────
say "Ports 80/443 are used by: $others. Daroon stays behind it on 127.0.0.1:$PORT."
env_set SITE_ADDRESS ":80"
env_set HTTP_BIND "127.0.0.1:$PORT"
env_set HTTPS_BIND "127.0.0.1:$((PORT + 363))"
"${COMPOSE[@]}" up -d --build
for _ in $(seq 1 40); do
  curl -fsS --max-time 5 "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true' && break
  sleep 3
done

if [[ " $others " == *" nginx "* ]] && [[ -d /etc/nginx ]]; then
  conf=/etc/nginx/sites-available/daroon-$DOMAIN.conf
  [[ -d /etc/nginx/sites-available ]] || conf=/etc/nginx/conf.d/daroon-$DOMAIN.conf
  say "Adding $conf for $DOMAIN…"
  $SUDO tee "$conf" >/dev/null <<NGINX
# Written by daroon/deploy/domain.sh: $DOMAIN → Daroon on 127.0.0.1:$PORT
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 2m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
  if [[ $conf == */sites-available/* ]]; then
    $SUDO ln -sf "$conf" "/etc/nginx/sites-enabled/$(basename "$conf")"
  fi
  $SUDO nginx -t || die "nginx rejected the new block; it was written to $conf. Remove it and nginx is as before."
  $SUDO systemctl reload nginx
  if ! command -v certbot >/dev/null; then
    say "Installing certbot…"
    $SUDO apt-get update -qq && $SUDO apt-get install -y -qq certbot python3-certbot-nginx >/dev/null ||
      die "Could not install certbot. Install it (apt install certbot python3-certbot-nginx) and run this again."
  fi
  say "Getting the certificate…"
  $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect \
    ${EMAIL:+-m "$EMAIL"} ${EMAIL:---register-unsafely-without-email} ||
    die "certbot could not get a certificate. Port 80 must be reachable from the internet for $DOMAIN."
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 5 "https://$DOMAIN/api/health" 2>/dev/null | grep -q '"ok":true'; then
      say "Done: https://$DOMAIN"
      echo "Daroon is no longer reachable on port $PORT from outside; you can close it (sudo ufw delete allow $PORT/tcp)."
      exit 0
    fi
    sleep 3
  done
  die "nginx and the certificate are in place, but https://$DOMAIN/api/health does not answer yet. Check: sudo nginx -t; ${COMPOSE[*]} ps"
fi

say "Add this to the web server in front ($others), get a certificate for $DOMAIN there, and reload it:"
cat <<EOF
  $DOMAIN  →  reverse proxy to  http://127.0.0.1:$PORT
  (pass the Host header and X-Forwarded-For / X-Forwarded-Proto)
EOF
echo "Daroon's settings are already switched to https://$DOMAIN."
