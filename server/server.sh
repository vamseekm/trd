#!/bin/sh
#npm run wait_for_redis
#npm run wait_for_db
cd $(cd $(dirname $0); pwd)
#npm run wait_for_db
#npm run wait_for_redis
npx tsc-watch --pretty --skipLibCheck --preserveWatchOutput -P tsconfig.json --onSuccess "node -r source-map-support/register ./dist/server/index.js $@"