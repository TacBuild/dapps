import { Signer } from "ethers";
import { MorphoProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { morphoProxyDeployments, morphoTestnetConfig } from "./config/testnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function deployMorphoProxy(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<MorphoProxy> {
    
    const morphoProxy = await deployUpgradable<MorphoProxy>(
        deployer,
        hre.artifacts.readArtifactSync('MorphoProxy'),
        [crossChainLayerAddress, morphoTestnetConfig.morphoAddress, morphoTestnetConfig.urdAddress, morphoTestnetConfig.metaMorphoV1_1Address, tacSAFactoryAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await morphoProxy.waitForDeployment();
    return morphoProxy;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    deployMorphoProxy(deployer, morphoProxyDeployments.crossChainLayerAddress, morphoProxyDeployments.smartAccountFactoryAddress);
}

main()
