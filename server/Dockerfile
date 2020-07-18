FROM node:12-alpine3.12
RUN apk update && apk add htop
WORKDIR /home/node/app

COPY package.json .
RUN npm install
COPY . .
RUN npm run build