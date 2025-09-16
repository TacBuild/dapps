import hre from 'hardhat';
import { MidasProxy } from '../../typechain-types/';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};


export async function deployMidasProxy(deployer: Signer, tacSAFactoryAddress: string, depositVaultAddress: string, redemptionVaultAddress: string,  crossChainLayerAddress: string): Promise<MidasProxy> {
    // Proxy
    const midasProxy = await deployUpgradable<MidasProxy>(
        deployer,
        hre.artifacts.readArtifactSync('MidasProxy'),
        [await deployer.getAddress(), tacSAFactoryAddress, depositVaultAddress, redemptionVaultAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await midasProxy.waitForDeployment();
    return midasProxy;
}