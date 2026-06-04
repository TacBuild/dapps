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
    const eulerProxyImpl = await hre.upgrades.deployImplementation(factory, proxyOptsUUPS)
    console.log("EulerProxy implementation deployed to:", eulerProxyImpl);
    return eulerProxyImpl;
} 