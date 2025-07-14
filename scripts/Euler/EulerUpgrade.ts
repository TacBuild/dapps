import { Signer } from "ethers";
import { EulerProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { eulerConfig } from "./EulerConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function upgradeEulerProxy(
): Promise<EulerProxy> {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("EulerProxy", signer);
    const eulerProxy = await hre.upgrades.upgradeProxy(eulerConfig.eulerProxyTestnetAddress, factory);
    await eulerProxy.waitForDeployment();
    return eulerProxy;
} 

upgradeEulerProxy();