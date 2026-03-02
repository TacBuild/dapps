import { Signer } from "ethers";
import { LucidlyVaultProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { lucidlyVaultMainnetConfig } from "./config/LucidlyMainnet.config";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployLucidlyVault(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<LucidlyVaultProxy> {
    
    const lucidlyVaultProxy = await deployUpgradable<LucidlyVaultProxy>(
        deployer,
        hre.artifacts.readArtifactSync('LucidlyVaultProxy'),
        [crossChainLayerAddress, lucidlyVaultMainnetConfig.teller, lucidlyVaultMainnetConfig.queue, lucidlyVaultMainnetConfig.lucidlyVault, tacSAFactoryAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await lucidlyVaultProxy.waitForDeployment();
    return lucidlyVaultProxy;
}