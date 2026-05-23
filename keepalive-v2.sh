#!/bin/bash
cd /home/z/my-project
export HOSTNAME=0.0.0.0
export PORT=3000

LOG=/home/z/my-project/keepalive.log
echo "$(date): Keepalive wrapper started" >> $LOG

while true; do
  echo "$(date): Starting production server..." >> $LOG
  node .next/standalone/server.js >> $LOG 2>&1
  EXIT_CODE=$?
  echo "$(date): Server exited with code $EXIT_CODE, restarting in 1s..." >> $LOG
  sleep 1
done
