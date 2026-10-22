#!/usr/bin/env bash
# Runs on the droplet as deploy, piped over SSH by deploy-staging.yml:
#   staging-release.sh <release>
# releases/<release>.tgz must already be uploaded.
set -euo pipefail

APP=/var/www/wetrack-staging
REL=$APP/releases/$1

# Leave nothing half-unpacked behind if a step fails before the switch.
cleanup() {
  rm -f "$REL.tgz"
  [ "$(readlink -f "$APP/current")" = "$REL" ] || rm -rf "$REL"
}
trap cleanup EXIT

mkdir "$REL"
tar -xzf "$REL.tgz" -C "$REL"
(cd "$REL" && node --env-file="$APP/shared/.env" migrate.cjs)

ln -sfn "$REL" "$APP/current"
sudo supervisorctl restart wetrack-staging

for i in $(seq 24); do
  curl -s -o /dev/null http://127.0.0.1:3100 && break
  if [ "$i" = 24 ]; then
    echo "WeTrack did not come up. Log: $APP/shared/logs/app.log" >&2
    exit 1
  fi
  sleep 5
done

# Keep the live release and the 4 newest before it.
cd "$APP/releases"
ls -1d */ | sed 's#/$##' | { grep -vx "$1" || true; } | sort | head -n -4 | xargs -r rm -rf --
echo "live: $1"
