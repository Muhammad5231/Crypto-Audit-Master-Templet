#!/bin/bash
cd /home/z/my-project
export HOSTNAME=0.0.0.0
export PORT=3000

echo "[DEV] Installing dependencies..."
bun install

echo "[DEV] Setting up database..."
bun run db:push

echo "[DEV] Starting production server with auto-restart..."
while true; do
  echo "[$(date)] Starting Next.js production server..." >> /home/z/my-project/dev-server.log
  node .next/standalone/server.js 2>>/home/z/my-project/dev-server.log
  EXIT_CODE=$?
  echo "[$(date)] Server exited with code $EXIT_CODE, restarting in 2s..." >> /home/z/my-project/dev-server.log
  sleep 2
done
