#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Pre-install Puppeteer's Chrome if needed
# npx puppeteer browsers install chrome

echo "Build finished successfully!"
