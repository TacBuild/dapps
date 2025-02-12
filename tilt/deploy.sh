#!/bin/sh
export $(grep -v '^#' .env | xargs)

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
npx hardhat --network $NETWORK run ./scripts/common/depositTAC.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/deploy.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidityWithNative.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/swapExactTokensForETH.ts
npx hardhat --network $NETWORK run ./scripts/UniswapV2/addLiquidity.ts
npx hardhat --network $NETWORK run ./scripts/common/deploySimpleStorage.ts

echo "------------------DEPLOY FINISHED------------------"
# Keep container running
sleep infinity
