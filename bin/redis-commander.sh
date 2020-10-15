#!/bin/bash
hash redis-commander &> /dev/null && echo "" || npm i -g redis-commander
exec redis-commander