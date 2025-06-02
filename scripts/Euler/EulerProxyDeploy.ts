import { Signer } from "ethers";
import { EulerProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { eulerConfig } from "./EulerConfig";
import { tacSAFactoryDeployments } from "../TacSmartAccountFactory/config/testnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function deployEulerProxy(
    deployer: Signer,
    crossChainLayerAddress: string
): Promise<EulerProxy> {
    
    const eulerProxy = await deployUpgradable<EulerProxy>(
        deployer,
        hre.artifacts.readArtifactSync('EulerProxy'),
        [crossChainLayerAddress, eulerConfig.eulerVaultConnectorAddress, tacSAFactoryDeployments.proxyAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await eulerProxy.waitForDeployment();
    return eulerProxy;
}