#!/bin/sh

# exit with err is smth fails
set -e

# parse cli args to find useTilt flag
useTilt=false
for arg in "$@"; do
  case $arg in
    --useTilt)
      useTilt=true
      shift
      ;;
  esac
done

if [ "$useTilt" = false ]; then
  # use env vars from local ".env" file
  set -a
  . .env
  set +a

  NETWORK=""
  if [ -z "$DEPLOY_ENV" ]; then
      echo "DEPLOY_ENV undefined in .env"
      exit 1
  elif [ "$DEPLOY_ENV" = "localhost" ]; then
      NETWORK="localhost"
  elif [ "$DEPLOY_ENV" = "testnet" ]; then
      NETWORK="tac_testnet"
  elif [ "$DEPLOY_ENV" = "mainnet" ]; then
      NETWORK="tac_mainnet"
  fi
  npx hardhat --network "$NETWORK" run ./scripts/UniswapV2/deploy.ts
  echo "------------------DEPLOY FINISHED------------------"

elif [ "$useTilt" = true ]; then
  cp /usr/src/app/shared/addresses_l2.json /usr/src/app/addresses.json
  npx hardhat --network localhost run ./scripts/UniswapV2/deploy.ts
  cp addresses.json /usr/src/app/shared/addresses_dapps.json
  touch /tmp/DEPLOY_FINISHED
  echo "------------------DEPLOY FINISHED------------------"
  tail -f /dev/null
fi
