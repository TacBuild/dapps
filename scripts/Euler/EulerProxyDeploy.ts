import { Signer } from "ethers";
import { EulerProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { eulerConfig } from "./EulerConfig";
import { tacSAFactoryDeployments as tacSAFactoryDeploymentsMainnet } from "../TacSmartAccountFactory/config/mainnetConfig";
import { tacSAFactoryDeployments } from "../TacSmartAccountFactory/config/testnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployEulerProxy(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress?: string,
    owner?: string
): Promise<EulerProxy> {
    
    const eulerProxy = await deployUpgradable<EulerProxy>(
        deployer,
        hre.artifacts.readArtifactSync('EulerProxy'),
        [crossChainLayerAddress, eulerConfig.eulerVaultConnectorAddress, tacSAFactoryAddress || tacSAFactoryDeployments.proxyAddress, owner || await deployer.getAddress()],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await eulerProxy.waitForDeployment();
    return eulerProxy;
}

export async function deployEulerProxyMainnet() {
    const [signer] = await hre.ethers.getSigners();
    const eulerProxy = await deployUpgradable<EulerProxy>(
        signer,
        hre.artifacts.readArtifactSync('EulerProxy'),
        [eulerConfig.crossChainLayerMainnetAddress, eulerConfig.eulerVaultConnectorMainnetAddress, tacSAFactoryDeploymentsMainnet.proxyAddress, await signer.getAddress()],
        proxyOptsUUPS,
        undefined,
        true
    );
    await eulerProxy.waitForDeployment();
    return eulerProxy;
}

// deployEulerProxyMainnet();