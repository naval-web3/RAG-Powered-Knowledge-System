FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Dev server (bind to 0.0.0.0 so it is reachable from the host/container network)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
