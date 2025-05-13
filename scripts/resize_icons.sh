#!/bin/bash

cd extension/assets/icons

magick icon.png -resize 16x16 icon16.png
magick icon.png -resize 32x32 icon32.png
magick icon.png -resize 48x48 icon48.png
magick icon.png -resize 128x128 icon128.png

echo "Icons resized successfully!"
