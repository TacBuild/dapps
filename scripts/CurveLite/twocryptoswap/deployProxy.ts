import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import {deployUpgradableLocal, deployUpgradable} from '../../utils'



export async function deployCurveLiteTwocryptoswapProxy(deployer: Signer, crossChainLayerAddress: string, localTest: boolean = false): Promise<CurveLiteTwocryptoswapProxy> {
    let deployFunc;
    if (localTest) {
        deployFunc = deployUpgradableLocal;
    } else {
        deployFunc = deployUpgradable;
    }
    
    const CurveLiteTwocryptoswapProxy = await deployFunc<CurveLiteTwocryptoswapProxy>(deployer, hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'), [await deployer.getAddress(), crossChainLayerAddress], undefined, true);
    return CurveLiteTwocryptoswapProxy;
}
