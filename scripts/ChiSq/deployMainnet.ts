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

async function main() {
    const [deployer] = await ethers.getSigners();
    const chiSqProxy = await deployChiSqProxyMainnet(deployer, "0x9fee01e948353E0897968A3ea955815aaA49f58d", "0x070820Ed658860f77138d71f74EfbE173775895b");
    await chiSqProxy.waitForDeployment();
    console.log("ChiSqProxy deployed to:", await chiSqProxy.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});