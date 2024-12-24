#!/bin/sh

# you can use this script to deploy dapps 1) on tacchain from your local machine 2) on local node with tilt
# for case 1) populate your .env before running, for case 2) next command won't make anything
export $(cat .env | xargs)

NETWORK=""

if [ -z "$DEPLOY_ENV" ]; then
    echo "DEPLOY_ENV undefined in env"
    exit 1
elif [ "$DEPLOY_ENV" = "localhost" ]; then
    NETWORK="localhost"
elif [ "$DEPLOY_ENV" = "testnet" ]; then
        NETWORK="tac_testnet"
elif [ "$DEPLOY_ENV" = "mainnet" ]; then
    NETWORK="tac_mainnet"
fi

npx hardhat --network $NETWORK run ./scripts/common/deployStTON.ts
npx hardhat --network $NETWORK run ./scripts/common/deployTAC.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/deploy.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidity.ts
npx hardhat --network $NETWORK run ./scripts/common/deploySimpleStorage.ts

echo "------------------DEPLOY FINISHED------------------"

# Keep container running
sleep infinity
