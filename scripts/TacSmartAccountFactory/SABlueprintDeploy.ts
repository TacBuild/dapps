import { Signer } from "ethers";
import { TacSmartAccount } from "../../typechain-types";
import { deploy } from '@tonappchain/evm-ccl'
import hre from 'hardhat';


export async function deployTacSmartAccount(
    deployer: Signer,
): Promise<TacSmartAccount> {
    
    const tacSmartAccount = await deploy<TacSmartAccount>(
        deployer,
        hre.artifacts.readArtifactSync('TacSmartAccount'),
        [],
        undefined,
        true
    );
    
    
    await tacSmartAccount.waitForDeployment();
    return tacSmartAccount;
} 