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

