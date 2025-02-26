import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from 'tac-l2-ccl'



export async function deployCurveLiteTwocryptoswapProxy(deployer: Signer, crossChainLayerAddress: string, localTest: boolean = false): Promise<CurveLiteTwocryptoswapProxy> { 
    const CurveLiteTwocryptoswapProxy = await deployUpgradable<CurveLiteTwocryptoswapProxy>(deployer, hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'), [await deployer.getAddress(), crossChainLayerAddress], undefined, true);
    return CurveLiteTwocryptoswapProxy;
}
