# Use the same base image as the hardhat node for consistency
FROM node:20.11.1-alpine AS dapps-deployer-image

RUN apk add nano jq

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN chmod +x ./tilt/deploy.sh

# create and populate .env
# use .env file instead of container env for ability to change it on the fly w/o container rebuild
COPY ./tilt/.env.tilt .env

# Generate artifacts
RUN npx hardhat compile

ENTRYPOINT ["./tilt/deploy.sh"]
