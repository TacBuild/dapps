# Use the same base image as the hardhat node for consistency
FROM node:20.11.1-alpine AS dapps-deployer-image

ARG SEQUENCER_PRIVATE_KEY_EVM

RUN apk add nano jq dos2unix

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN dos2unix ./tilt/deploy.sh

RUN chmod +x ./tilt/deploy.sh

# Set the build argument as an environment variable, needed for compile command bcs of hardhat.config.ts
ENV SEQUENCER_PRIVATE_KEY_EVM=${SEQUENCER_PRIVATE_KEY_EVM}

# Generate artifacts
RUN npx hardhat compile

ENTRYPOINT ["./tilt/deploy.sh"]
