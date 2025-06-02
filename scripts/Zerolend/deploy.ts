import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployZerolendPoolProxy } from './deployProxy';
import { deployTacSAFactory } from '../TacSmartAccountFactory/FactoryDeploy';
import { deployTacSmartAccount } from '../TacSmartAccountFactory/SABlueprintDeploy';

import { ZerolendPoolConfig } from "./config/ZerolendConfig";
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const tacSmartAccount = await deployTacSmartAccount(deployer);

    const tacSAFactory = await deployTacSAFactory(deployer, await tacSmartAccount.getAddress());

    const zerolendPoolProxy = await deployZerolendPoolProxy(deployer, await tacSAFactory.getAddress(), await  tacContracts.crossChainLayer.getAddress());


    saveContractAddress(addressesFilePath, 'ZerolendSA', await tacSAFactory.getAddress());
    saveContractAddress(addressesFilePath, 'ZerolendPoolProxy', await zerolendPoolProxy.getAddress());

}


main();
