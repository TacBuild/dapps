import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS} from "../../utils"


export async function deployCurveLiteTwocryptoswapProxy(deployer: Signer, tacSAFactoryAddress: string, crossChainLayerAddress: string): Promise<CurveLiteTwocryptoswapProxy> { 
    const CurveLiteTwocryptoswapProxy = await deployUpgradable<CurveLiteTwocryptoswapProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'),
        [await deployer.getAddress(), tacSAFactoryAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);
    await CurveLiteTwocryptoswapProxy.waitForDeployment();
    return CurveLiteTwocryptoswapProxy;
}
