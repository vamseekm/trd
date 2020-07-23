#!/bin/bash
cd $(cd $(dirname $0); pwd)
if [ "$NODE_ENV" == "docker" ]; then
    npm run wait_for_infra
fi
if [ "$NODE_ENV" == "dev" ]; then
    echo "In dev mode"
fi

CMD="npm -s run dist:run -- $@"

if [ "$WATCH" == "yes" ]; then
    echo "**** Starting watch mode."
    nodemon -w ./dist -e js -x "$CMD || exit 0"
else
    echo "**** Staritng in normal mode..."
    $CMD
fi