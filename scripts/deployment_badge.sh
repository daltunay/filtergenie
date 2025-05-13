#!/bin/bash
set -e

GITHUB_TOKEN="${GITHUB_TOKEN:?GITHUB_TOKEN is not set}"

deployment_id=$(
  curl -s \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    "https://api.github.com/repos/daltunay/filtergenie/deployments?task=deploy&per_page=1" |
    jq -r '.[0].id // empty'
)

if [[ -z "$deployment_id" ]]; then
  exit 1
fi

status=$(
  curl -s \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    "https://api.github.com/repos/daltunay/filtergenie/deployments/$deployment_id/statuses?per_page=1" |
    jq -r '.[0].state // "unknown"'
)

case "$status" in
  success)
    color="brightgreen";;
  in_progress | queued | pending)
    color="blue";;
  inactive)
    color="lightgrey";;
  error | failure)
    color="red";;
  *)
    color="lightgrey";;
esac

label="$status"
label="${label//_/ }"
encoded_label=$(printf '%s' "$label" | jq -sRr @uri)

badge_url="https://img.shields.io/badge/deployment-${encoded_label}-$color?logo=github"
echo "$badge_url"
