#!/bin/sh
set -e

redis-server --daemonize yes

while true; do
	if redis-cli ping | grep -q PONG; then
		break
	fi
	sleep 1
done

exec env CACHE_ENABLED="${CACHE_ENABLED}" fastapi run backend/app.py
