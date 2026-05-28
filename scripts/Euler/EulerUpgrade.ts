import { Signer } from "ethers";
import { EulerProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { eulerConfig } from "./EulerConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeEulerProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("EulerProxy", signer);
    const eulerProxy = await hre.upgrades.upgradeProxy(eulerConfig.eulerProxyMainnetAddress, factory, proxyOptsUUPS);
    await eulerProxy.waitForDeployment();
    console.log("EulerProxy upgraded to:", eulerProxy.target);
    return eulerProxy;
} 

upgradeEulerProxy();