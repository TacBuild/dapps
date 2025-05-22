import hre from 'hardhat';
import { YieldManagerProxy } from '../../typechain-types/';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS } from "../utils"

export async function deployYieldProxy(deployer: Signer, managerAddress: string, tacSAFactoryAddress: string, crossChainLayerAddress: string): Promise<YieldManagerProxy> {
    // Proxy
    const yieldProxy = await deployUpgradable<YieldManagerProxy>(
        deployer,
        hre.artifacts.readArtifactSync('YieldManagerProxy'),
        [await deployer.getAddress(), managerAddress, tacSAFactoryAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await yieldProxy.waitForDeployment();
    return yieldProxy;
}

