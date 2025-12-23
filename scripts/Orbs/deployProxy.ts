import hre from 'hardhat';
import { OrbsProxy } from '../../typechain-types/';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { orbsMainnetConfig } from "./config/config";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployOrbsProxy(deployer: Signer, crossChainLayerAddress: string, tacSAFactoryAddress: string): Promise<OrbsProxy> {
    // Proxy
    const orbsProxy = await deployUpgradable<OrbsProxy>(
        deployer,
        hre.artifacts.readArtifactSync('OrbsProxy'),
        [await deployer.getAddress(), crossChainLayerAddress, orbsMainnetConfig.multiAccountAddress, tacSAFactoryAddress, orbsMainnetConfig.collateralTokenAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await orbsProxy.waitForDeployment();
    return orbsProxy;
    
}


async function main() {
    const [deployer] = await ethers.getSigners();
    const orbsProxy = await deployOrbsProxy(deployer,"0x9fee01e948353E0897968A3ea955815aaA49f58d" , "0x070820Ed658860f77138d71f74EfbE173775895b");
    await orbsProxy.waitForDeployment();
    console.log("OrbsProxy deployed to:", await orbsProxy.getAddress());
}

// main();
