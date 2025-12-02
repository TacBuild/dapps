import { Signer } from "ethers";
import { MerklProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeOrbsProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("OrbsProxy", signer);
    const orbsProxy = await hre.upgrades.upgradeProxy("0xaD809718714905344669E2C5150a33b21c35C53E", factory, proxyOptsUUPS);
    await orbsProxy.waitForDeployment();
    console.log("OrbsProxy upgraded to:", orbsProxy.target);
} 

upgradeOrbsProxy();