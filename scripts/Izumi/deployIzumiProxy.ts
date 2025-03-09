import { Signer } from "ethers";
import { IzumiProxy } from "../../typechain-types";
import { IzumiTestnetConfig } from "./config/testnetConfig";
import { deploy } from "tac-l2-ccl";
import hre from 'hardhat';


export async function deployIzumiProxy(
    deployer: Signer,
    config: IzumiTestnetConfig,
    crossChainLayerAddress: string
): Promise<IzumiProxy> {
    
    const izumiProxy = await deploy<IzumiProxy>(
        deployer,
        hre.artifacts.readArtifactSync('IzumiProxy'),
        [crossChainLayerAddress,
            config.poolAddress,
            config.swapAddress,
            config.limitOrderAddress,
            config.liquidityManagerAddress],
        undefined,
        true
    );
    
    
    await izumiProxy.waitForDeployment();
    return izumiProxy;
} 