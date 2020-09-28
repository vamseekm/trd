#!/bin/bash
cd $(cd $(dirname $0); pwd)
if [ "$NODE_ENV" == "docker" ]; then
    npm run wait_for_infra
fi
if [ "$NODE_ENV" == "dev" ]; then
    echo "In dev mode"
fi
NODE_ENV=dev npx tsc-watch --pretty --noClear -p . --onSuccess "npm -s run dist:prof:run -- $@"


