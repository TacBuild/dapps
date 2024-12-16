#!/bin/sh

export $(cat .env | xargs)

NETWORK=""

if [[ -z $DEPLOY_ENV ]]; then
    echo "DEPLOY_ENV undefined in env"
    exit 1
elif [[ $DEPLOY_ENV == "localhost" ]]; then
    NETWORK="localhost"
elif [[ $DEPLOY_ENV == "testnet" ]]; then
        NETWORK="tac_testnet"
elif [[ $DEPLOY_ENV == "mainnet" ]]; then
    NETWORK="tac_mainnet"
fi
w
npx hardhat --network $NETWORK run ./scripts/Faucet/deploy.ts 
npx hardhat --network $NETWORK run ./scripts/Faucet/mint.ts 
npx hardhat --network $NETWORK run ./scripts/Faucet/burn.ts 

# npx hardhat --network $NETWORK run ./scripts/common/deployStTON.ts
# npx hardhat --network $NETWORK run ./scripts/common/deployTAC.ts
# npx hardhat --network $NETWORK run ./scripts/UniswapV2/deploy.ts
# npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidity.ts

echo "------------------DEPLOY FINISHED------------------"

# Keep container running
sleep infinity
