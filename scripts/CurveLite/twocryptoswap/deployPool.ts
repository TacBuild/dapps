import hre, { ethers } from 'hardhat';
import factoryAbi from "./factoryAbi.json"
import {deployPoolTwocryptoswap} from "./deployPoolTwocryptoswap"



async function main(tokenAddress1: string, tokenAddress2: string, name: string, symbol: string) {
    const pool = await deployPoolTwocryptoswap(tokenAddress1, tokenAddress2, name, symbol)
    console.log(pool)
}


main(
    '0x40d02AAe9D294Ebefe818Bc9020a9883E055154e',
    '0x2183Bb115F6f90840B1d6FEd0857149546e4BF22',
    'TEST',
    'TEST',
);
