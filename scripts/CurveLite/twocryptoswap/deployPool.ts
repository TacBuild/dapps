import hre, { ethers } from 'hardhat';
import factoryAbi from "./factoryAbi.json"
import {deployPoolTwocryptoswap} from "./deployPoolTwocryptoswap"



async function main(tokenAddress1: string, tokenAddress2: string, name: string, symbol: string) {
    const pool = await deployPoolTwocryptoswap(tokenAddress1, tokenAddress2, name, symbol)
}


main(
    'addr1',
    'addr2',
    'stTON-TAC-v2',
    'STTONTAC2',
);
