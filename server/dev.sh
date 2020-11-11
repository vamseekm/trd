#! /bin/bash
npx tsc-watch --pretty --noClear -p . --onSuccess "./run.sh $@"
