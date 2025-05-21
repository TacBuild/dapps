import hre from 'hardhat';
import { YieldManagerProxy } from '../../typechain-types/';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS } from "../utils"
import { yiedTestnetConfig } from "./config/testnetConfig";

export async function deployYieldProxy(deployer: Signer, tacSAFactoryAddress: string, crossChainLayerAddress: string): Promise<YieldManagerProxy> {
    // Proxy
    const yieldProxy = await deployUpgradable<YieldManagerProxy>(
        deployer,
        hre.artifacts.readArtifactSync('YieldProxy'),
        [await deployer.getAddress(),yiedTestnetConfig.managerAddress, tacSAFactoryAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await yieldProxy.waitForDeployment();
    return yieldProxy;
}

