import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { CurveLiteTricryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import {deployUpgradableLocal, deployUpgradable} from '../../utils'


export async function deployCurveLiteTricryptoswapProxy(deployer: Signer, crossChainLayerAddress: string, localTest: boolean = false): Promise<CurveLiteTricryptoswapProxy> {
    let deployFunc;
    if (localTest) {
        deployFunc = deployUpgradableLocal;
    } else {
        deployFunc = deployUpgradable;
    }
   
   
    const CurveLiteTricryptoswapProxy = await deployFunc<CurveLiteTricryptoswapProxy>(deployer, hre.artifacts.readArtifactSync('CurveLiteTricryptoswapProxy'), [await deployer.getAddress(), crossChainLayerAddress], undefined, true);
    return CurveLiteTricryptoswapProxy;
}
