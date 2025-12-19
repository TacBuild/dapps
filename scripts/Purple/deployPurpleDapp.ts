
import { Signer } from "ethers";
import hre from "hardhat";
import { deploy } from "@tonappchain/evm-ccl";
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