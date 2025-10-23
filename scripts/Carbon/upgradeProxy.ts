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
    const carbonProxy = await hre.upgrades.upgradeProxy("0x188F6e49FC62c0D73173b11e7BD39C36cD3d730f", factory, proxyOptsUUPS);
    await carbonProxy.waitForDeployment();
    console.log("CarbonProxy upgraded to:", carbonProxy.target);
} 

upgradeCarbonProxy();