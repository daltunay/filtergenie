#!/bin/sh
set -e

redis-server --daemonize yes

elapsed=0
while true; do
	if redis-cli ping | grep -q PONG; then
		break
	fi
	echo "Waiting for Redis... elapsed: ${elapsed}s"
	sleep 1
	elapsed=$((elapsed + 1))
done

exec fastapi run backend/app.py
