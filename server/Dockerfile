FROM node:12-stretch-slim
RUN apt-get -y update && apt-get -y install htop procps
RUN npm i -g nodemon
WORKDIR /home/node/app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build