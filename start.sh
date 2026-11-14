#!/bin/bash
# lmphone 시작: LM Studio 확인 -> 서버 -> cloudflare 터널 -> QR 열기
cd "$(dirname "$0")"
PORT="${PORT:-8787}"
LM_PORT="${LM_PORT:-1234}"
rm -f .tunnel-url

c1=$'\033[38;5;105m'; c2=$'\033[38;5;211m'; dim=$'\033[2m'; b=$'\033[1m'; r=$'\033[0m'

cleanup() {
  echo
  echo "${dim}정리 중…${r}"
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null
  [ -n "$TUN" ] && kill "$TUN" 2>/dev/null
  rm -f .tunnel-url
  exit 0
}
trap cleanup INT TERM

# 1) LM Studio 서버
if ! curl -s -m 3 "http://127.0.0.1:$LM_PORT/v1/models" >/dev/null; then
  echo "${dim}LM Studio 서버 켜는 중…${r}"
  if command -v lms >/dev/null; then lms server start >/dev/null 2>&1; sleep 2; fi
fi
if ! curl -s -m 3 "http://127.0.0.1:$LM_PORT/v1/models" >/dev/null; then
  echo "${b}LM Studio가 $LM_PORT 에서 안 돌고 있어.${r}"
  echo "LM Studio 앱 > Developer 탭 > Status 를 Running 으로 바꾸고 다시 실행해줘."
  exit 1
fi

# 2) 로컬 서버
PORT="$PORT" LM_PORT="$LM_PORT" node server.js &
SRV=$!
sleep 1
TOKEN=$(cat .token 2>/dev/null)
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)

# 3) cloudflare 빠른 터널 (계정 필요 없음)
LOG=$(mktemp)
if command -v cloudflared >/dev/null; then
  cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$PORT" > "$LOG" 2>&1 &
  TUN=$!
  echo "${dim}외부 접속 주소 받는 중…${r}"
  for i in $(seq 1 40); do
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1)
    [ -n "$URL" ] && break
    sleep 0.5
  done
  [ -n "$URL" ] && echo "$URL" > .tunnel-url
fi

echo
echo "${c1}${b}  lmphone 켜짐${r}"
echo "${dim}  ──────────────────────────────────────${r}"
if [ -n "$URL" ]; then
  echo "  ${c2}${b}어디서나${r}  $URL/?k=$TOKEN"
else
  echo "  ${dim}외부 터널 실패 — 같은 와이파이로만 접속 가능${r}"
fi
echo "  ${c1}같은 와이파이${r}  http://$IP:$PORT/?k=$TOKEN"
echo "  ${dim}QR 코드${r}       http://127.0.0.1:$PORT/qr"
echo "${dim}  ──────────────────────────────────────${r}"
echo "  ${dim}끄려면 Ctrl+C${r}"
echo

sleep 1
open "http://127.0.0.1:$PORT/qr" 2>/dev/null

wait $SRV
