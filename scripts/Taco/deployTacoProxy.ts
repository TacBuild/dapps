import hre from 'hardhat';
import { TacoProxy } from '../../typechain-types/';
import { deploy } from "tac-l2-ccl";
import { Signer } from 'ethers';
import { deployUpgradable } from 'tac-l2-ccl'

export async function deployTacoProxy(deployer: Signer, tacoConfig: TacoConfig, crossChainLayerAddress: string, localTest: boolean = false): Promise<TacoProxy> {
    // Proxy 
    const tacoProxy = await deployUpgradable<TacoProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacoProxy'),
        [await deployer.getAddress(), tacoConfig.tacoV2Proxy02, tacoConfig.tacoFeeRouteProxy, crossChainLayerAddress],
        undefined,
        true
    );

    return tacoProxy;
}