import { ethers } from 'hardhat';
import { deployZerolendPoolProxy } from './deployProxy';

import { zerolandPoolConfigMainnet } from "./config/ZerolendConfig";
import { mainnetConfig } from "../config/mainnetConfig";

async function main() {
    const [deployer] = await ethers.getSigners();
    const zerolendPoolProxy = await deployZerolendPoolProxy(deployer, zerolandPoolConfigMainnet.appAddress, mainnetConfig.tacSAFactoryAddress, mainnetConfig.crosschainLayerAddress);
    console.log(await zerolendPoolProxy.getAddress());
}

main();
