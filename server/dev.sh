#! /bin/bash
NODE_ENV=dev npx tsc-watch --pretty --noClear -p . --onSuccess "node -r source-map-support/register dist/cli/index.js $@"
