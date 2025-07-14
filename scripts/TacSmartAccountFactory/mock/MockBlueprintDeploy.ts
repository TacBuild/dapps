import { Signer } from "ethers";
import { MockBluePrint } from "../../../typechain-types";
import { deploy } from '@tonappchain/evm-ccl'
import hre from 'hardhat';


export async function deployMockBluePrint(
    deployer: Signer,
): Promise<MockBluePrint> {
    
    const mockBluePrint = await deploy<MockBluePrint>(
        deployer,
        hre.artifacts.readArtifactSync('MockBluePrint'),
        [],
        undefined,
        true
    );
    
    
    await mockBluePrint.waitForDeployment();
    return mockBluePrint;
} 