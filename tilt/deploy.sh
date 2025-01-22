#!/bin/sh

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

npx hardhat --network $NETWORK run ./scripts/depositTac.ts
npx hardhat --network $NETWORK run ./scripts/common/deployStTON.ts
sleep 10
npx hardhat --network $NETWORK run ./scripts/common/deployTAC.ts
sleep 10
npx hardhat --network $NETWORK run ./scripts/UniswapV2/deploy.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidityWithNative.ts
sleep 10
npx hardhat --network $NETWORK run ./scripts/UniswapV2/swapExactTokensForETH.ts
sleep 10
npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidity.ts
npx hardhat --network $NETWORK run ./scripts/common/deploySimpleStorage.ts
echo "------------------DEPLOY FINISHED------------------"
# Keep container running
sleep infinity
