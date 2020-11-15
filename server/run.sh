#!/bin/sh
cd $(cd $(dirname $0); pwd)
NODE_ENV=dev node -r source-map-support/register dist/cli/index.js $@