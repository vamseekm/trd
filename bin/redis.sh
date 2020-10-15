#!/bin/bash
# exec redis-server ./conf/redis.conf
REDIS_DATA_DIR="$HOME/tmp/redis"
mkdir -p $REDIS_DATA_DIR
echo "
dir $REDIS_DATA_DIR
dbfilename dump.rdb
save 60 1
" | exec redis-server