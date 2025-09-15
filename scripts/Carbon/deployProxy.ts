import { Signer } from "ethers";
import { CarbonProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { carbonMainnetConfig } from "./config/mainnetConfig"
import { carbonTestnetConfig } from "./config/testnetConfig"
import { mainnetConfig } from "../config/mainnetConfig"
import { testnetConfig } from "../config/testnetConfig"

import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployCarbonProxy(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string,
    carbonControllerAddress: string,
    carbonBatcherAddress: string,
    carbonVoucherAddress: string,
    owner?: string
): Promise<CarbonProxy> {
    const ownerAddress = owner ?? await deployer.getAddress();
    
    const carbonProxy = await deployUpgradable<CarbonProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CarbonProxy'),
        [carbonControllerAddress, carbonBatcherAddress, carbonVoucherAddress, tacSAFactoryAddress, crossChainLayerAddress, ownerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await carbonProxy.waitForDeployment();
    return carbonProxy;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const carbonProxy = await deployCarbonProxy(deployer, testnetConfig.crosschainLayerAddress, testnetConfig.tacSAFactoryAddress, carbonTestnetConfig.carbonControllerAddress, carbonTestnetConfig.carbonBatcherAddress, carbonTestnetConfig.carbonVoucherAddress);
    console.log("CarbonProxy deployed to:", carbonProxy.target);
}

main();

