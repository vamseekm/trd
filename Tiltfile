docker_compose("./docker-compose.yml")
docker_build("node-app-v2", ".",
    live_update = [
        sync(".", "/home/node/app"),
        run("npm i", trigger="package.json")
    ])
