# 1) build the base
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install

# 2) build the app 
FROM base AS build
WORKDIR /app
RUN npm run build

# 3) production
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /app/build ./

CMD ["node", "main.js"]