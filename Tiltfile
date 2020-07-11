docker_compose("./docker-compose.yml")
docker_build("node-app", ".", 
    live_update = [
        sync(".", "/home/node/app"),
        run("npm i", trigger="package.json")
    ])