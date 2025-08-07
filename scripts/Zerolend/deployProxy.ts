import hre from 'hardhat';
import { ZerolendPoolProxy } from '../../typechain-types';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";

export async function deployZerolendPoolProxy(deployer: Signer, appAddress: string, tacSAFactoryAddress: string, crossChainLayerAddress: string): Promise<ZerolendPoolProxy> {
    // Proxy
    
    const proxyOptsUUPS: DeployProxyOptions = {
        kind: "uups",
        unsafeAllow: ["constructor"]
    };
    
    const zerolendPoolProxy = await deployUpgradable<ZerolendPoolProxy>(
        deployer,
        hre.artifacts.readArtifactSync('ZerolendPoolProxy'),
        [await deployer.getAddress(), appAddress, tacSAFactoryAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await zerolendPoolProxy.waitForDeployment();
    return zerolendPoolProxy;
}

