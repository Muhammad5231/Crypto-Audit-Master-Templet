#!/bin/bash
cd /home/z/my-project
while true; do
  HOSTNAME=0.0.0.0 PORT=3000 bun .next/standalone/server.js 2>>/home/z/my-project/dev.log
  sleep 1
done
