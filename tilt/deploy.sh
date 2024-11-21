#!/bin/sh

export $(cat .env | xargs)

NETWORK=""

if [[ -z $DEPLOY_ENV ]]; then
    echo "DEPLOY_ENV undefined in .env"
    exit 1
elif [[ $DEPLOY_ENV == "localhost" ]]; then
    NETWORK="localhost"
elif [[ $DEPLOY_ENV == "testnet" ]]; then
        NETWORK="tac_testnet"
elif [[ $DEPLOY_ENV == "mainnet" ]]; then
    NETWORK="tac_mainnet"
fi

echo "Deploying UniswapV2Proxy to $NETWORK"

# Function to update .env, .env.tilt.dapps file from parsed addresses.json. If a var exists, it is updated, created otherwise

# .env.tilt.dapps is later needed for sequencer as manual.json
# touch .env.tilt.dapps

npx hardhat --network $NETWORK run ./scripts/common/deployStTON.ts
npx hardhat --network $NETWORK run ./scripts/common/deployTAC.ts

npx hardhat --network $NETWORK run ./scripts/UniswapV2/deploy.ts

npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidity.ts

# Create a signal file to indicate the deploy script is done
touch /tmp/deploy_done

# Keep container running
sleep infinity
