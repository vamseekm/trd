FROM node:12-stretch-slim
RUN apt-get -y update && apt-get -y install htop psmisc
WORKDIR /home/node/app

COPY package.json .
RUN npm install
COPY . .
RUN rm -fr dist ; npm run build