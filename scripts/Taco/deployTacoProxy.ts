import hre from 'hardhat';
import { TacoProxy } from '../../typechain-types/';
import { deploy } from "tac-l2-ccl";
import { Signer } from 'ethers';


export async function deployTacoProxy(deployer: Signer, tacoConfig: TacoConfig, crossChainLayerAddress: string): Promise<TacoProxy> {
    // Proxy
    const tacoProxy = await deploy<TacoProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacoProxy'),
        [tacoConfig.tacoV2Proxy02, tacoConfig.tacoFeeRouteProxy, crossChainLayerAddress],
        undefined,
        true
    );

    return tacoProxy;
}