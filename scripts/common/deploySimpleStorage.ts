import { BaseContract, ContractFactory } from 'ethers';
import { ethers } from "hardhat";
import path from 'path';
import simpleStorageArtifact from '../../artifacts/contracts/test/SimpleStorage.sol/SimpleStorage.json';

import { saveContractAddress } from "tac-l2-ccl";


async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const simpleStorageFactory = new ContractFactory(simpleStorageArtifact.abi, simpleStorageArtifact.bytecode, deployer);
    const simpleStorage = (await simpleStorageFactory.deploy()) as BaseContract;
    const address = await simpleStorage.getAddress();
    saveContractAddress(addressesFilePath, 'simpleStorage', address);
    console.log("SimpleStorage deployed to: ", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
