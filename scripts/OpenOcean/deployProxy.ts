import { Signer } from "ethers";
import { OpenOceanProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { mainnetConfig } from "../config/mainnetConfig";
import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"],
};

export async function deployOpenOceanProxy(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string,
    wtacAddress: string
): Promise<OpenOceanProxy> {
    
    const morphoProxy = await deployUpgradable<OpenOceanProxy>(
        deployer,
        hre.artifacts.readArtifactSync('OpenOceanProxy'),
        [crossChainLayerAddress, tacSAFactoryAddress, await deployer.getAddress(), wtacAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    await morphoProxy.waitForDeployment();
    return morphoProxy;
}
