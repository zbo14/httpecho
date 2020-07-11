FROM node:12.18.2-alpine

ARG secure

COPY . /app

WORKDIR /app

RUN apk update && \
    apk upgrade && \
    npm i --production

ENTRYPOINT sh entrypoint.sh $secure
