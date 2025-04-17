import { Signer } from "ethers";
import { IzumiProxy } from "../../typechain-types";
import { IzumiTestnetConfig } from "./config/testnetConfig";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";


import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};



export async function deployIzumiProxy(
    deployer: Signer,
    config: IzumiTestnetConfig,
    crossChainLayerAddress: string
): Promise<IzumiProxy> {
    
    const izumiProxy = await deployUpgradable<IzumiProxy>(
        deployer,
        hre.artifacts.readArtifactSync('IzumiProxy'),
        [crossChainLayerAddress,
            config.poolAddress,
            config.swapAddress,
            config.limitOrderAddress,
            config.liquidityManagerAddress,
            config.wTacAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await izumiProxy.waitForDeployment();
    return izumiProxy;
} 