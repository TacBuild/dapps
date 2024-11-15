#!/bin/sh

# Function to update .env, .env.tilt.dapps file from parsed addresses.json. If a var exists, it is updated, created otherwise
update_env_var() {
    VAR_NAME=$1
    VAR_VALUE=$2

    # .env
    if grep -q "^$VAR_NAME=" .env; then
        sed -i "s/^$VAR_NAME=.*/$VAR_NAME=$VAR_VALUE/" .env
    else
        echo "$VAR_NAME=$VAR_VALUE" >> .env
    fi

    # .env.tilt.dapps
    if grep -q "^$VAR_NAME=" .env.tilt.dapps; then
        sed -i "s/^$VAR_NAME=.*/$VAR_NAME=$VAR_VALUE/" .env.tilt.dapps
    else
        echo "$VAR_NAME=$VAR_VALUE" >> .env.tilt.dapps
    fi
}

append_weth_and_tokens_to_env() {
    ADDRESSES=$(cat ./addresses.json)

    # wETH
    VAR1=$(echo $ADDRESSES | jq -r .wETH)
    update_env_var "EVM_WETH_ADDRESS" "$VAR1"

    # stTON (will be TKA)
    VAR2=$(echo $ADDRESSES | jq -r .stTON)
    update_env_var "EVM_TKA_ADDRESS" "$VAR2"

    # TAC (will be TKB)
    VAR3=$(echo $ADDRESSES | jq -r .TAC)
    update_env_var "EVM_TKB_ADDRESS" "$VAR3"
}

append_uniswap_to_env() {
    ADDRESSES=$(cat ./addresses.json)
    VAR1=$(echo $ADDRESSES | jq -r .UniswapV2Factory)
    update_env_var "UNISWAPV2_FACTORY_ADDRESS" "$VAR1"
    VAR2=$(echo $ADDRESSES | jq -r .UniswapV2Router02)
    update_env_var "UNISWAPV2_ROUTER02_ADDRESS" "$VAR2"
    VAR3=$(echo $ADDRESSES | jq -r .UniswapV2Proxy)
    update_env_var "UNISWAPV2_PROXY_ADDRESS" "$VAR3"
}

# .env.tilt.dapps is later needed for sequencer as manual.json
touch .env.tilt.dapps

npm run deploy-weth-token
npm run deploy-stton
npm run deploy-tac
append_weth_and_tokens_to_env

# wETH and tokens are needed for Uniswap
npm run uniswap-deploy
append_uniswap_to_env

npm run uniswap-addliq

# Create a signal file to indicate the deploy script is done
touch /tmp/deploy_done

# Keep container running
sleep infinity
