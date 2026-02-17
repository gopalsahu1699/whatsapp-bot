#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Pre-install Puppeteer's Chrome for Render (Local Path)
# This ensures the browser is uploaded with the build
PUPPETEER_CACHE_DIR=./.puppeteer-cache npx puppeteer browsers install chrome

echo "Build finished successfully!"
