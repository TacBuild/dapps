import { Signer } from "ethers";
import { MockOracle } from "../../typechain-types";
import { deploy } from '@tonappchain/evm-ccl'
import hre from 'hardhat';
import { morphoTestnetConfig } from "./config/testnetConfig";

export async function deployMockOracle(
    deployer: Signer,
): Promise<MockOracle> {
    
    const mockOracle = await deploy<MockOracle>(
        deployer,
        hre.artifacts.readArtifactSync('MockOracle'),
        [],
        undefined,
        true
    );
    
    
    await mockOracle.waitForDeployment();
    return mockOracle;
} 