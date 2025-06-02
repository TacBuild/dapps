import { Signer } from "ethers";
import { TacBoringVaultProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { tacVaultTestnetConfig } from "./config/TacVaultTestnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function deployTacVault(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<TacBoringVaultProxy> {
    
    const tacVaultProxy = await deployUpgradable<TacBoringVaultProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacBoringVaultProxy'),
        [crossChainLayerAddress, tacVaultTestnetConfig.teller, tacVaultTestnetConfig.boringOnChainQueue, tacVaultTestnetConfig.boringVault, tacSAFactoryAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await tacVaultProxy.waitForDeployment();
    return tacVaultProxy;
}