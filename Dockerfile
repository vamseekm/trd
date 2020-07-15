FROM node:lts-buster-slim
RUN apt-get -y update
RUN apt-get -y install htop
WORKDIR /home/node/app

COPY package.json .
RUN npm install
COPY . .