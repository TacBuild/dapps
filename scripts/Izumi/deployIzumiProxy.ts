import { Signer } from "ethers";
import { IzumiProxy } from "../../typechain-types";
import { izumiTestnetConfig } from "./config/testnetConfig";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";


import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};



export async function deployIzumiProxy(
    deployer: Signer,
    crossChainLayerAddress: string
): Promise<IzumiProxy> {
    
    const izumiProxy = await deployUpgradable<IzumiProxy>(
        deployer,
        hre.artifacts.readArtifactSync('IzumiProxy'),
        [crossChainLayerAddress,
            izumiTestnetConfig.poolAddress,
            izumiTestnetConfig.swapAddress,
            izumiTestnetConfig.limitOrderAddress,
            izumiTestnetConfig.liquidityManagerAddress,
            izumiTestnetConfig.wTacAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await izumiProxy.waitForDeployment();
    return izumiProxy;
} 

async function main() {
    const [deployer] = await ethers.getSigners();
    const izumiProxy = await deployIzumiProxy(deployer, "0x20B33b63fADd3cf09943b493ef79FC8C0845d577");
    console.log(await izumiProxy.getAddress());
}

main().catch(console.error);