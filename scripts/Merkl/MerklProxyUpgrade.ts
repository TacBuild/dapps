import { Signer } from "ethers";
import { MerklProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { merklDeployments } from "./config/TestnetConfigTurinV3";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeMerklProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("MerklProxy", signer);
    const merklProxy = await hre.upgrades.upgradeProxy(merklDeployments.merklProxy, factory, proxyOptsUUPS);
    await merklProxy.waitForDeployment();
    console.log("MerklProxy upgraded to:", merklProxy.target);
} 

export async function upgradeCustomMerklProxyEuler(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("CustomMerklProxyEuler", signer);
    const customMerklProxyEuler = await hre.upgrades.upgradeProxy(merklDeployments.customMerklProxyEuler, factory, proxyOptsUUPS);
    await customMerklProxyEuler.waitForDeployment();
    console.log("CustomMerklProxyEuler upgraded to:", customMerklProxyEuler.target);
} 

upgradeCustomMerklProxyEuler();