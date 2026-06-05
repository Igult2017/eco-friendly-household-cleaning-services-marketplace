#!/bin/sh
set -e

# Auto-generate a self-signed origin certificate if one doesn't exist.
# Cloudflare sits in front and handles the public-facing TLS — this cert
# only needs to be valid, not publicly trusted.
if [ ! -f /etc/nginx/ssl/origin.crt ]; then
  echo "[nginx] Generating self-signed origin certificate..."
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/origin.key \
    -out  /etc/nginx/ssl/origin.crt \
    -subj "/CN=dorix.eu/O=DORIX/C=DE" \
    -quiet
  echo "[nginx] Certificate generated."
else
  echo "[nginx] Origin certificate already exists, skipping generation."
fi

exec nginx -g "daemon off;"
