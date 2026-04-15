import { Signer } from "ethers";
import { ChiSqProxy } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeChiSqProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("ChiSqProxy", signer);
    const chiSqProxy = await hre.upgrades.upgradeProxy("0x188F6e49FC62c0D73173b11e7BD39C36cD3d730f", factory, proxyOptsUUPS);
    await chiSqProxy.waitForDeployment();
    console.log("ChiSqProxy upgraded to:", chiSqProxy.target);
} 

upgradeChiSqProxy();