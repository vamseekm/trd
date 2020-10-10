#!/bin/bash
cd $(cd $(dirname $0)/..; pwd)
caddy run -config conf/etc/caddy/Caddyfile
