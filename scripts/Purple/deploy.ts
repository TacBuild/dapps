import path from "path";
import { Signer } from "ethers";
import hre, {ethers} from "hardhat";

import { deploy, saveContractAddress } from "@tonappchain/evm-ccl";

import { PurpleDapp, LpFactory, LpToken } from "../../typechain-types";

export async function deployPurpleDapp(
    deployer: Signer,
): Promise<{ purpleDapp: PurpleDapp, purpleFactory: LpFactory }> {
    const lpBlueprint = await deploy<LpToken>(deployer, hre.artifacts.readArtifactSync("LpToken"), []);
    const purpleDapp = await deploy<PurpleDapp>(deployer, hre.artifacts.readArtifactSync("PurpleDapp"), []);
    await purpleDapp.waitForDeployment();
    const purpleFactory = await deploy<LpFactory>(deployer, hre.artifacts.readArtifactSync("LpFactory"), [await purpleDapp.getAddress(), await lpBlueprint.getAddress()]);
    await purpleFactory.waitForDeployment();
    await purpleDapp.setLpFactory(await purpleFactory.getAddress());
    return { purpleDapp, purpleFactory };
}

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