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

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const tacSAFactory = await deployTacSAFactory(deployer, "0xeAB80f5369689a2D142f25E654d9822A7725028B");
    console.log("TacSAFactory deployed to:", tacSAFactory.target);
}
