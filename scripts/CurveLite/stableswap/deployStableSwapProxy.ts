import { CurveLiteStableswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';
import { ContractFactory, Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";


const proxyOpts: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployCurveLiteStableswapProxy(deployer: Signer, crossChainLayerAddress: string, smartAccountFactory: string, WTAC: string): Promise<CurveLiteStableswapProxy> {
    const CurveLiteStableswapProxy = await deployUpgradable<CurveLiteStableswapProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CurveLiteStableswapProxy'),
        [await deployer.getAddress(), crossChainLayerAddress, smartAccountFactory],
        proxyOpts,
        undefined,
        true);
    await CurveLiteStableswapProxy.waitForDeployment();
    await CurveLiteStableswapProxy.setWTACAddress(WTAC);
    return CurveLiteStableswapProxy;
}

export async function upgradeCurveLiteStableswapProxy() {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("CurveLiteStableswapProxy", signer);
    const curveLiteStableswapProxy = await hre.upgrades.upgradeProxy("0xfC99BD3dAABAcAC47c1040421A3Fb05bbf8c2b4b", factory, proxyOpts);
    await curveLiteStableswapProxy.waitForDeployment();
    console.log("CurveLiteStableswapProxy upgraded to:", curveLiteStableswapProxy.target);
    return curveLiteStableswapProxy;
}
