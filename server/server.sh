#!/bin/bash
cd $(cd $(dirname $0); pwd)
if [ "$NODE_ENV" == "docker" ]; then
    npm run wait_for_infra
fi
if [ "$NODE_ENV" == "dev" ]; then
    echo "In dev mode"
fi

CMD="npm -s run dist:run -- $@"
npx depcheck
if [ "$WATCH" == "yes" ]; then
    echo "**** Starting in watch mode."
    nodemon -w ./dist -e js,ts -x "$CMD || exit 0"
else
    echo "**** Staritng in normal mode..."
    $CMD
fi