import path from "path";
import { ethers } from "hardhat";

import { saveContractAddress } from "@tonappchain/evm-ccl";
import { deployPurpleDapp } from "./deployPurpleDapp";



async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const { purpleDapp, purpleFactory } = await deployPurpleDapp(deployer);
    console.log("PurpleDapp deployed at:", await purpleDapp.getAddress());
    console.log("PurpleFactory deployed at:", await purpleFactory.getAddress());

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    saveContractAddress(addressesFilePath, 'PurpleDapp', await purpleDapp.getAddress());
    saveContractAddress(addressesFilePath, 'PurpleFactory', await purpleFactory.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});