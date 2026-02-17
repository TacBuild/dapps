import { Signer } from "ethers";
import { MorphoProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { morphoMainnetProxyDeployments } from "./config/mainnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeMorphoProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("MorphoProxy", signer);
    const morphoProxyImpl = await hre.upgrades.deployImplementation(factory, proxyOptsUUPS)
    console.log("MorphoProxy implementation deployed to:", morphoProxyImpl);
} 

upgradeMorphoProxy();

//impl addr 0xc2850566e05DA2A18d2C3B47fd2046d8744e72E2