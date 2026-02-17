#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
npm install

# Pre-install Puppeteer's Chrome for Render
npx puppeteer browsers install chrome

echo "Build finished successfully!"
