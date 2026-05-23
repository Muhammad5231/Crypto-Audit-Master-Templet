#!/bin/bash
cd /home/z/my-project
export HOSTNAME=0.0.0.0
export PORT=3000
exec bun run dev
