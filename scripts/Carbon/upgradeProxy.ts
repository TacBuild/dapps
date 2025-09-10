import { Signer } from "ethers";
import { EulerProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { carbonMainnetConfig } from "./config/mainnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeCarbonProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("CarbonProxy", signer);
    const carbonProxy = await hre.upgrades.upgradeProxy("0xd68eFC6C132315123634777F5BA52aAD6B0292C1", factory, proxyOptsUUPS);
    await carbonProxy.waitForDeployment();
    console.log("CarbonProxy upgraded to:", carbonProxy.target);
} 

upgradeCarbonProxy();