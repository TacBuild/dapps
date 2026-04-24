import { Signer } from "ethers";
import { LucidlyVaultProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeLucidlyVaultProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("LucidlyVaultProxy", signer);
    const lucidlyVaultProxy = await hre.upgrades.upgradeProxy("0xf07ae611B14666d6e5fA7eC52F72f8dA727AD8d8", factory, proxyOptsUUPS);
    await lucidlyVaultProxy.waitForDeployment();
    console.log("LucidlyVaultProxy upgraded to:", lucidlyVaultProxy.target);
} 

upgradeLucidlyVaultProxy();