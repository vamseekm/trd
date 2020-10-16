#!/bin/bash
cd $(cd $(dirname $0); pwd)
hash nodemon &> /dev/null && echo "" || npm i -g nodemon
nodemon -w server/src -e ts -x "pm2 startOrReload ecosystem.config.js --only $@ && pm2 log $@ || exit 0"