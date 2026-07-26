#!/bin/sh
set -eu

target="${1:-.env}"
if [ -e "$target" ]; then
  echo "$target already exists; refusing to overwrite it." >&2
  exit 1
fi

base64url() {
  openssl base64 -A | tr '+/' '-_' | tr -d '='
}

sign_jwt() {
  role="$1"
  secret="$2"
  header="$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | base64url)"
  issued_at="$(date +%s)"
  expires_at="$((issued_at + 315360000))"
  payload="$(printf '{"role":"%s","iss":"supabase","iat":%s,"exp":%s}' "$role" "$issued_at" "$expires_at" | base64url)"
  unsigned="$header.$payload"
  signature="$(printf '%s' "$unsigned" | openssl dgst -sha256 -hmac "$secret" -binary | base64url)"
  printf '%s.%s\n' "$unsigned" "$signature"
}

postgres_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 32)"
anon_key="$(sign_jwt anon "$jwt_secret")"
service_role_key="$(sign_jwt service_role "$jwt_secret")"

umask 077
{
  printf '%s\n' 'STUFFHUB_IMAGE=ghcr.io/OWNER/stuffhub:1.0.0'
  printf '%s\n' 'APP_URL=http://localhost:3000'
  printf '%s\n' 'SUPABASE_PUBLIC_URL=http://localhost:8000'
  printf '%s\n' 'STUFFHUB_PORT=3000'
  printf '%s\n' 'SUPABASE_PORT=8000'
  printf '%s\n' 'COOKIE_SECURE=false'
  printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password"
  printf 'JWT_SECRET=%s\n' "$jwt_secret"
  printf 'ANON_KEY=%s\n' "$anon_key"
  printf 'SERVICE_ROLE_KEY=%s\n' "$service_role_key"
  printf '%s\n' 'JWT_EXPIRY=3600'
  printf '%s\n' 'ENABLE_EMAIL_AUTOCONFIRM=true'
  printf '%s\n' 'DISABLE_SIGNUP=false'
  printf '%s\n' 'ADDITIONAL_REDIRECT_URLS='
  printf '%s\n' 'SMTP_ADMIN_EMAIL=admin@example.com'
  printf '%s\n' 'SMTP_HOST='
  printf '%s\n' 'SMTP_PORT=587'
  printf '%s\n' 'SMTP_USER='
  printf '%s\n' 'SMTP_PASS='
  printf '%s\n' 'SMTP_SENDER_NAME=StuffHub'
} > "$target"

echo "Created $target with unique database and JWT secrets."
echo "Set STUFFHUB_IMAGE and public URLs before starting an Internet-facing server."
