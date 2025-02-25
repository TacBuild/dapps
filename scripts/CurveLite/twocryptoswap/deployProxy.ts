import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';



export async function deployCurveLiteTwocryptoswapProxy(deployer: Signer, crossChainLayerAddress: string): Promise<CurveLiteTwocryptoswapProxy> {
    const CurveLiteTwocryptoswapProxy = await deploy<CurveLiteTwocryptoswapProxy>(deployer, hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'), [crossChainLayerAddress], undefined, true);
    return CurveLiteTwocryptoswapProxy;
}
