# base con Node 20
FROM node:20-alpine
WORKDIR /app

# cache de dependencias: solo se reinstala si cambian estos dos archivos
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-scripts

COPY . .
RUN yarn build

EXPOSE 3000 3001
CMD ["node", "dist/main"]