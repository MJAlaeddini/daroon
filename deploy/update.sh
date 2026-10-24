#!/usr/bin/env bash
# Pulls the latest code and rebuilds. Data and settings are kept.
set -euo pipefail
cd "$(dirname "$0")/.."
SUDO=""
docker info >/dev/null 2>&1 || SUDO=sudo
git pull --ff-only
$SUDO docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
$SUDO docker image prune -f >/dev/null
echo "Updated to $(git log -1 --format='%h %s')"
