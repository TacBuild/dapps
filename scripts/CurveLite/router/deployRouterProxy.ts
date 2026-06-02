import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';
import { CurveLiteRouterProxy } from '../../../typechain-types';
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

export async function upgradeCurveLiteRouterProxy() {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("CurveLiteRouterProxy", signer);
    const curveLiteRouterProxy = await hre.upgrades.upgradeProxy("0xADb2b2F9c73967B55FFc0fAF9fC1ddA3670a0689", factory, proxyOpts);
    await curveLiteRouterProxy.waitForDeployment();
    console.log("CurveLiteRouterProxy upgraded to:", curveLiteRouterProxy.target);
    return curveLiteRouterProxy;
}
