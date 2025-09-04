import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';
import { CurveLiteRouterProxy } from '../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";


const proxyOpts: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};


export async function deployCurveLiteRouterProxy(deployer: Signer, curveLiteRouterAddress: string, crossChainLayerAddress: string, smartAccountFactoryAddress: string): Promise<CurveLiteRouterProxy> { 
    const CurveLiteRouterProxy = await deployUpgradable<CurveLiteRouterProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteRouterProxy'),
        [await deployer.getAddress(), curveLiteRouterAddress, crossChainLayerAddress, smartAccountFactoryAddress],
        proxyOpts,
        undefined,
        true);
    return CurveLiteRouterProxy;
}
