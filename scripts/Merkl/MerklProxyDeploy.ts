import { Signer } from "ethers";
import { MerklProxy, CustomMerklProxyEuler } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { merklTestnetConfig, rEULTestnetConfig } from "./config/TestnetConfigTurinV3";
import { merklMainnetConfig } from "./config/MainnetConfig";
import { deployTacSmartAccount } from "../TacSmartAccountFactory/SABlueprintDeploy";
import { deployTacSAFactory } from "../TacSmartAccountFactory/FactoryDeploy";
import { tacSAFactoryDeployments } from "../TacSmartAccountFactory/config/mainnetConfig";

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


export async function deployMerklProxyMainnet(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<MerklProxy> {
    
    const merklProxy = await deployUpgradable<MerklProxy>(
        deployer,
        hre.artifacts.readArtifactSync('MerklProxy'),
        [crossChainLayerAddress, tacSAFactoryAddress, merklMainnetConfig.merklAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await merklProxy.waitForDeployment();
    return merklProxy;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    // const account = await deployTacSmartAccount(deployer);
    // const saFactory = await deployTacSAFactory(deployer, await account.getAddress());
    const merklProxy = await deployMerklProxyMainnet(deployer, merklMainnetConfig.crossChainLayerAddress, tacSAFactoryDeployments.proxyAddress)
    console.log("MerklProxy deployed to:", merklProxy.target);
    // const customMerklProxyEuler = await deployCustomMerklProxyEuler(deployer, await merklProxy.getAddress())
    // await merklProxy.setCustomMerklLogic(rEULTestnetConfig.rEULAddress, await customMerklProxyEuler.getAddress())
}

main()
