#!/usr/bin/env bash
# One-time setup of WeTrack staging on the droplet (wegigs-stg), next to WeShop and TailorOS.
# Run as root:  sudo bash staging-setup.sh <deploy-key.pub>
# Safe to re-run: it skips what already exists. Deploys come from
# .github/workflows/deploy-staging.yml and deploy/staging-release.sh.
set -euo pipefail

ROOT=/var/www/wetrack-staging
HOST=internal.weshopkh.com
PORT=3100
KEY_FILE=${1:?pass the GitHub Actions public key file}

# current (symlink, made by the first deploy), releases/, shared/.
install -d -o deploy -g deploy "$ROOT" "$ROOT/releases" "$ROOT/shared" "$ROOT/shared/logs"

# Let GitHub Actions in as deploy.
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
grep -qxF "$(cat "$KEY_FILE")" /home/deploy/.ssh/authorized_keys \
  || cat "$KEY_FILE" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

# Database and env. The secrets are made here and never leave the box.
ENV_FILE=$ROOT/shared/.env
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS=$(openssl rand -hex 24)
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='wetrack_staging'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE wetrack_staging PASSWORD '$DB_PASS'"
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE wetrack_staging LOGIN PASSWORD '$DB_PASS'"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='wetrack_staging'" | grep -q 1 \
    || sudo -u postgres createdb -O wetrack_staging wetrack_staging

  install -m 600 -o deploy -g deploy /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://wetrack_staging:$DB_PASS@127.0.0.1:5432/wetrack_staging
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://$HOST
CRON_SECRET=$(openssl rand -hex 24)
APP_TIMEZONE=Asia/Phnom_Penh

# Fill in, then: sudo supervisorctl restart wetrack-staging
# Resend SMTP: SMTP_PASS is a Resend API key (re_…); EMAIL_FROM's domain must be verified in Resend
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=
EMAIL_FROM="WeTrack <no-reply@weshopkh.com>"
# Google redirect URI: https://$HOST/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
fi

# deploy may restart only this program. Checked before it goes live: a broken
# file in sudoers.d breaks sudo for everyone.
SUDOERS=$(mktemp)
echo 'deploy ALL=(root) NOPASSWD: /usr/bin/supervisorctl restart wetrack-staging' > "$SUDOERS"
visudo -cf "$SUDOERS"
install -m 440 "$SUDOERS" /etc/sudoers.d/wetrack-staging
rm -f "$SUDOERS"

# Stays down until the first deploy creates current/.
cat > /etc/supervisor/conf.d/wetrack-staging.conf <<EOF
[program:wetrack-staging]
directory=$ROOT/current
command=/usr/bin/node --env-file=$ROOT/shared/.env server.js
environment=NODE_ENV="production",HOSTNAME="127.0.0.1",PORT="$PORT"
user=deploy
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=$ROOT/shared/logs/app.log
EOF
supervisorctl reread
supervisorctl update

# Replaces vercel.ts crons. The droplet runs UTC: 01:00 Monday UTC = 08:00 in Phnom Penh.
# The secret is read from the 600 .env at run time, so this world-readable file holds none,
# and reaches curl on stdin (-H @-), so it never shows in ps.
CRON="sed -n 's/^CRON_SECRET=/Authorization: Bearer /p' $ENV_FILE | curl -fsS -o /dev/null -H @- http://127.0.0.1:$PORT/api/cron"
cat > /etc/cron.d/wetrack-staging <<EOF
*/5 * * * * deploy $CRON/meetings >> $ROOT/shared/logs/cron.log 2>&1
0 1 * * 1 deploy $CRON/digest >> $ROOT/shared/logs/cron.log 2>&1
EOF

cat > /etc/nginx/sites-available/wetrack-staging <<EOF
server {
    listen 80;
    server_name $HOST;
    client_max_body_size 20M;

    # Not proxy_params: it appends to a client-sent X-Forwarded-For, which would let anyone
    # pick the IP Better Auth rate-limits by. nginx is the only hop, so it sets the client IP.
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/wetrack-staging /etc/nginx/sites-enabled/wetrack-staging
nginx -t
systemctl reload nginx

# HTTPS. Needs the DNS record pointing here first; re-run if it fails.
# --keep: on a re-run, reinstall the existing certificate into the rewritten site without asking.
certbot --nginx --redirect --keep -d "$HOST"

echo "Done. Fill in the blanks in $ENV_FILE, then run the GitHub workflow."
