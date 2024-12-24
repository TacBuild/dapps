import { ethers } from "hardhat";
import path from 'path';

import { saveContractAddress } from "tac-l2-ccl";


async function main() {
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const SimpleStorage = await ethers.getContractFactory("SimpleStorage");
    const simpleStorage = await SimpleStorage.deploy();

    const address = await simpleStorage.getAddress();

    saveContractAddress(addressesFilePath, 'simpleStorage', address);
    console.log("SimpleStorage deployed to: ", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
