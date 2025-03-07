import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';
import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS} from "../../utils"


export async function deployCurveLiteTwocryptoswapProxy(deployer: Signer, crossChainLayerAddress: string, localTest: boolean = false): Promise<CurveLiteTwocryptoswapProxy> { 
    const CurveLiteTwocryptoswapProxy = await deployUpgradable<CurveLiteTwocryptoswapProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'),
        [await deployer.getAddress(), crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);
    return CurveLiteTwocryptoswapProxy;
}
