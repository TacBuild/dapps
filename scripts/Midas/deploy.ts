import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployMidasProxy } from './deployMidasProxy';
import { midasTestnetConfig } from "./config/testnetConfig";
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);


    const midasProxy = await deployMidasProxy(deployer, await tacSAFactory.getAddress(),midasTestnetConfig.depositVaultAddress, midasTestnetConfig.redemptionVaultAddress, await  tacContracts.crossChainLayer.getAddress());


    saveContractAddress(addressesFilePath, 'MidasProxy', await midasProxy.getAddress());

}


main();
