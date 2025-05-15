import { Signer } from "ethers";
import { MorphoProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { morphoProxyDeployments } from "./config/testnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function upgradeMorphoProxy(
): Promise<MorphoProxy> {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("MorphoProxy", signer);
    const morphoProxy = await hre.upgrades.upgradeProxy(morphoProxyDeployments.proxyAddress, factory);
    await morphoProxy.waitForDeployment();
    return morphoProxy;
} 

upgradeMorphoProxy();