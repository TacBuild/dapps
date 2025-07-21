import hre, { ethers } from 'hardhat';
import { saveContractAddress } from '@tonappchain/evm-ccl';
import { mainnetConfig, testnetConfig } from './config';
import { deployWTACConverterProxy } from './deployWTACConverterProxy';
import { WTACConverterProxy } from '../../typechain-types';

import path from 'path';

async function main(): Promise<void> {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const network = hre.network.name;

    const addressesFilePath = path.join(__dirname, `./addresses_${network}.json`);

    let config;

    if (network === 'tac_mainnet') {
        config = mainnetConfig;
    } else if (network === 'tac_testnet_spb') {
        config = testnetConfig;
    } else {
        throw new Error(`Unsupported network: ${network}`);
    }


    const wTACConverterProxy: WTACConverterProxy = await deployWTACConverterProxy(
        deployer,
        config
    );

    console.log(`WTACConverterProxy deployed to: ${await wTACConverterProxy.getAddress()} at network ${network}`);
    saveContractAddress(addressesFilePath, 'wTACConverterProxy', await wTACConverterProxy.getAddress());
}

main();