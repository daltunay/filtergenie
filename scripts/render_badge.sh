#!/usr/bin/env bash
set -e

status=$(
  curl -s \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $RENDER_API_KEY" \
    "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys?limit=1" |
    jq -r '.[0].deploy.status // "unknown"'
)

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
encoded_label=$(printf '%s' "$label" | jq -sRr @uri)

badge_url="https://img.shields.io/badge/render-${encoded_label}-$color?logo=render&style=for-the-badge"
echo "$badge_url"
