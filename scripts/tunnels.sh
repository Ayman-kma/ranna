#!/usr/bin/env bash
# Starts two cloudflared quick tunnels (web :3000, API :4000), writes the
# resulting HTTPS URLs into web/.env.local and server/.env, then tells you to
# restart the app. Quick-tunnel URLs are random and change every run.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
command -v cloudflared >/dev/null 2>&1 || {
  echo "cloudflared not found. Install with: brew install cloudflared"
  exit 1
}

WEB_LOG="$(mktemp -t ranna-web-tunnel)"
API_LOG="$(mktemp -t ranna-api-tunnel)"

nohup cloudflared tunnel --no-autoupdate --url http://localhost:3000 >"$WEB_LOG" 2>&1 &
WEB_PID=$!
nohup cloudflared tunnel --no-autoupdate --url http://localhost:4000 >"$API_LOG" 2>&1 &
API_PID=$!
disown "$WEB_PID" "$API_PID" 2>/dev/null || true

echo "Waiting for tunnel URLs..."
WEB_URL=""
API_URL=""
for _ in $(seq 1 30); do
  WEB_URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$WEB_LOG" 2>/dev/null | head -1 || true)"
  API_URL="$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$API_LOG" 2>/dev/null | head -1 || true)"
  if [ -n "$WEB_URL" ] && [ -n "$API_URL" ]; then break; fi
  sleep 1
done

if [ -z "$WEB_URL" ] || [ -z "$API_URL" ]; then
  echo "Could not determine tunnel URLs. Logs:"
  cat "$WEB_LOG" "$API_LOG"
  exit 1
fi

cat > "$ROOT/web/.env.local" <<EOF
# Generated $(date) by scripts/tunnels.sh
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_PUBLIC_URL=$WEB_URL
EOF

if [ ! -f "$ROOT/server/.env" ]; then
  cp "$ROOT/server/.env.example" "$ROOT/server/.env"
fi
if sed --version >/dev/null 2>&1; then
  sed -i "s|^APP_BASE_URL=.*|APP_BASE_URL=$WEB_URL|" "$ROOT/server/.env"
else
  sed -i '' "s|^APP_BASE_URL=.*|APP_BASE_URL=$WEB_URL|" "$ROOT/server/.env"
fi

echo ""
echo "  Dashboard : $WEB_URL/dashboard"
echo "  API       : $API_URL"
echo "  QR base   : $WEB_URL/c/<token>"
echo ""
echo "Now restart the app:  npm run dev"
echo "Tunnels: web PID $WEB_PID, api PID $API_PID  (stop with: kill $WEB_PID $API_PID)"
