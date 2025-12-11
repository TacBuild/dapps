import { deploy } from "@tonappchain/evm-ccl";
import { PurpleDapp, LpFactory, LpToken } from "../../typechain-types";
import hre from "hardhat";
import { Signer } from "ethers";

export async function deployPurpleDapp(
    deployer: Signer,
): Promise<{ purpleDapp: PurpleDapp, purpleFactory: LpFactory }> {
    
    const lpBlueprint = await deploy<LpToken>(deployer, hre.artifacts.readArtifactSync("LpToken"), []);
    const purpleDapp = await deploy<PurpleDapp>(deployer, hre.artifacts.readArtifactSync("PurpleDapp"), []);
    await purpleDapp.waitForDeployment();
    const purpleFactory = await deploy<LpFactory>(deployer, hre.artifacts.readArtifactSync("LpFactory"), [await purpleDapp.getAddress(), await lpBlueprint.getAddress()]);
    await purpleFactory.waitForDeployment();
    await purpleDapp.setLpFactory(await purpleFactory.getAddress());
    console.log("PurpleDapp deployed to:", purpleDapp.target);
    return { purpleDapp, purpleFactory };
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const { purpleDapp, purpleFactory } = await deployPurpleDapp(deployer);
    console.log("PurpleDapp deployed to:", await purpleDapp.getAddress());
    console.log("PurpleFactory deployed to:", await purpleFactory.getAddress());
}

// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });