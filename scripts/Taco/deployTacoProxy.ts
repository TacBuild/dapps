import hre from 'hardhat';
import { TacoProxy } from '../../typechain-types/';
import { deploy } from "tac-l2-ccl";
import { Signer } from 'ethers';
import {deployUpgradableLocal, deployUpgradable} from '../utils'

export async function deployTacoProxy(deployer: Signer, tacoConfig: TacoConfig, crossChainLayerAddress: string, localTest: boolean = false): Promise<TacoProxy> {
    // Proxy
    let deployFunc;
    if (localTest) {
        deployFunc = deployUpgradableLocal;
    } else {
        deployFunc = deployUpgradable;
    }
    
    
    const tacoProxy = await deployFunc<TacoProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacoProxy'),
        [await deployer.getAddress(), tacoConfig.tacoV2Proxy02, tacoConfig.tacoFeeRouteProxy, crossChainLayerAddress],
        undefined,
        true
    );

    return tacoProxy;
}