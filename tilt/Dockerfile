# Use the same base image as the hardhat node for consistency
FROM node:22-alpine AS dapps-deployer-image

RUN apk add nano jq dos2unix

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN dos2unix ./tilt/deploy.sh

RUN chmod +x ./tilt/deploy.sh

# Generate artifacts
RUN npx hardhat compile

ENTRYPOINT ["./tilt/deploy.sh", "--useTilt"]
