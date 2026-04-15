import { Signer } from "ethers";
import { ChiSqProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import mainnetConfig from "./config/mainnet";
const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"],
};

export async function deployChiSqProxyMainnet(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<ChiSqProxy> {
    
    const chiSqProxy = await deployUpgradable<ChiSqProxy>(
        deployer,
        hre.artifacts.readArtifactSync('ChiSqProxy'),
        [await deployer.getAddress(), crossChainLayerAddress, tacSAFactoryAddress, mainnetConfig.parlayLpAddress, mainnetConfig.parlayCoreAddress, mainnetConfig.relayerAddress, mainnetConfig.usdtAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await chiSqProxy.waitForDeployment();
    return chiSqProxy;
}