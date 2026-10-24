#!/usr/bin/env bash
# One-step install of Daroon on a Linux server, next to whatever else runs there.
#
#   ./deploy/install.sh
#
# Asks a few questions (or reads them from the environment), then installs Docker if needed, writes
# deploy/.env with fresh secrets, builds and starts the stack, opens the firewall port and checks health.
# Safe to run again: an existing deploy/.env and its secrets are kept.
#
# Non-interactive use, e.g.:
#   PORT=8080 SMTP_URL='smtps://user:pass@smtp.example.com:465' ASSUME_YES=1 ./deploy/install.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=deploy/.env
COMPOSE=(docker compose -f deploy/docker-compose.yml --env-file "$ENV_FILE")

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*" >&2; }
die() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }
ask() { # ask VAR "question" default
  local var=$1 q=$2 def=${3:-} cur=${!1:-}
  if [[ -n $cur ]]; then return; fi
  if [[ -n ${ASSUME_YES:-} || ! -t 0 ]]; then printf -v "$var" '%s' "$def"; return; fi
  read -r -p "$q${def:+ [$def]}: " cur || true
  printf -v "$var" '%s' "${cur:-$def}"
}
secret() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48; }

SUDO=""
if [[ $(id -u) -ne 0 ]]; then
  command -v sudo >/dev/null || die "Run as root or install sudo."
  SUDO=sudo
fi

# ── 1. Docker ───────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null; then
  say "Installing Docker…"
  if ! curl -fsSL --max-time 30 https://get.docker.com | $SUDO sh; then
    warn "get.docker.com did not work; installing Docker from the distribution's packages instead."
    $SUDO apt-get update && $SUDO apt-get install -y docker.io docker-compose-v2 || die "Could not install Docker."
    $SUDO systemctl enable --now docker
  fi
fi
if ! docker info >/dev/null 2>&1; then
  if $SUDO docker info >/dev/null 2>&1; then
    COMPOSE=($SUDO "${COMPOSE[@]}")
    DOCKER="$SUDO docker"
  else
    $SUDO systemctl start docker || die "Docker is installed but not running."
    DOCKER="$SUDO docker"
    COMPOSE=($SUDO "${COMPOSE[@]}")
  fi
else
  DOCKER=docker
fi
$DOCKER compose version >/dev/null 2>&1 || die "The Docker Compose plugin is missing (apt install docker-compose-plugin)."

# ── 2. Settings ─────────────────────────────────────────────────────────────
if [[ -f $ENV_FILE ]]; then
  say "Keeping the existing $ENV_FILE (secrets unchanged). Delete it to start over."
  HTTP_BIND=$(grep '^HTTP_BIND=' "$ENV_FILE" | cut -d= -f2-)
  PORT=${HTTP_BIND##*:}
else
  say "A few questions (Enter keeps the suggestion):"
  DETECTED_IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')
  ask PORT "Port for Daroon" 8080
  ask SERVER_IP "This server's public IP or hostname" "$DETECTED_IP"
  ask SMTP_URL "SMTP for login codes (empty: codes appear in the log)" ""
  ask MAIL_FROM "Sender of the login mail" "درون <no-reply@${SERVER_IP}>"
  ask STORY_API_URL "OpenAI-compatible API URL for weekly stories (optional, e.g. https://api.openai.com/v1)" ""
  STORY_API_KEY=${STORY_API_KEY:-} STORY_MODEL=${STORY_MODEL:-}
  if [[ -n $STORY_API_URL ]]; then
    ask STORY_MODEL "Model name for stories" ""
    ask STORY_API_KEY "API key for it (empty for a local server)" ""
  fi
  [[ $PORT =~ ^[0-9]+$ ]] || die "Port must be a number."
  [[ -n $SERVER_IP ]] || die "The server address is needed."

  umask 077
  cat >"$ENV_FILE" <<EOF
# Written by deploy/install.sh on $(date -u +%Y-%m-%d). Port mode: plain HTTP on port $PORT.
SITE_ADDRESS=:80
APP_ORIGIN=http://$SERVER_IP:$PORT
COOKIE_SECURE=false
HTTP_BIND=$PORT
HTTPS_BIND=127.0.0.1:$((PORT + 363))
ACME_EMAIL=admin@example.com

POSTGRES_PASSWORD=$(secret)
AUTH_SECRET=$(secret)

SMTP_URL=$SMTP_URL
MAIL_FROM="$MAIL_FROM"

GOOGLE_CLIENT_ID=
STORY_API_URL=$STORY_API_URL
STORY_API_KEY=$STORY_API_KEY
STORY_MODEL=$STORY_MODEL
STORIES_PER_DAY=12
EOF
  echo "Wrote $ENV_FILE"
fi

# ── 3. Is the port free? ────────────────────────────────────────────────────
if ! "${COMPOSE[@]}" ps --status running 2>/dev/null | grep -q web; then
  if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${PORT}\$"; then
    die "Port $PORT is already in use. Pick another: delete $ENV_FILE and run again with PORT=…"
  fi
fi

# ── 4. Can we reach Docker Hub? ─────────────────────────────────────────────
say "Checking access to Docker Hub…"
if ! $DOCKER pull -q postgres:16-alpine >/dev/null 2>&1; then
  warn "Docker Hub is not reachable from this server (common for servers in Iran)."
  MIRROR=${DOCKER_MIRROR:-}
  ask MIRROR "Registry mirror to use" "https://docker.arvancloud.ir"
  say "Configuring Docker to use $MIRROR…"
  $SUDO mkdir -p /etc/docker
  if [[ -s /etc/docker/daemon.json ]]; then
    $SUDO cp /etc/docker/daemon.json /etc/docker/daemon.json.bak
    warn "Saved the old /etc/docker/daemon.json as daemon.json.bak"
  fi
  echo "{ \"registry-mirrors\": [\"$MIRROR\"] }" | $SUDO tee /etc/docker/daemon.json >/dev/null
  $SUDO systemctl restart docker 2>/dev/null || $SUDO service docker restart
  $DOCKER pull -q postgres:16-alpine >/dev/null || die "Still cannot pull images. Check the mirror address or the server's network."
fi

# ── 5. Build and start ──────────────────────────────────────────────────────
say "Building and starting (the first build takes a few minutes)…"
"${COMPOSE[@]}" up -d --build

# ── 6. Firewall ─────────────────────────────────────────────────────────────
if command -v ufw >/dev/null && $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
  $SUDO ufw allow "${PORT}/tcp" >/dev/null && echo "Opened port $PORT in ufw."
fi

# ── 7. Health ───────────────────────────────────────────────────────────────
say "Waiting for the app to answer…"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" 2>/dev/null | grep -q '"ok":true'; then
    ORIGIN=$(grep '^APP_ORIGIN=' "$ENV_FILE" | cut -d= -f2-)
    say "Daroon is running: $ORIGIN"
    if ! grep -q '^SMTP_URL=.\+' "$ENV_FILE"; then
      echo "No SMTP is set, so login codes are written to the log. To see the latest one:"
      echo "  ${COMPOSE[*]} logs api | grep 'LOGIN CODE' | tail -1"
    fi
    echo "If the page does not open from outside, open port $PORT in your hosting provider's firewall too."
    exit 0
  fi
  sleep 3
done
"${COMPOSE[@]}" ps
die "The app did not answer within three minutes. See: ${COMPOSE[*]} logs --tail 80"
