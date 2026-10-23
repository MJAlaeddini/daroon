#!/bin/sh
# Daily database backup, keeping the last 14. Add to the server's crontab:
#   15 3 * * * /opt/daroon/deploy/backup.sh >> /var/log/daroon-backup.log 2>&1
set -eu
cd "$(dirname "$0")/.."
DIR=${BACKUP_DIR:-/var/backups/daroon}
mkdir -p "$DIR"
FILE="$DIR/daroon-$(date +%Y%m%d-%H%M).sql.gz"
docker compose -f deploy/docker-compose.yml --env-file deploy/.env exec -T db pg_dump -U daroon daroon | gzip > "$FILE"
ls -1t "$DIR"/daroon-*.sql.gz | tail -n +15 | xargs -r rm --
echo "backup written: $FILE"
