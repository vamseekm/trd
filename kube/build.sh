#!/bin/bash
cd $(cd $(dirname $0)/..; pwd)
#(cd server && npm run build)
docker image build -t 192.168.1.10:32000/trd-server ./server
docker push 192.168.1.10:32000/trd-server

docker image build -t 192.168.1.10:32000/trd-client ./client
docker push 192.168.1.10:32000/trd-client

