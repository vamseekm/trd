#!/bin/bash
npx tsc-watch --pretty --preserveWatchOutput -P server/tsconfig.json --onSuccess "node -r source-map-support/register ./dist/server/index.js $@",