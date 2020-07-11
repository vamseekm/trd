FROM node:lts-buster-slim
WORKDIR /home/node/app

COPY package.json .
RUN npm install
COPY . .