import hre from 'hardhat';
import { TacoProxy } from '../../typechain-types/';
import { deploy } from "@tonappchain/evm-ccl";
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS } from "../utils"

export async function deployTacoProxy(deployer: Signer, tacoConfig: TacoConfig, crossChainLayerAddress: string): Promise<TacoProxy> {
    // Proxy
    const tacoProxy = await deployUpgradable<TacoProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacoProxy'),
        [await deployer.getAddress(), tacoConfig.tacoV2Proxy02, tacoConfig.tacoFeeRouteProxy, tacoConfig.tacoCalleeHelperAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );

    return tacoProxy;
}