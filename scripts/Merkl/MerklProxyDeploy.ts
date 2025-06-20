import { Signer } from "ethers";
import { MerklProxy, CustomMerklProxyEuler } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { merklTestnetConfig, rEULTestnetConfig } from "./config/TestnetConfigTurinV3";
import { deployTacSmartAccount } from "../TacSmartAccountFactory/SABlueprintDeploy";
import { deployTacSAFactory } from "../TacSmartAccountFactory/FactoryDeploy";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployMerklProxy(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<MerklProxy> {
    
    const merklProxy = await deployUpgradable<MerklProxy>(
        deployer,
        hre.artifacts.readArtifactSync('MerklProxy'),
        [crossChainLayerAddress, tacSAFactoryAddress, merklTestnetConfig.merklAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await merklProxy.waitForDeployment();
    return merklProxy;
}

export async function deployCustomMerklProxyEuler(
    deployer: Signer,
    mainMerklProxyAddress: string,
): Promise<CustomMerklProxyEuler> {
    const customMerklProxyEuler = await deployUpgradable<CustomMerklProxyEuler>(
        deployer,
        hre.artifacts.readArtifactSync('CustomMerklProxyEuler'),
        [rEULTestnetConfig.EULAddress, rEULTestnetConfig.rEULAddress, mainMerklProxyAddress],
        proxyOptsUUPS,
        undefined,
        true
    );

    await customMerklProxyEuler.waitForDeployment();
    return customMerklProxyEuler;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    // const account = await deployTacSmartAccount(deployer);
    // const saFactory = await deployTacSAFactory(deployer, await account.getAddress());
    await deployMerklProxy(deployer, merklTestnetConfig.crossChainLayerAddress, merklTestnetConfig.tacSAFactoryAddress)
}

main()
