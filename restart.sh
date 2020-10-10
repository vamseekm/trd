
docker-compose down --remove-orphans
docker system prune -f
docker run --privileged --pid=host docker/desktop-reclaim-space
tilt up --stream
