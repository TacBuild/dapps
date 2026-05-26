import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";


const proxyOpts: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployCurveLiteTwocryptoswapProxy(deployer: Signer, tacSAFactoryAddress: string, crossChainLayerAddress: string, WTAC: string): Promise<CurveLiteTwocryptoswapProxy> { 
    const CurveLiteTwocryptoswapProxy = await deployUpgradable<CurveLiteTwocryptoswapProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'),
        [await deployer.getAddress(), tacSAFactoryAddress, crossChainLayerAddress],
        proxyOpts,
        undefined,
        true);
    await CurveLiteTwocryptoswapProxy.waitForDeployment();
    await CurveLiteTwocryptoswapProxy.setWTACAddress(WTAC);
    return CurveLiteTwocryptoswapProxy;
}

export async function upgradeCurveLiteTwocryptoswapProxy() {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("CurveLiteTwocryptoswapProxy", signer);
    const curveLiteTwocryptoswapProxy = await hre.upgrades.upgradeProxy("0x402879F4a18C79747177a91DDeAb1aB18f97503F", factory, proxyOpts);
    await curveLiteTwocryptoswapProxy.waitForDeployment();
    console.log("CurveLiteTwocryptoswapProxy upgraded to:", curveLiteTwocryptoswapProxy.target);
    return curveLiteTwocryptoswapProxy;
}
