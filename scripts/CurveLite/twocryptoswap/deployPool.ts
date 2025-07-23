import hre, { ethers } from 'hardhat';
import factoryAbi from "./factoryAbi.json"
import { deployPoolTwocryptoswap } from "./deployPoolTwocryptoswap"
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';


const TON_ADDRESS = "0xb5d9b465f55af00C60bbE0E7fD1360ba5a307036"

const poolPresetParams = {
    implementation_id: 0,
    A: 20000000n,
    gamma: 1000000000000000n,
    mid_fee: 5000000n,
    out_fee: 45000000n,
    fee_gamma: 5000000000000000n,
    allowed_extra_profit: 10000000000n,
    adjustment_step: 5500000000000n,
    ma_exp_time: 866n,
    initial_price: 10n ** 18n
}

async function main(tokenA: any, tokenB: any) {
    const addressesFilePath = path.resolve(__dirname, '../../../addresses.json');


    const name = tokenA.tokenSymbol + '_' + tokenB.tokenSymbol
    const poolParams = poolPresetParams

    const tokenValue1 = Number(Number(tokenA.tokenValue)/(10**Number(tokenA.decimals)))
    const tokenValue2 = Number(Number(tokenB.tokenValue)/(10**Number(tokenB.decimals)))
    poolParams.initial_price = BigInt(Math.round( tokenValue1/tokenValue2  * 10**18));

    console.log(poolParams.initial_price)
    if(poolParams.initial_price >= 10n ** 30n) {
        poolParams.initial_price = 10n ** 30n - 1n
    }
    if(poolParams.initial_price <= 10n ** 6n) {
        poolParams.initial_price = 10n ** 6n + 1n
    }
    const pool = await deployPoolTwocryptoswap(tokenA.tokenAddress, tokenB.tokenAddress, name, name, poolParams)
    console.log(name)
    console.log(pool)
    saveContractAddress(addressesFilePath, name, pool);


}



main({
        "tokenName": "LADA",
        "tokenSymbol": "LADA",
        "decimals": 9n,
        "tokenValue": 1n,
        "tokenAddress": "0x0FACa06594C8d5Bd9eA61D2bb68C0B3676674563"
    },
    {
        "tokenName": "BMW",
        "tokenSymbol": "BMW",
        "decimals": 9n,
        "tokenValue": 1n,
        "tokenAddress": "0x057B5219486e8cbDfef65a0f090ad72b2D8Fc81D"
    });
