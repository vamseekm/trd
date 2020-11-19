#!/bin/bash
cd $(cd $(dirname $0); pwd)
hash nodemon &> /dev/null && echo "" || npm i -g nodemon
pm2 stop $@
pm2 delete $@
nodemon -w server/src -e ts -x "pm2 startOrReload ecosystem.config.js --only $@ && pm2 log $@ || exit 0"
#pm2 startOrReload ecosystem.config.js --only $@