docker_compose("./docker-compose.yml")

local_resource("tsc-compile", serve_cmd="cd server && npm run build:watch")

docker_build("node-app", "./server", 
    live_update = [
        sync("./server", "/home/node/app"),
        run("npm i", trigger="package.json"),
    ])

docker_build("client-app", "./client", 
    live_update = [
        sync("./client", "/home/node/app"),
        run("npm i", trigger="package.json"),
    ])
