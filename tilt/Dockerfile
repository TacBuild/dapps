# Use the same base image as the hardhat node for consistency
FROM node:20.11.1-alpine AS dapps-deployer-image

RUN apk add nano jq

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN chmod +x ./tilt/deploy.sh

# create and populate new .env from .env.tilt.p1 and .env.tilt.p2
RUN cat ./tilt/.env.tilt.p1 ./tilt/.env.tilt.p2 > .env

# Generate artifacts
RUN npx hardhat compile

ENTRYPOINT ["./tilt/deploy.sh"]
