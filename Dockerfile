FROM node:20-alpine
WORKDIR /usr/src/app
COPY .env ./
COPY deploy.zip ./
RUN unzip deploy.zip
RUN yarn install --production
EXPOSE 3333
CMD ["yarn", "start"]
