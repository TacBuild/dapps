import { Signer } from "ethers";
import { TacSAFactory } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';


const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function deployTacSAFactory(
    deployer: Signer,
    initBlueprint: string
): Promise<TacSAFactory> {
    
    const tacSAFactory = await deployUpgradable<TacSAFactory>(
        deployer,
        hre.artifacts.readArtifactSync('TacSAFactory'),
        [initBlueprint],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await tacSAFactory.waitForDeployment();
    return tacSAFactory;
} 