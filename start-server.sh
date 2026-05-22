#!/bin/bash
cd /home/z/my-project
while true; do
  HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js
  echo "Server died, restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
