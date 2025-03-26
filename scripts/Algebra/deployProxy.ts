import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';
import { AlgebraRouterProxy, AlgebraNonfungiblePositionManagerProxy } from '../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { proxyOptsUUPS} from "../utils"


export async function deployAlgebraRouterProxy(deployer: Signer, algebraConfig: AlgebraConfig, crossChainLayerAddress: string): Promise<AlgebraRouterProxy> { 
    const AlgebraRouterProxy = await deployUpgradable<AlgebraRouterProxy>(
        deployer,
        hre.artifacts.readArtifactSync('AlgebraRouterProxy'),
        [await deployer.getAddress(), algebraConfig.algebraRouter,  crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);
    return AlgebraRouterProxy;
}


export async function deployAlgebraNonfungiblePositionManager(deployer: Signer, algebraConfig: AlgebraConfig, crossChainLayerAddress: string): Promise<AlgebraNonfungiblePositionManagerProxy> { 
    const AlgebraNonfungiblePositionManagerProxy = await deployUpgradable<AlgebraNonfungiblePositionManagerProxy>(
        deployer,
        hre.artifacts.readArtifactSync('AlgebraNonfungiblePositionManagerProxy'),
        [await deployer.getAddress(), algebraConfig.algebraNonfungiblePositionManager,  crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true);
    return AlgebraNonfungiblePositionManagerProxy;
}
