import { Signer } from "ethers";
import { ChiSqProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import testnetConfig from "./config/testnet";
const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"],
};

export async function deployChiSqProxyTestnet(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string,
    isLocalTest : boolean = false,
    relayerAddressForLocalTest : string = ""
): Promise<ChiSqProxy> {
    
    const chiSqProxy = await deployUpgradable<ChiSqProxy>(
        deployer,
        hre.artifacts.readArtifactSync('ChiSqProxy'),
        [await deployer.getAddress(), crossChainLayerAddress, tacSAFactoryAddress, testnetConfig.parlayLpAddress, testnetConfig.parlayCoreAddress, isLocalTest ? relayerAddressForLocalTest : testnetConfig.relayerAddress, testnetConfig.usdtAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await chiSqProxy.waitForDeployment();
    return chiSqProxy;
}

async function main() {

    const [deployer] = await ethers.getSigners();
    const chiSqProxy = await deployChiSqProxyTestnet(deployer, "0x4f3b05a601B7103CF8Fc0aBB56d042e04f222ceE", "0x5919D1D0D1b36F08018d7C9650BF914AEbC6BAd6");
    await chiSqProxy.waitForDeployment();
    console.log("ChiSqProxy deployed to:", await chiSqProxy.getAddress());
}

main();