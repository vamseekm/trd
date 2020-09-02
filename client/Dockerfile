FROM node:14-stretch-slim
RUN apt-get -y update && apt-get -y install htop psmisc curl
RUN npm i -g nodemon
WORKDIR /home/node/app
COPY package.json .
RUN npm install
COPY . .
