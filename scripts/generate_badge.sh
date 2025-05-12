#!/usr/bin/env bash
set -e

status=$(curl -s -H "Accept: application/json" -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys?limit=1" \
  | jq -r '.[0].deploy.status // "unknown"')

echo "Render deployment status: $status"

case "$status" in
  succeeded)
    label="Live"; color="brightgreen";;
  failed)
    label="Failed"; color="red";;
  in_progress)
    label="Deploying"; color="blue";;
  canceled)
    label="Canceled"; color="grey";;
  *)
    label="Unknown"; color="lightgrey";;
esac

badge_url="https://img.shields.io/badge/Render-${label// /%20}-$color?logo=render&style=for-the-badge"
echo "$badge_url" > badge-url.txt
