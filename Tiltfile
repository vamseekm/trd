docker_compose("./docker-compose.yml")

local_resource("tsc-compile", serve_cmd="cd server && npm run build:watch")

docker_build("node-app", "./server", 
    live_update = [
        sync("./server", "/home/node/app"),
        run("npm i", trigger="package.json"),
    ])

docker_build("client-server", "./client", 
    live_update = [
        sync("./client", "/home/node/app"),
        run("npm i", trigger="package.json"),
    ])

docker_build("nginx", "./conf/nginx", 
    live_update = [
        sync("reverse_proxy.conf", "/etc/nginx/conf.d/reverse_proxy.conf"),
    ])
