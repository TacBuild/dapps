import { Signer } from "ethers";
import { AgnosticProxy } from "../../typechain-types";
import { deploy } from "tac-l2-ccl";
import hre from 'hardhat';


export async function deployAgnosticProxy(
    deployer: Signer,
    crossChainLayerAddress: string
): Promise<AgnosticProxy> {
    
    const agnosticProxy = await deploy<AgnosticProxy>(
        deployer,
        hre.artifacts.readArtifactSync('AgnosticProxy'),
        [crossChainLayerAddress],
        undefined,
        true
    );
    
    
    await agnosticProxy.waitForDeployment();
    return agnosticProxy;
} 