#!/bin/bash

set -e
cd "$(dirname "$0")/../../extension/assets/icons"

sizes=(16 32 48 128)
for size in "${sizes[@]}"; do
  convert icon.png -resize ${size}x${size} icon${size}.png
done

echo "Icons resized successfully!"
