docker_compose("./docker-compose.yml")
docker_build("node-app", "./server",
    live_update = [
        sync("./server", "/home/node/app"),
        run("npm i", trigger="package.json"),
    ])
