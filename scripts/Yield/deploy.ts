import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployYieldProxy } from './deployProxy';
import { deployTacSAFactory } from '../TacSmartAccountFactory/FactoryDeploy';
import { deployTacSmartAccount } from '../TacSmartAccountFactory/SABlueprintDeploy';

import { yiedTestnetConfig } from "./config/testnetConfig";
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const tacSmartAccount = await deployTacSmartAccount(deployer);

    const tacSAFactory = await deployTacSAFactory(deployer, await tacSmartAccount.getAddress());

    const yieldManagerProxy = await deployYieldProxy(deployer, yiedTestnetConfig.managerAddress, await tacSAFactory.getAddress(), await  tacContracts.crossChainLayer.getAddress());


    saveContractAddress(addressesFilePath, 'YieldSA', await tacSAFactory.getAddress());
    saveContractAddress(addressesFilePath, 'YieldProxy', await yieldManagerProxy.getAddress());

}


main();
