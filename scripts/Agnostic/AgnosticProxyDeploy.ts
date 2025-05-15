import { Signer } from "ethers";
import { AgnosticProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";import hre from 'hardhat';


const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function deployAgnosticProxy(
    deployer: Signer,
    crossChainLayerAddress: string
): Promise<AgnosticProxy> {
    
    const agnosticProxy = await deployUpgradable<AgnosticProxy>(
        deployer,
        hre.artifacts.readArtifactSync('AgnosticProxy'),
        [crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await agnosticProxy.waitForDeployment();
    return agnosticProxy;
} 