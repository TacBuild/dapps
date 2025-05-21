import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployMidasProxy } from './deployMidasProxy';
import { deployTacSAFactory } from '../TacSmartAccountFactory/FactoryDeploy';
import { deployTacSmartAccount } from '../TacSmartAccountFactory/SABlueprintDeploy';
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const tacSmartAccount = await deployTacSmartAccount(deployer);

    const tacSAFactory = await deployTacSAFactory(deployer, await tacSmartAccount.getAddress());

    const midasProxy = await deployMidasProxy(deployer, await tacSAFactory.getAddress(), await  tacContracts.crossChainLayer.getAddress());


    saveContractAddress(addressesFilePath, 'MidasSA', await tacSAFactory.getAddress());
    saveContractAddress(addressesFilePath, 'MidasProxy', await midasProxy.getAddress());

}


main();
