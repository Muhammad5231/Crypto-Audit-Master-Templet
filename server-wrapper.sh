#!/bin/bash
cd /home/z/my-project
export HOSTNAME=0.0.0.0
export PORT=3000

# Trap all signals and log them
trap 'echo "Received SIGHUP at $(date)" >> /home/z/my-project/server-signals.log' HUP
trap 'echo "Received SIGINT at $(date)" >> /home/z/my-project/server-signals.log' INT
trap 'echo "Received SIGTERM at $(date)" >> /home/z/my-project/server-signals.log' TERM
trap 'echo "Received SIGUSR1 at $(date)" >> /home/z/my-project/server-signals.log' USR1
trap 'echo "Received SIGUSR2 at $(date)" >> /home/z/my-project/server-signals.log' USR2

echo "Server wrapper started at $(date), PID=$$" >> /home/z/my-project/server-signals.log

# Start the server
node .next/standalone/server.js 2>>/home/z/my-project/server-error.log
EXIT_CODE=$?
echo "Server exited with code $EXIT_CODE at $(date)" >> /home/z/my-project/server-signals.log
