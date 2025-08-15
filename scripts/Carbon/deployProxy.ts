import { Signer } from "ethers";
import { CarbonProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { carbonMainnetConfig } from "./config/mainnetConfig"
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
    owner?: string
): Promise<CarbonProxy> {
    const ownerAddress = owner ?? await deployer.getAddress();
    
    const carbonProxy = await deployUpgradable<CarbonProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CarbonProxy'),
        [carbonControllerAddress, tacSAFactoryAddress, crossChainLayerAddress, ownerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await carbonProxy.waitForDeployment();
    return carbonProxy;
}

