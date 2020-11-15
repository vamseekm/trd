#! /bin/bash
cd $(cd $(dirname $0); pwd)
npx tsc-watch --pretty --noClear -p . --onSuccess "./run.sh $@"
