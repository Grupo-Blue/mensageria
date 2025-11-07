FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY . .
RUN yarn build

ENV NODE_ENV=production

EXPOSE 3333
CMD ["yarn", "start"]
