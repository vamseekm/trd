#!/bin/bash
npm run wait_for_db
npx tsc-watch --pretty --preserveWatchOutput -P server/tsconfig.json --onSuccess "node -r source-map-support/register ./dist/server/index.js $@",