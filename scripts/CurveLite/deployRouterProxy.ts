import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';
import { CurveLiteRouterProxy } from '../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS } from "../utils"


export async function deployCurveLiteRouterProxy(deployer: Signer, curveLiteRouterAddress: string, crossChainLayerAddress: string): Promise<CurveLiteRouterProxy> { 
    const CurveLiteRouterProxy = await deployUpgradable<CurveLiteRouterProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteRouterProxy'),
        [await deployer.getAddress(), curveLiteRouterAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);
    return CurveLiteRouterProxy;
}
