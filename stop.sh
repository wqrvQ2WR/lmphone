#!/bin/bash
# lmphone 끄기
cd "$(dirname "$0")"
pkill -f "cloudflared tunnel --no-autoupdate --url http://127.0.0.1:${PORT:-8787}" 2>/dev/null
pkill -f "node .*lmphone/server.js" 2>/dev/null
pkill -f "lmphone/start.sh" 2>/dev/null
rm -f .tunnel-url
echo "lmphone 껐어"
