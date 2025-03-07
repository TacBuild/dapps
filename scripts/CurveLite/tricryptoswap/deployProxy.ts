import { CurveLiteTricryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS} from "../../utils"

export async function deployCurveLiteTricryptoswapProxy(deployer: Signer, crossChainLayerAddress: string): Promise<CurveLiteTricryptoswapProxy> {
    const CurveLiteTricryptoswapProxy = await deployUpgradable<CurveLiteTricryptoswapProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteTricryptoswapProxy'),
        [await deployer.getAddress(), crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);
    return CurveLiteTricryptoswapProxy;
}
