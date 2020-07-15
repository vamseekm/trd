#!/bin/bash
#npm run wait_for_redis
#npm run wait_for_db
npm run wait_for_db
npm run wait_for_redis
npx tsc-watch --pretty --skipLibCheck --preserveWatchOutput -P server/tsconfig.json --onSuccess "node -r source-map-support/register ./dist/server/index.js $@"