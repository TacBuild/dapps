import { Signer } from "ethers";
import { TestSmartAccountProxyUser } from "../../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";

import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
};

export async function deployMockTestContract(
    deployer: Signer,
    tacSAFactory: string,
    crossChainLayer: string
): Promise<TestSmartAccountProxyUser> {
    
    const testContract = await deployUpgradable<TestSmartAccountProxyUser>(
        deployer,
        hre.artifacts.readArtifactSync('TestSmartAccountProxyUser'),
        [crossChainLayer, tacSAFactory],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await testContract.waitForDeployment();
    return testContract;
} 