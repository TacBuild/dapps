import { Signer } from "ethers";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function upgradeYieldManagerProxy(
) {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("YieldManagerProxy", signer);
    const yieldManagerProxy = await hre.upgrades.upgradeProxy("0x1B2460181a9BfA50e022785e98aeD2f795752Db5", factory, proxyOptsUUPS);
    await yieldManagerProxy.waitForDeployment();
    console.log("YieldManagerProxy upgraded to:", yieldManagerProxy.target);
} 

upgradeYieldManagerProxy();