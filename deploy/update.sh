#!/usr/bin/env bash
# Pulls the latest code, rebuilds, and checks that the app answers. Data and settings are kept.
# Run by hand on the server, or by the Deploy workflow over SSH.
set -euo pipefail
cd "$(dirname "$0")/.."
SUDO=""
docker info >/dev/null 2>&1 || SUDO=sudo
COMPOSE=($SUDO docker compose -f deploy/docker-compose.yml --env-file deploy/.env)

git pull --ff-only
"${COMPOSE[@]}" up -d --build
$SUDO docker image prune -f >/dev/null

BIND=$(grep '^HTTP_BIND=' deploy/.env | cut -d= -f2-)
PORT=${BIND##*:}
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${PORT:-80}/api/health" 2>/dev/null | grep -q '"ok":true'; then
    echo "Updated to $(git log -1 --format='%h %s') and healthy."
    exit 0
  fi
  sleep 3
done
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail 60 api
echo "The app did not become healthy after the update." >&2
exit 1
