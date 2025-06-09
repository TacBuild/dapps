import { Signer } from "ethers";
import { TacSAFactory } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { tacSAFactoryDeployments } from "./config/testnetConfig";


export async function upgradeTacSmartAccount(newBlueprint: string) {
    const [signer] = await hre.ethers.getSigners();
    const tacSAFactory = await hre.ethers.getContractAt("TacSAFactory", tacSAFactoryDeployments.proxyAddress);
    await tacSAFactory.updateBlueprint(newBlueprint);
    console.log("TacSmartAccountFactory blueprint set to:", newBlueprint);
}