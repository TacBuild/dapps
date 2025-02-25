import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { CurveLiteTricryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';



export async function deployCurveLiteTricryptoswapProxy(deployer: Signer, crossChainLayerAddress: string): Promise<CurveLiteTricryptoswapProxy> {
    const CurveLiteTricryptoswapProxy = await deploy<CurveLiteTricryptoswapProxy>(deployer, hre.artifacts.readArtifactSync('CurveLiteTricryptoswapProxy'), [crossChainLayerAddress], undefined, true);
    return CurveLiteTricryptoswapProxy;
}
