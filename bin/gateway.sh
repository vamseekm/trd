#!/bin/bash
cd $(cd $(dirname $0)/..; pwd)
exec caddy run -config conf/etc/caddy/Caddyfile
