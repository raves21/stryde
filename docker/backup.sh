#!/usr/bin/env bash
# Daily Postgres backup for the Stryde stack. Copy next to compose.yml on the server
# (~/apps/stryde/backup.sh), `chmod +x` it, and run it from cron (docs/deploy-home-server.md §8).
#
#   BACKUP_DIR   where dumps go (default: ./backups next to this script)
#   KEEP_DAYS    delete dumps older than this (default: 14)
set -euo pipefail

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
umask 077

out="$BACKUP_DIR/stryde-$(date +%F-%H%M).dump"
tmp="$out.partial"
trap 'rm -f "$tmp"' EXIT

# -T: no TTY under cron. Write to a temp file so a failed dump never looks like a backup.
docker compose exec -T db pg_dump -U stryde -Fc stryde > "$tmp"

# A dump that pg_restore can't list is not a backup.
docker compose exec -T db pg_restore --list < "$tmp" > /dev/null

mv "$tmp" "$out"
find "$BACKUP_DIR" -name 'stryde-*.dump' -mtime "+$KEEP_DAYS" -delete
echo "backup written: $out ($(du -h "$out" | cut -f1))"
