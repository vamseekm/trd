#!/bin/bash
cd $(cd $(dirname $0); pwd)
#npm run wait_for_redis
#npm run wait_for_db
NODE_ENV=dev npx tsc-watch --pretty --preserveWatchOutput -P server/tsconfig.json --onSuccess "node -r source-map-support/register ./dist/server/index.js $@"