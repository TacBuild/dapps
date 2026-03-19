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

async function main() {
    const [signer] = await hre.ethers.getSigners();
    const lucidlyVaultProxy = await deployLucidlyVault(signer, "0x9fee01e948353E0897968A3ea955815aaA49f58d", "0x070820Ed658860f77138d71f74EfbE173775895b");
    console.log("LucidlyVaultProxy deployed to:", lucidlyVaultProxy.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});