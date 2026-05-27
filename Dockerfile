FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm install --workspaces

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
