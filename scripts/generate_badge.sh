#!/usr/bin/env bash
set -e

status=$(
  curl -s \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys?limit=1" |
    jq -r '.[0].deploy.status // "unknown"'
)

echo "Render deployment status: $status"

case "$status" in
  live)
    color="brightgreen";;
  created | build_in_progress | update_in_progress | pre_deploy_in_progress)
    color="blue";;
  deactivated)
    color="lightgrey";;
  build_failed | update_failed | pre_deploy_failed)
    color="red";;
  canceled)
    color="grey";;
  *)
    color="lightgrey";;
esac

label="${status//[_ ]/-}"

badge_url="https://img.shields.io/badge/Render-${label// /%20}-$color?logo=render&style=for-the-badge"
echo "$badge_url" > badge-url.txt
