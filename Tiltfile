docker_compose("./docker-compose.yml")

#local_resource("tsc-compile", serve_cmd="cd server && npm run build:watch")

docker_build("c_server_img", "./server", 
    live_update = [
        fall_back_on(["./server/package.json", "./server/config", "./server/server.sh"]),
        sync("./server", "/home/node/app")
    ])

docker_build("c_client_server", "./client", 
    live_update = [
        fall_back_on("./client/package.json"),
        sync("./client", "/home/node/app")
    ])