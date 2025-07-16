import { Signer } from "ethers";
import { TacSAFactory } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { tacSAFactoryDeployments } from "./config/testnetConfig";
import { deployTacSmartAccount } from "./SABlueprintDeploy";


export async function upgradeTacSmartAccount(newBlueprint: string) {
    const [signer] = await hre.ethers.getSigners();
    const tacSAFactory = await hre.ethers.getContractAt("TacSAFactory", tacSAFactoryDeployments.proxyAddress);
    await tacSAFactory.connect(signer).updateBlueprint(newBlueprint);
    console.log("TacSmartAccountFactory blueprint set to:", newBlueprint);
}

async function main() {
    const [signer] = await hre.ethers.getSigners();
    const tacSmartAccount = await deployTacSmartAccount(signer);
    console.log("TacSmartAccount deployed to:", tacSmartAccount.target);
    await upgradeTacSmartAccount(await tacSmartAccount.getAddress());
}

main();